import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../ui';

const BASE = window.location.origin;

const DOCS = [
  { label: 'Пользовательское соглашение',              url: `${BASE}/legal/terms` },
  { label: 'Политика конфиденциальности',               url: `${BASE}/legal/privacy` },
  { label: 'Согласие на обработку персональных данных', url: `${BASE}/legal/personal-data` },
  { label: 'Условия подписки и автопродления',          url: `${BASE}/legal/subscription` },
  { label: 'Отказ от медицинской ответственности',      url: `${BASE}/legal/medical-disclaimer` },
  { label: 'Согласие на получение уведомлений',         url: `${BASE}/legal/notifications` },
];

export default function DocumentsScreen() {
  const navigate = useNavigate();

  return (
    <div className="screen">
      <PageHeader title="Документы" onBack={() => navigate('/profile')} />

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
            <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500, lineHeight: 1.4, flex: 1, marginRight: 8 }}>{doc.label}</span>
            <span style={{ color: 'var(--text-3)', fontSize: 16, flexShrink: 0 }}>›</span>
          </a>
        ))}
      </div>
    </div>
  );
}
