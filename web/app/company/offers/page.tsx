import type { Metadata } from 'next';
import CompanyOffersClient from '@/components/CompanyOffersClient';

export const metadata: Metadata = {
  title: 'Офферы компании | EATLYY',
  robots: { index: false, follow: false },
};

export default function CompanyOffersPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 680 }}>
        <CompanyOffersClient botUsername={botUsername} />
      </div>
    </section>
  );
}
