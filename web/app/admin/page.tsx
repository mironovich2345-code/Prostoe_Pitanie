import type { Metadata } from 'next';
import AdminDashboardClient from '@/components/AdminDashboardClient';

export const metadata: Metadata = {
  title: 'Администрирование | EATLYY',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <AdminDashboardClient botUsername={botUsername} />
      </div>
    </section>
  );
}
