import Link from 'next/link';
import type { PublicTrainer } from '@/lib/api';

export default function ExpertCard({ expert }: { expert: PublicTrainer }) {
  const tags = expert.tags ? expert.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const shortBio = expert.bio
    ? expert.bio.length > 150 ? expert.bio.substring(0, 150) + '…' : expert.bio
    : '';

  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8.5" r="4" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
            <path d="M4 22c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, marginBottom: 3 }}>
            {expert.fullName ?? 'Эксперт'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            {expert.specialization}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {expert.city && <MetaItem type="pin" label={expert.city} />}
        {expert.experienceYears != null && <MetaItem type="clock" label={`${expert.experienceYears} лет опыта`} />}
      </div>

      {/* Short bio */}
      {shortBio && (
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, flexGrow: 1 }}>
          {shortBio}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 6, padding: '3px 10px',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      <Link
        href={`/trainers/${expert.slug}`}
        className="btn btn-outline"
        style={{ width: '100%', borderRadius: 'var(--r-md)', fontSize: 14, padding: '11px 16px' }}
      >
        Подробнее
      </Link>
    </div>
  );
}

function MetaItem({ type, label }: { type: 'pin' | 'clock'; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {type === 'pin' ? (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
          <path d="M6.5 1a3.5 3.5 0 0 0-3.5 3.5c0 3.25 3.5 7.5 3.5 7.5S10 7.75 10 4.5A3.5 3.5 0 0 0 6.5 1z" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/>
          <circle cx="6.5" cy="4.5" r="1.25" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="6.5" cy="6.5" r="5.25" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/>
          <path d="M6.5 4V6.5L8 8" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      )}
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
    </div>
  );
}
