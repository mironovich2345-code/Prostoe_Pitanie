import type { Metadata } from 'next';
import PaymentSuccessClient from '@/components/PaymentSuccessClient';

export const metadata: Metadata = {
  title: 'Платёж обрабатывается | EATLYY',
  robots: { index: false, follow: false },
};

export default function PaymentSuccessPage() {
  return (
    <section style={{ padding: '64px 0 96px' }}>
      <div className="container" style={{ maxWidth: 480 }}>
        <PaymentSuccessClient />
      </div>
    </section>
  );
}
