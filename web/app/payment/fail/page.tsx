import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Оплата не завершена | EATLYY',
  robots: { index: false, follow: false },
};

export default function PaymentFailPage() {
  return (
    <section style={{ padding: '64px 0 96px' }}>
      <div className="container" style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(239,83,80,0.10)', border: '1px solid rgba(239,83,80,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', color: '#ef5350',
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M6 6l10 10M16 6L6 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 10 }}>
          Оплата не завершена
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 32, maxWidth: 360, margin: '0 auto 32px' }}>
          Платёж не прошёл или был отменён. Попробуйте снова или выберите другой способ оплаты.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <Link href="/subscription" style={{
            padding: '11px 28px', background: 'var(--accent)', border: 'none',
            borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#000', textDecoration: 'none',
          }}>
            Попробовать снова
          </Link>
          <Link href="/client" style={{
            padding: '11px 28px', background: 'none', border: '1px solid var(--border-2)',
            borderRadius: 10, fontSize: 14, fontWeight: 600,
            color: 'var(--text-2)', textDecoration: 'none',
          }}>
            В личный кабинет
          </Link>
        </div>
      </div>
    </section>
  );
}
