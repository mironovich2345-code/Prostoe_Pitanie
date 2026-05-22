import type { Metadata } from 'next';
import AdminRequestsClient from '@/components/AdminRequestsClient';

export const metadata: Metadata = {
  title: 'Запросы | Admin | EATLYY',
  robots: { index: false, follow: false },
};

export default function AdminRequestsPage() {
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <AdminRequestsClient />
      </div>
    </section>
  );
}
