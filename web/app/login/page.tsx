import type { Metadata } from 'next';
import LoginClient from '@/components/LoginClient';

export const metadata: Metadata = {
  title: 'Войти | EATLYY',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 480 }}>
        <LoginClient botUsername={botUsername} />
      </div>
    </section>
  );
}
