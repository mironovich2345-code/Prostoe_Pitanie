import type { Metadata } from 'next';
import SubscriptionPageClient from '@/components/SubscriptionPageClient';

export const metadata: Metadata = {
  title: 'Подписка | EATLYY',
  robots: { index: false, follow: false },
};

export default function SubscriptionPage() {
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 560 }}>
        <SubscriptionPageClient />
      </div>
    </section>
  );
}
