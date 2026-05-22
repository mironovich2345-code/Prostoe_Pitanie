import type { Metadata } from 'next';
import AdminExpertsClient from '@/components/AdminExpertsClient';

export const metadata: Metadata = {
  title: 'Эксперты | Admin | EATLYY',
  robots: { index: false, follow: false },
};

export default function AdminExpertsPage() {
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <AdminExpertsClient />
      </div>
    </section>
  );
}
