/**
 * AI cost tracking — internal telemetry, NOT user-facing billing.
 *
 * Single source of truth for:
 *   - model pricing (update PRICING when OpenAI changes rates)
 *   - cost calculation in USD
 *   - fire-and-forget DB logging of each AI call
 */

import prisma from '../db';

// ── Pricing map ───────────────────────────────────────────────────────────────
// USD per 1 million tokens. Source: platform.openai.com/pricing (2025-04)
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gpt-4o':      { inputPer1M: 2.50,  outputPer1M: 10.00 },
  'gpt-4o-mini': { inputPer1M: 0.150, outputPer1M: 0.600 },
};

// Fallback for unknown/future models — defaults to cheapest known tier
const DEFAULT_PRICING = PRICING['gpt-4o-mini'];

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Caller context passed into each AI function so cost can be attributed to a
 * specific user and scenario.
 */
export interface AiCostContext {
  /** Platform-independent userId; null for legacy users not yet migrated. */
  userId?: string | null;
  /** Legacy chatId fallback; used when userId is unavailable. */
  chatId?: string | null;
  /**
   * Scenario identifier, e.g.:
   *   'food_text'                — free-text food analysis
   *   'food_photo'               — photo food analysis
   *   'food_ingredients'         — ingredient-based calculation
   *   'nutrition_insight_daily'  — daily AI insight
   *   'nutrition_insight_weekly' — weekly AI insight
   *   'requisites_ocr'           — company requisites recognition
   */
  scenario: string;
}

// ── Cost calculation ──────────────────────────────────────────────────────────

/**
 * Calculate the USD cost for a single AI call.
 * Rounds to 8 decimal places to avoid float noise.
 */
export function calcCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model] ?? DEFAULT_PRICING;
  const raw = (inputTokens * p.inputPer1M + outputTokens * p.outputPer1M) / 1_000_000;
  return Math.round(raw * 1e8) / 1e8;
}

// ── DB helper (typed cast for models not yet in generated Prisma client) ───────

type AiCostLogCreateInput = {
  userId?: string | null;
  chatId?: string | null;
  scenario: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
};

function getAiCostLogDb() {
  return (prisma as unknown as {
    aiCostLog: { create(args: { data: AiCostLogCreateInput }): Promise<unknown> };
  }).aiCostLog;
}

// ── Logging ───────────────────────────────────────────────────────────────────

/**
 * Log AI cost for one call. Fire-and-forget — NEVER throws.
 * If `usage` is null/undefined (provider didn't return it), the log is skipped.
 */
export function logAiCost(
  ctx: AiCostContext,
  model: string,
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens?: number } | null | undefined,
): void {
  if (!usage) return; // no usage data — skip rather than fake numbers

  const costUsd = calcCostUsd(model, usage.prompt_tokens, usage.completion_tokens);

  getAiCostLogDb()
    .create({
      data: {
        userId: ctx.userId ?? null,
        chatId: ctx.chatId ?? null,
        scenario: ctx.scenario,
        model,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens ?? (usage.prompt_tokens + usage.completion_tokens),
        costUsd,
      },
    })
    .catch(err => {
      // Cost logging must never break the main AI flow
      console.error('[aiCost] Failed to log cost entry:', err);
    });
}

// ── Aggregate query helpers (used by admin endpoints) ─────────────────────────

type AiCostLogDb = {
  create(args: { data: AiCostLogCreateInput }): Promise<unknown>;
  aggregate(args: unknown): Promise<{
    _sum: { costUsd: number | null; totalTokens: number | null };
    _count: { id: number };
  }>;
  groupBy(args: unknown): Promise<Array<{
    scenario?: string;
    model?: string;
    _sum: { costUsd: number | null };
    _count: { id: number };
  }>>;
  findMany(args: unknown): Promise<Array<{
    id: number;
    userId: string | null;
    chatId: string | null;
    scenario: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    createdAt: Date;
  }>>;
};

export function getAiCostLogDbFull(): AiCostLogDb {
  return (prisma as unknown as { aiCostLog: AiCostLogDb }).aiCostLog;
}
