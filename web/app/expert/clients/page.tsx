import type { Metadata } from 'next';
import ExpertClientsClient from '@/components/ExpertClientsClient';

export const metadata: Metadata = {
  title: 'Мои клиенты | EATLYY',
  robots: { index: false, follow: false },
};

export default function ExpertClientsPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 680 }}>
        <ExpertClientsClient botUsername={botUsername} />
      </div>
    </section>
  );
}
