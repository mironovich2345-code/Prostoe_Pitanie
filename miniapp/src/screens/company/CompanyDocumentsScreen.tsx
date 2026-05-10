import { useNavigate } from 'react-router-dom';

const BASE = window.location.origin;

const DOCS = [
  { label: 'Пользовательское соглашение',              url: `${BASE}/legal/terms` },
  { label: 'Политика конфиденциальности',               url: `${BASE}/legal/privacy` },
  { label: 'Согласие на обработку персональных данных', url: `${BASE}/legal/personal-data` },
  { label: 'Условия подписки и автопродления',          url: `${BASE}/legal/subscription` },
  { label: 'Отказ от медицинской ответственности',      url: `${BASE}/legal/medical-disclaimer` },
  { label: 'Согласие на получение уведомлений',         url: `${BASE}/legal/notifications` },
];

export default function CompanyDocumentsScreen() {
  const navigate = useNavigate();

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 24 }}>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>
          <span style={{ color: 'var(--text)' }}>EATL</span>
          <span style={{ color: 'var(--accent)' }}>YY</span>
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Company</span>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {DOCS.map((doc, i) => (
          <a
            key={doc.label}
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: i < DOCS.length - 1 ? '1px solid var(--border)' : 'none',
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>{doc.label}</span>
            <span style={{ color: 'var(--text-3)', fontSize: 16 }}>›</span>
          </a>
        ))}
      </div>
    </div>
  );
}
