import type { Metadata } from 'next';
import ClientDashboard from '@/components/ClientDashboard';

export const metadata: Metadata = {
  title: 'Мой кабинет | EATLYY',
  robots: { index: false, follow: false },
};

export default function ClientPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  const maxBotName  = process.env.MAX_BOT_NAME || '';
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.6, marginBottom: 28 }}>
          Мой кабинет
        </h1>
        <ClientDashboard botUsername={botUsername} maxBotName={maxBotName} />
      </div>
    </section>
  );
}
