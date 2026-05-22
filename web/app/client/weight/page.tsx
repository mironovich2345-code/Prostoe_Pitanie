import type { Metadata } from 'next';
import WeightClient from '@/components/WeightClient';

export const metadata: Metadata = {
  title: 'История веса | EATLYY',
  robots: { index: false, follow: false },
};

export default function WeightPage() {
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.6, marginBottom: 28 }}>
          История веса
        </h1>
        <WeightClient />
      </div>
    </section>
  );
}
