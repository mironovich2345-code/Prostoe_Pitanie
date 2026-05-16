import type { Metadata } from 'next';
import ClientExpertClient from '@/components/ClientExpertClient';

export const metadata: Metadata = {
  title: 'Мой эксперт | EATLYY',
  robots: { index: false, follow: false },
};

export default function ClientExpertPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.6, marginBottom: 28 }}>
          Мой эксперт
        </h1>
        <ClientExpertClient botUsername={botUsername} />
      </div>
    </section>
  );
}
