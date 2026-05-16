import type { Metadata } from 'next';
import ExpertProfileClient from '@/components/ExpertProfileClient';

export const metadata: Metadata = {
  title: 'Профиль эксперта EATLYY',
  description: 'Управляйте своей публичной карточкой эксперта EATLYY.',
  robots: { index: false, follow: false },
};

export default function ExpertProfilePage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';
  return (
    <>
      <section style={{ padding: '72px 0 40px' }}>
        <div className="container" style={{ maxWidth: 680 }}>
          <div style={{
            display: 'inline-block',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(215,255,63,0.2)',
            color: 'var(--accent)',
            fontSize: 12, fontWeight: 700, letterSpacing: 1.2,
            textTransform: 'uppercase',
            padding: '5px 14px', borderRadius: 20, marginBottom: 20,
          }}>
            Кабинет эксперта
          </div>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900,
            letterSpacing: -1, lineHeight: 1.08, marginBottom: 12,
          }}>
            Профиль эксперта
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 40, maxWidth: 520 }}>
            Заполните данные — они будут отображаться в вашей публичной карточке каталога.
          </p>

          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)',
            padding: '32px 28px',
          }}>
            <ExpertProfileClient botUsername={botUsername} />
          </div>
        </div>
      </section>
    </>
  );
}
