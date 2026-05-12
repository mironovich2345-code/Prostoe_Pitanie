import Link from 'next/link';
import type { Expert } from '@/data/experts';

export default function ExpertCard({ expert }: { expert: Expert }) {
  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, flexShrink: 0,
        }}>
          {expert.emoji}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, marginBottom: 3 }}>
            {expert.name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            {expert.specialization}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <MetaItem icon="📍" label={expert.city} />
        <MetaItem icon="⏱" label={`${expert.experience} лет опыта`} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)', display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {expert.rating}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
            ({expert.reviewCount})
          </span>
        </div>
      </div>

      {/* Short bio */}
      <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, flexGrow: 1 }}>
        {expert.shortBio}
      </p>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {expert.tags.map((tag) => (
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

function MetaItem({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
    </div>
  );
}
