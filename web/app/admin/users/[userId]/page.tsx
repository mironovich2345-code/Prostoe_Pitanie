import type { Metadata } from 'next';
import AdminUserCardClient from '@/components/AdminUserCardClient';

export const metadata: Metadata = {
  title: 'Пользователь | Admin | EATLYY',
  robots: { index: false, follow: false },
};

export default async function AdminUserCardPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <AdminUserCardClient userId={userId} />
      </div>
    </section>
  );
}
