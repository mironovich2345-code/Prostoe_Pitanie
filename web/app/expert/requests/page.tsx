import type { Metadata } from 'next';
import ExpertRequestsClient from '@/components/ExpertRequestsClient';

export const metadata: Metadata = {
  title: 'Заявки клиентов | EATLYY',
  robots: { index: false, follow: false },
};

export default function ExpertRequestsPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 680 }}>
        <ExpertRequestsClient botUsername={botUsername} />
      </div>
    </section>
  );
}
