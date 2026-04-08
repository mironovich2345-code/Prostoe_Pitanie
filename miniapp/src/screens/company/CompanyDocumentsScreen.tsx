import { useNavigate } from 'react-router-dom';

const DOCS = [
  { label: 'Политика конфиденциальности', url: 'https://eatlyy.ru/privacy' },
  { label: 'Пользовательское соглашение', url: 'https://eatlyy.ru/terms' },
  { label: 'Публичная оферта',            url: 'https://eatlyy.ru/offer' },
  { label: 'Договор для партнёров',       url: 'https://eatlyy.ru/partner-agreement' },
];

export default function CompanyDocumentsScreen() {
  const navigate = useNavigate();

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >‹</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Документы</div>
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
