import type { Metadata } from 'next';
import CompanyDashboardClient from '@/components/CompanyDashboardClient';

export const metadata: Metadata = {
  title: 'Кабинет компании | EATLYY',
  robots: { index: false, follow: false },
};

export default function CompanyPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 680 }}>
        <CompanyDashboardClient botUsername={botUsername} />
      </div>
    </section>
  );
}
