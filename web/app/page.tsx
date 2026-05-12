import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'EATLYY — Питание под контролем',
  description:
    'EATLYY — платформа для контроля питания с персональным нутрициологом. Дневник, КБЖУ, эксперт рядом.',
  openGraph: {
    title: 'EATLYY — Питание под контролем',
    description: 'Ведите дневник питания, считайте КБЖУ и работайте с персональным нутрициологом.',
    url: '/',
  },
  twitter: {
    title: 'EATLYY — Питание под контролем',
    description: 'Ведите дневник питания, считайте КБЖУ и работайте с персональным нутрициологом.',
  },
};

const TG_BOT = process.env.NEXT_PUBLIC_BOT_URL ?? 'https://t.me/EATLYY_bot';

const FEATURES = [
  {
    label: 'Анализ питания',
    desc: 'Добавляйте еду текстом, фото или голосом — EATLYY автоматически считает КБЖУ и строит картину рациона.',
  },
  {
    label: 'Персональный нутрициолог',
    desc: 'Подключите эксперта, который видит ваш дневник в реальном времени и помогает держать курс на результат.',
  },
  {
    label: 'Дневник и прогресс',
    desc: 'Дневник питания, история веса, статистика макронутриентов — всё в одном месте, всегда под рукой.',
  },
];

const STATS = [
  { value: '6+',   label: 'экспертов на платформе' },
  { value: '200+', label: 'довольных клиентов' },
  { value: '4.9',  label: 'средняя оценка экспертов' },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <section style={{ padding: '100px 0 80px', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div style={{
            display: 'inline-block',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(215,255,63,0.2)',
            color: 'var(--accent)',
            fontSize: 12, fontWeight: 700, letterSpacing: 1.2,
            textTransform: 'uppercase',
            padding: '5px 14px', borderRadius: 20,
            marginBottom: 28,
          }}>
            Платформа для контроля питания
          </div>

          <h1 style={{
            fontSize: 'clamp(44px, 8vw, 80px)',
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.0,
            marginBottom: 24,
          }}>
            Питание.<br />
            <span style={{ color: 'var(--accent)' }}>Под контролем.</span>
          </h1>

          <p style={{
            fontSize: 18, color: 'var(--text-2)', lineHeight: 1.65,
            maxWidth: 560, margin: '0 auto 40px',
          }}>
            Считайте КБЖУ, ведите дневник питания и работайте с персональным нутрициологом —
            всё в одном месте, без лишних усилий.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="btn btn-accent"
              style={{ fontSize: 16, padding: '16px 32px' }}>
              Начать в Telegram
            </a>
            <Link href="/trainers" className="btn btn-outline"
              style={{ fontSize: 16, padding: '16px 32px' }}>
              Найти эксперта
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ padding: '0 0 80px' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 1,
            background: 'var(--border)',
            borderRadius: 'var(--r-xl)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
          }}>
            {STATS.map(({ value, label }) => (
              <div key={label} style={{
                background: 'var(--surface)',
                padding: '32px 28px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 42, fontWeight: 900, letterSpacing: -1.5,
                  color: 'var(--accent)', lineHeight: 1, marginBottom: 6,
                }}>
                  {value}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section" style={{ background: 'var(--surface)' }}>
        <div className="container">
          <h2 style={{
            fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800,
            letterSpacing: -1, marginBottom: 48, textAlign: 'center',
          }}>
            Как работает EATLYY
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {FEATURES.map(({ label, desc }, i) => (
              <div key={label} style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '28px 24px',
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 800, color: 'var(--accent)',
                  letterSpacing: 0.5, marginBottom: 14,
                }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginBottom: 10 }}>
                  {label}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Experts CTA ── */}
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800,
            letterSpacing: -1, marginBottom: 16,
          }}>
            Работайте с лучшими
          </h2>
          <p style={{
            fontSize: 17, color: 'var(--text-2)', lineHeight: 1.6,
            maxWidth: 480, margin: '0 auto 36px',
          }}>
            В EATLYY работают проверенные нутрициологи и диетологи.
            Найдите специалиста, который подходит именно вам.
          </p>
          <Link href="/trainers" className="btn btn-accent" style={{ fontSize: 16, padding: '16px 36px' }}>
            Посмотреть экспертов
          </Link>
        </div>
      </section>

      {/* ── Pricing teaser ── */}
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800,
            letterSpacing: -1, marginBottom: 12,
          }}>
            Тарифы для любого старта
          </h2>
          <p style={{
            fontSize: 17, color: 'var(--text-2)', lineHeight: 1.6,
            maxWidth: 480, margin: '0 auto 48px',
          }}>
            Free навсегда, или Pro с экспертом — первые 3 дня всего за 1 ₽.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, marginBottom: 36,
          }}>
            {[
              { name: 'Free', price: '0 ₽', desc: 'Дневник питания, ввод КБЖУ, история за 7 дней.', accent: false },
              { name: 'Оптимальный', price: '399 ₽/мес', desc: 'Анализ фото и голоса, полная история, статистика.', accent: false },
              { name: 'Pro', price: '499 ₽/мес', desc: 'Всё + персональный нутрициолог рядом.', accent: true },
            ].map(({ name, price, desc, accent }) => (
              <div key={name} style={{
                background: accent ? 'var(--accent)' : 'var(--surface)',
                border: accent ? '2px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '24px 22px',
                textAlign: 'left',
                color: accent ? '#0A0A0A' : 'inherit',
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6,
                  textTransform: 'uppercase',
                  color: accent ? 'rgba(10,10,10,0.55)' : 'var(--text-3)',
                }}>
                  {name}
                </div>
                <div style={{
                  fontSize: 28, fontWeight: 900, letterSpacing: -0.8, marginBottom: 8,
                  color: accent ? '#0A0A0A' : 'var(--text)',
                }}>
                  {price}
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.55, color: accent ? 'rgba(10,10,10,0.7)' : 'var(--text-2)' }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="btn btn-outline" style={{ fontSize: 15, padding: '13px 28px' }}>
            Подробнее о тарифах
          </Link>
        </div>
      </section>

      {/* ── For whom ── */}
      <section className="section" style={{ background: 'var(--surface)', paddingTop: 64, paddingBottom: 64 }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {[
              {
                title: 'Клиентам',
                desc: 'Контролируйте питание, ищите экспертов и двигайтесь к цели с поддержкой.',
                href: '/clients',
                cta: 'Узнать больше',
              },
              {
                title: 'Экспертам',
                desc: 'Ведите клиентов через платформу, получайте оплату и стройте практику онлайн.',
                href: '/experts',
                cta: 'Стать экспертом',
              },
            ].map(({ title, desc, href, cta }) => (
              <div key={title} style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '32px 28px',
                display: 'flex', flexDirection: 'column', gap: 16,
              }}>
                <h3 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, flex: 1 }}>{desc}</p>
                <Link href={href} className="btn btn-outline" style={{ alignSelf: 'flex-start', padding: '10px 20px', fontSize: 14 }}>
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
