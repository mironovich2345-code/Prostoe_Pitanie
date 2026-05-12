import type { Metadata } from 'next';
import ExpertCard from '@/components/ExpertCard';
import { getExperts } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Каталог экспертов',
  description:
    'Найдите своего нутрициолога или диетолога в каталоге EATLYY. Проверенные эксперты, реальные отзывы, онлайн и очно.',
  openGraph: {
    title: 'Каталог экспертов | EATLYY',
    description: 'Найдите своего нутрициолога. Проверенные эксперты, реальные отзывы.',
    url: '/trainers',
  },
  twitter: {
    title: 'Каталог экспертов | EATLYY',
    description: 'Найдите своего нутрициолога. Проверенные эксперты, реальные отзывы.',
  },
};

export default async function TrainersPage() {
  const experts = await getExperts();

  return (
    <>
      {/* Header */}
      <section style={{ padding: '72px 0 56px' }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <div style={{
            display: 'inline-block',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(215,255,63,0.2)',
            color: 'var(--accent)',
            fontSize: 12, fontWeight: 700, letterSpacing: 1.2,
            textTransform: 'uppercase',
            padding: '5px 14px', borderRadius: 20, marginBottom: 24,
          }}>
            Эксперты EATLYY
          </div>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 900,
            letterSpacing: -1.2, lineHeight: 1.05, marginBottom: 16,
          }}>
            Найдите своего нутрициолога
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 500 }}>
            Проверенные специалисты с реальными результатами клиентов.
            Все эксперты прошли верификацию EATLYY.
          </p>
        </div>
      </section>

      {/* Catalog grid */}
      <section style={{ padding: '0 0 96px' }}>
        <div className="container">
          {/* Trust chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 36 }}>
            {['Верифицированные эксперты', 'Реальные отзывы', 'Онлайн и очно'].map(label => (
              <div key={label} style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 20, padding: '5px 14px',
              }}>
                {label}
              </div>
            ))}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {experts.map((expert) => (
              <ExpertCard key={expert.slug} expert={expert} />
            ))}
          </div>

          {experts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)' }}>
              Эксперты появятся здесь в ближайшее время
            </div>
          )}
        </div>
      </section>
    </>
  );
}
