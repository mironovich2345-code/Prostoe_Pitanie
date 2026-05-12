import Link from 'next/link';

const LEGAL_LINKS = [
  { href: '/legal', label: 'Документы' },
  { href: '/support', label: 'Поддержка' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--bg)',
      padding: '40px 0 32px',
    }}>
      <div className="container">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
        }}>
          {/* Logo + tagline */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.4, marginBottom: 4 }}>
              EAT<span style={{ color: 'var(--accent)' }}>LYY</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Питание под контролем
            </div>
          </div>

          {/* Links */}
          <nav style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {LEGAL_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{ fontSize: 13, color: 'var(--text-3)', transition: 'color 0.15s' }}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Copyright */}
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            © {year} EATLYY
          </div>
        </div>
      </div>
    </footer>
  );
}
