import type { Metadata } from 'next';
import Link from 'next/link';
import ExpertCard from '@/components/ExpertCard';
import { getExperts } from '@/lib/api';

// force-dynamic: every request fetches fresh data from the API.
// This prevents stale build-time snapshots (which could contain mock experts
// if the API was unreachable during Railway build) from ever being served.
export const dynamic = 'force-dynamic';

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
  const few = experts.length > 0 && experts.length <= 3;

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

          {experts.length === 0 && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl)',
              padding: '56px 32px',
              textAlign: 'center',
              maxWidth: 560, margin: '0 auto',
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: 'var(--accent-dim)',
                border: '1px solid rgba(215,255,63,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', color: 'var(--accent)',
              }}>
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <circle cx="10" cy="9" r="4.5" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M3 23c0-3.866 3.134-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <circle cx="19" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M19 14c2.76.5 4.5 2.5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, letterSpacing: -0.4 }}>
                Каталог пополняется
              </h2>
              <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.65, marginBottom: 28 }}>
                Все эксперты проходят ручную верификацию команды EATLYY.
                Скоро здесь появятся специалисты.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/experts/apply" className="btn btn-accent" style={{ fontSize: 14, padding: '12px 24px' }}>
                  Стать экспертом
                </Link>
                <a
                  href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot'}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-ghost"
                  style={{ fontSize: 14, padding: '12px 22px' }}
                >
                  Открыть EATLYY
                </a>
              </div>
            </div>
          )}

          {experts.length > 0 && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: few
                  ? `repeat(${Math.min(experts.length, 2)}, minmax(0, 380px))`
                  : 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16,
                justifyContent: few ? 'center' : undefined,
              }}>
                {experts.map((expert) => (
                  <ExpertCard key={expert.slug} expert={expert} />
                ))}
              </div>

              {few && (
                <div style={{
                  maxWidth: 560, margin: '32px auto 0',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-xl)',
                  padding: '24px 28px',
                  display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: 0.8, color: 'var(--accent)', marginBottom: 6,
                    }}>
                      Каталог пополняется
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
                      Все эксперты проходят ручную проверку. Хотите войти в каталог?
                    </p>
                  </div>
                  <Link href="/experts/apply" className="btn btn-outline"
                    style={{ fontSize: 13, padding: '10px 20px', flexShrink: 0 }}>
                    Стать экспертом
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
