/**
 * EATLYY Web — Public API client
 *
 * Fetches from the real backend via NEXT_PUBLIC_API_URL.
 * Mock data is ONLY used in local development (NODE_ENV === 'development').
 * In production, a failed API call returns [] / null — never mock experts.
 * A successful 200 with an empty list shows the empty-state UI, not mocks.
 */

import type { Expert } from '@/data/experts';
import { EXPERTS } from '@/data/experts';

const IS_DEV = process.env.NODE_ENV === 'development';

export interface PublicTrainer {
  slug: string;
  fullName: string | null;
  specialization: string | null;
  city: string | null;
  experienceYears: number | null;
  bio: string | null;
  suitableFor: string | null; // comma-separated or free-form
  tags: string | null;        // comma-separated
  socialLink: string | null;
}

// Server-side fetch uses the full absolute URL; rewrites only apply to browser requests.
const _base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '').replace(/\/api$/, '');

async function get<T>(path: string, revalidate = 60): Promise<T> {
  const url = `${_base}${path}`;
  const res = await fetch(url, {
    next: { revalidate },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`API ${res.status} ${url}`);
  return res.json() as Promise<T>;
}

// Map mock Expert → PublicTrainer. Used in development only.
function mockToPublicTrainer(e: Expert): PublicTrainer {
  return {
    slug: e.slug,
    fullName: e.name,
    specialization: e.specialization,
    city: e.city,
    experienceYears: e.experience,
    bio: e.fullBio,
    suitableFor: e.forWhom.join(', '),
    tags: e.tags.join(', '),
    socialLink: null,
  };
}

// ─── Experts (public catalog) ────────────────────────────────────────────────

export async function getExperts(): Promise<PublicTrainer[]> {
  try {
    const raw = await get<PublicTrainer[] | { trainers?: PublicTrainer[] }>(
      '/api/public/trainers',
      10,
    );

    const list: PublicTrainer[] = Array.isArray(raw)
      ? raw
      : (raw as { trainers?: PublicTrainer[] }).trainers ?? [];

    console.log(
      `[trainers] source=api count=${list.length} env=${process.env.NODE_ENV} base=${_base || '(empty)'}`,
    );

    return list;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (IS_DEV) {
      console.warn(`[trainers] source=mock (dev fallback): ${msg}`);
      return EXPERTS.map(mockToPublicTrainer);
    }

    // Production: never show stale mock experts — return empty list so the
    // empty-state UI is displayed and no fake profiles pollute the catalog.
    console.error(`[trainers] source=empty (api unreachable in production): ${msg}`);
    return [];
  }
}

export async function getExpertBySlug(slug: string): Promise<PublicTrainer | null> {
  try {
    const raw = await get<PublicTrainer | { trainer?: PublicTrainer }>(
      `/api/public/trainers/${encodeURIComponent(slug)}`,
      60,
    );

    const trainer: PublicTrainer | null =
      raw !== null && typeof raw === 'object' && 'trainer' in raw
        ? (raw as { trainer: PublicTrainer }).trainer ?? null
        : (raw as PublicTrainer) ?? null;

    return trainer;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('404')) return null;

    if (IS_DEV) {
      return EXPERTS.map(mockToPublicTrainer).find(e => e.slug === slug) ?? null;
    }

    // Production: treat any API failure as not-found rather than showing mock profile.
    console.error(`[trainers/${slug}] api error in production:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}
