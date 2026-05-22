import type { Metadata } from 'next';
import AdminUsersClient from '@/components/AdminUsersClient';

export const metadata: Metadata = {
  title: 'Пользователи | Admin | EATLYY',
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return (
    <section style={{ padding: '48px 0 96px' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <AdminUsersClient />
      </div>
    </section>
  );
}
