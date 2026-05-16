import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getExperts, getExpertBySlug } from '@/lib/api';
import TrainerRequestClient from '@/components/TrainerRequestClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const experts = await getExperts();
  return experts.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const expert = await getExpertBySlug(slug);
  if (!expert) return { title: 'Эксперт не найден' };
  const name = expert.fullName ?? 'Эксперт';
  const desc = expert.bio ? expert.bio.substring(0, 160) : undefined;
  return {
    title: `${name} — ${expert.specialization ?? 'Эксперт'}`,
    description: desc,
    openGraph: {
      title: `${name} — ${expert.specialization ?? 'Эксперт'} | EATLYY`,
      description: desc,
      url: `/trainers/${slug}`,
    },
    twitter: {
      title: `${name} — ${expert.specialization ?? 'Эксперт'} | EATLYY`,
      description: desc,
    },
  };
}

export default async function TrainerPage({ params }: Props) {
  const { slug } = await params;
  const expert = await getExpertBySlug(slug);
  if (!expert) notFound();

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'EATLYY_bot';

  const tags = expert.tags ? expert.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const forWhomItems = expert.suitableFor
    ? expert.suitableFor.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <>
      {/* Back */}
      <div style={{ padding: '20px 0 0' }}>
        <div className="container">
          <Link href="/trainers" style={{
            fontSize: 14, color: 'var(--text-3)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            transition: 'color 0.15s',
          }}>
            ← Все эксперты
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section style={{ padding: '40px 0 56px' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          {/* Avatar + name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'var(--surface)',
              border: '1px solid var(--border-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 40, flexShrink: 0,
            }}>
              🥗
            </div>
            <div>
              <h1 style={{
                fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900,
                letterSpacing: -0.8, lineHeight: 1.1, marginBottom: 4,
              }}>
                {expert.fullName ?? 'Эксперт'}
              </h1>
              {expert.specialization && (
                <div style={{ fontSize: 16, color: 'var(--accent)', fontWeight: 600 }}>
                  {expert.specialization}
                </div>
              )}
            </div>
          </div>

          {/* Meta row */}
          {(expert.city || expert.experienceYears != null) && (
            <div style={{
              display: 'flex', gap: 20, flexWrap: 'wrap',
              padding: '16px 20px',
              background: 'var(--surface)',
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border)',
              marginBottom: 32,
            }}>
              {expert.city && <MetaChip icon="📍" label={expert.city} />}
              {expert.experienceYears != null && (
                <MetaChip icon="⏱" label={`${expert.experienceYears} лет опыта`} />
              )}
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 40 }}>
              {tags.map((tag) => (
                <span key={tag} style={{
                  fontSize: 13, fontWeight: 600,
                  background: 'var(--accent-dim)',
                  border: '1px solid rgba(215,255,63,0.2)',
                  color: 'var(--accent)',
                  borderRadius: 8, padding: '5px 14px',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Bio */}
          {expert.bio && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl)',
              padding: '28px 24px',
              marginBottom: 24,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>О себе</h2>
              <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.75 }}>
                {expert.bio}
              </p>
            </div>
          )}

          {/* For whom */}
          {forWhomItems.length > 0 && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl)',
              padding: '28px 24px',
              marginBottom: 36,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>Кому подходит</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {forWhomItems.map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--accent)', flexShrink: 0, marginTop: 7,
                    }} />
                    <span style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6 }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA — dynamic request flow */}
          <TrainerRequestClient trainerSlug={slug} botUsername={botUsername} />

          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Link href="/trainers" style={{ fontSize: 13, color: 'var(--text-3)' }}>
              ← Смотреть других экспертов
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function MetaChip({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
    </div>
  );
}
