/**
 * EATLYY Web — API client
 *
 * Phase 1 (current): backed by static mock data from data/experts.ts.
 * Phase 2 (next):    replace getExperts / getExpertBySlug implementations
 *                    below with real fetch() calls once the backend exposes
 *                    public endpoints (no auth required).
 *
 * Base URL: NEXT_PUBLIC_API_URL env var (Railway → production backend).
 * Empty = same origin (useful when web and API share a domain).
 */

import type { Expert } from '@/data/experts';
import { EXPERTS } from '@/data/experts';

const _base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${_base}${path}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Experts ─────────────────────────────────────────────────────────────────

export async function getExperts(): Promise<Expert[]> {
  // TODO: replace with get<Expert[]>('/api/public/experts') when ready
  return EXPERTS;
}

export async function getExpertBySlug(slug: string): Promise<Expert | null> {
  // TODO: replace with get<Expert | null>(`/api/public/experts/${slug}`) when ready
  return EXPERTS.find((e) => e.slug === slug) ?? null;
}
