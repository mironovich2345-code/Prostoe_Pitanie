import type { Metadata } from 'next';
import CompanyProfileClient from '@/components/CompanyProfileClient';

export const metadata: Metadata = {
  title: 'Профиль компании | EATLYY',
  robots: { index: false, follow: false },
};

export default function CompanyProfilePage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 680 }}>
        <CompanyProfileClient botUsername={botUsername} />
      </div>
    </section>
  );
}
