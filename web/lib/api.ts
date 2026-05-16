/**
 * EATLYY Web — Public API client
 *
 * Fetches from the real backend via NEXT_PUBLIC_API_URL.
 * Falls back to mock data ONLY when the API is completely unreachable
 * (network error / timeout). A successful 200 with an empty list is NOT
 * a failure — it means the catalog is empty and we show the empty state.
 */

import type { Expert } from '@/data/experts';
import { EXPERTS } from '@/data/experts';

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

// Map mock Expert → PublicTrainer for local-dev fallback only.
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
    // Use short revalidation so a newly published expert appears quickly.
    const raw = await get<PublicTrainer[] | { trainers?: PublicTrainer[] }>(
      '/api/public/trainers',
      10,
    );

    // Support both `{ trainers: [...] }` and bare `[...]` shapes.
    const list: PublicTrainer[] = Array.isArray(raw)
      ? raw
      : (raw as { trainers?: PublicTrainer[] }).trainers ?? [];

    console.log(
      `[api/public/trainers] format=${Array.isArray(raw) ? 'array' : 'object.trainers'} count=${list.length} base=${_base || '(empty)'}`,
    );

    return list;
  } catch (err) {
    // Only fall back to mock data when the API is unreachable (timeout, network, 5xx).
    console.warn(
      '[api/public/trainers] fetch failed, using mock data:',
      err instanceof Error ? err.message : String(err),
    );
    return EXPERTS.map(mockToPublicTrainer);
  }
}

export async function getExpertBySlug(slug: string): Promise<PublicTrainer | null> {
  try {
    const raw = await get<PublicTrainer | { trainer?: PublicTrainer }>(
      `/api/public/trainers/${encodeURIComponent(slug)}`,
      60,
    );

    // Support both `{ trainer: {...} }` and bare object shapes.
    const trainer: PublicTrainer | null =
      raw !== null && typeof raw === 'object' && 'trainer' in raw
        ? (raw as { trainer: PublicTrainer }).trainer ?? null
        : (raw as PublicTrainer) ?? null;

    return trainer;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('404')) return null;
    // Any other error (timeout, network): fall back to mock lookup.
    return EXPERTS.map(mockToPublicTrainer).find(e => e.slug === slug) ?? null;
  }
}
