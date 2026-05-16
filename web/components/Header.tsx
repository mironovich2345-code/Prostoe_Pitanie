'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV: { href: string; label: string; prefetch?: false }[] = [
  { href: '/clients',  label: 'Клиентам' },
  { href: '/experts',  label: 'Для экспертов' },
  // prefetch=false: the catalog is ISR-backed — prefetching caches a stale RSC
  // payload in the browser, causing the first click to show old data until refresh.
  { href: '/trainers', label: 'Каталог', prefetch: false },
  { href: '/pricing',  label: 'Тарифы' },
  { href: '/support',  label: 'Поддержка' },
];

const TG_BOT = process.env.NEXT_PUBLIC_BOT_URL ?? 'https://t.me/EATLYY_bot';

export default function Header() {
  const pathname = usePathname();

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(10,10,10,0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div className="container" style={{
        display: 'flex', alignItems: 'center',
        height: 60, gap: 0,
      }}>
        {/* Logo */}
        <Link href="/" style={{
          fontSize: 18, fontWeight: 900, letterSpacing: -0.6,
          color: 'var(--text)', marginRight: 48, flexShrink: 0,
        }}>
          EAT<span style={{ color: 'var(--accent)' }}>LYY</span>
        </Link>

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: 4, flex: 1, alignItems: 'center' }}>
          {NAV.map(({ href, label, prefetch }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                prefetch={prefetch}
                style={{
                  padding: '6px 14px',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--text)' : 'var(--text-2)',
                  borderRadius: 'var(--r-sm)',
                  background: active ? 'var(--surface-2)' : 'transparent',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* CTA */}
        <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="btn btn-accent"
          style={{ padding: '8px 18px', fontSize: 13, borderRadius: 'var(--r-md)' }}>
          Открыть в Telegram
        </a>
      </div>
    </header>
  );
}
