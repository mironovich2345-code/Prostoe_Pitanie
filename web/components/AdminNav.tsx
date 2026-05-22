'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin',              label: 'Обзор' },
  { href: '/admin/users',        label: 'Пользователи' },
  { href: '/admin/experts',      label: 'Эксперты' },
  { href: '/admin/applications', label: 'Заявки' },
  { href: '/admin/requests',     label: 'Запросы' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
      {NAV_ITEMS.map(item => {
        const active = item.href === '/admin'
          ? pathname === '/admin'
          : pathname.startsWith(item.href);
        return active ? (
          <span key={item.href} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
            {item.label}
          </span>
        ) : (
          <Link key={item.href} href={item.href} style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
