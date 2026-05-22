import type { Metadata } from 'next';
import AdminApplicationsClient from '@/components/AdminApplicationsClient';

export const metadata: Metadata = {
  title: 'Заявки экспертов | Admin | EATLYY',
  robots: { index: false, follow: false },
};

export default function AdminApplicationsPage() {
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <AdminApplicationsClient />
      </div>
    </section>
  );
}
