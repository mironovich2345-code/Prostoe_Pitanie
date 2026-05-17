import type { Metadata } from 'next';
import CompanyStatsClient from '@/components/CompanyStatsClient';

export const metadata: Metadata = {
  title: 'Статистика компании | EATLYY',
  robots: { index: false, follow: false },
};

export default function CompanyStatsPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 680 }}>
        <CompanyStatsClient botUsername={botUsername} />
      </div>
    </section>
  );
}
