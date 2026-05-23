import type { Metadata } from 'next';
import Link from 'next/link';
import NutritionStatsClient from '@/components/NutritionStatsClient';

export const metadata: Metadata = {
  title: 'Статистика питания | EATLYY',
  robots: { index: false, follow: false },
};

export default function NutritionStatsPage() {
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/client"
            style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            ← Кабинет
          </Link>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.6, marginBottom: 28 }}>
          Статистика питания
        </h1>
        <NutritionStatsClient />
      </div>
    </section>
  );
}
