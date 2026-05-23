import type { Metadata } from 'next';
import DiaryClient from '@/components/DiaryClient';

export const metadata: Metadata = {
  title: 'Дневник питания | EATLYY',
  robots: { index: false, follow: false },
};

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const initialDate =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : undefined;

  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.6, marginBottom: 28 }}>
          Дневник питания
        </h1>
        <DiaryClient initialDate={initialDate} />
      </div>
    </section>
  );
}
