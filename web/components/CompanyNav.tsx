import Link from 'next/link';

type NavKey = 'overview' | 'profile' | 'offers' | 'stats';

const NAV_ITEMS: { key: NavKey | 'support'; label: string; href: string }[] = [
  { key: 'overview', label: 'Обзор',      href: '/company' },
  { key: 'profile',  label: 'Профиль',    href: '/company/profile' },
  { key: 'offers',   label: 'Офферы',     href: '/company/offers' },
  { key: 'stats',    label: 'Статистика', href: '/company/stats' },
  { key: 'support',  label: 'Поддержка',  href: '/support' },
];

export default function CompanyNav({ active }: { active: NavKey | 'support' }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4, whiteSpace: 'nowrap' }}>
      {NAV_ITEMS.map(item =>
        item.key === active ? (
          <span key={item.key} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
            {item.label}
          </span>
        ) : (
          <Link key={item.key} href={item.href} style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
            {item.label}
          </Link>
        )
      )}
    </div>
  );
}
