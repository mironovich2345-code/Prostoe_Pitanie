/**
 * EATLYY Web — Public API client
 *
 * Fetches from the real backend via NEXT_PUBLIC_API_URL.
 * Falls back to mock data if the API is unavailable (local dev / cold start).
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

async function get<T>(path: string): Promise<T> {
  const url = `${_base}${path}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`API ${res.status} ${url}`);
  return res.json() as Promise<T>;
}

// Map mock Expert → PublicTrainer for fallback rendering in local dev.
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
    const data = await get<{ trainers: PublicTrainer[] }>('/api/public/trainers');
    return data.trainers;
  } catch {
    // Fallback to mock data so the page renders in local dev / when API is cold.
    return EXPERTS.map(mockToPublicTrainer);
  }
}

export async function getExpertBySlug(slug: string): Promise<PublicTrainer | null> {
  try {
    const data = await get<{ trainer: PublicTrainer }>(`/api/public/trainers/${encodeURIComponent(slug)}`);
    return data.trainer;
  } catch (err: unknown) {
    // 404 → not found; any other error → fall back to mock lookup.
    if (err instanceof Error && err.message.includes('404')) return null;
    return EXPERTS.map(mockToPublicTrainer).find(e => e.slug === slug) ?? null;
  }
}
