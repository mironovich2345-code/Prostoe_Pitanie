import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Клиентам',
  description:
    'Контролируйте питание и найдите своего нутрициолога в EATLYY. Дневник КБЖУ, анализ фото и голоса, персональный эксперт.',
  openGraph: {
    title: 'Клиентам | EATLYY',
    description: 'Дневник КБЖУ, анализ фото и голоса, персональный нутрициолог — всё в одном.',
    url: '/clients',
  },
  twitter: {
    title: 'Клиентам | EATLYY',
    description: 'Дневник КБЖУ, анализ фото и голоса, персональный нутрициолог — всё в одном.',
  },
};

const TG_BOT = process.env.NEXT_PUBLIC_BOT_URL ?? 'https://t.me/EATLYY_bot';

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Откройте EATLYY',
    desc: 'Запустите приложение в Telegram, заполните профиль — рост, вес, цель. Займёт 2 минуты.',
  },
  {
    step: '02',
    title: 'Начните вести дневник',
    desc: 'Добавляйте еду текстом, фото или голосом. EATLYY автоматически считает КБЖУ.',
  },
  {
    step: '03',
    title: 'Подключите эксперта',
    desc: 'Выберите нутрициолога из каталога. Эксперт видит ваш дневник и помогает корректировать рацион.',
  },
  {
    step: '04',
    title: 'Двигайтесь к результату',
    desc: 'Следите за прогрессом в статистике, получайте рекомендации и достигайте цели стабильно.',
  },
];

const BENEFITS = [
  { icon: '📸', title: 'Фото и голос', desc: 'Сфотографируйте блюдо или скажите, что съели — КБЖУ посчитается автоматически.' },
  { icon: '📊', title: 'Полная статистика', desc: 'История питания, динамика веса, баланс макронутриентов — всё в одном месте.' },
  { icon: '🎯', title: 'Персональная цель', desc: 'Укажите желаемый вес и получите расчёт суточных калорий под ваш метаболизм.' },
  { icon: '🔔', title: 'Умные напоминания', desc: 'Настройте время напоминаний о приёмах пищи, чтобы не пропускать.' },
  { icon: '👨‍⚕️', title: 'Эксперт рядом', desc: 'Нутрициолог видит ваш дневник, оценивает приёмы и пишет комментарии.' },
  { icon: '📱', title: 'Всё в Telegram', desc: 'Не нужно отдельное приложение — EATLYY работает прямо в мессенджере.' },
];

export default function ClientsPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ padding: '88px 0 72px' }}>
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
            Для клиентов
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900,
            letterSpacing: -1.5, lineHeight: 1.05, marginBottom: 20,
          }}>
            Контроль питания,<br />который работает
          </h1>
          <p style={{
            fontSize: 18, color: 'var(--text-2)', lineHeight: 1.65,
            marginBottom: 36, maxWidth: 560,
          }}>
            EATLYY помогает вести дневник питания без рутины и найти нутрициолога,
            который поможет достичь результата.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="btn btn-accent"
              style={{ fontSize: 15, padding: '14px 28px' }}>
              Начать в Telegram
            </a>
            <Link href="/trainers" className="btn btn-outline"
              style={{ fontSize: 15, padding: '14px 28px' }}>
              Найти эксперта
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section" style={{ background: 'var(--surface)' }}>
        <div className="container">
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 48, textAlign: 'center',
          }}>
            Как это работает
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}>
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '24px 22px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: 'var(--accent)',
                  letterSpacing: 0.8, marginBottom: 12,
                }}>
                  {step}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section">
        <div className="container">
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 48, textAlign: 'center',
          }}>
            Что вы получаете
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {BENEFITS.map(({ icon, title, desc }) => (
              <div key={title} style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '22px 20px',
                background: 'var(--surface)',
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section">
        <div className="container">
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 12, textAlign: 'center',
          }}>
            Сколько стоит
          </h2>
          <p style={{
            fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6,
            textAlign: 'center', maxWidth: 440, margin: '0 auto 40px',
          }}>
            Начните с бесплатного плана — или сразу попробуйте Pro с нутрициологом.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            {[
              { name: 'Free', price: '0 ₽', period: 'навсегда', features: ['Дневник (текст)', 'Ручной КБЖУ', 'История 7 дней'], accent: false },
              { name: 'Оптимальный', price: '399 ₽', period: 'в месяц', features: ['Анализ фото/голоса', 'Полная история', 'Расширенная статистика'], accent: false },
              { name: 'Pro', price: '499 ₽', period: 'в месяц', features: ['Всё из Опт.', 'Персональный эксперт', 'Комментарии к приёмам'], accent: true },
            ].map(({ name, price, period, features, accent }) => (
              <div key={name} style={{
                background: accent ? 'var(--accent)' : 'var(--surface)',
                border: accent ? '2px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '24px 22px',
                color: accent ? '#0A0A0A' : 'inherit',
                position: 'relative',
              }}>
                {accent && (
                  <div style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: '#0A0A0A', color: 'var(--accent)',
                    fontSize: 11, fontWeight: 800, padding: '3px 14px', borderRadius: 20,
                    border: '1px solid var(--accent)', whiteSpace: 'nowrap',
                  }}>
                    3 дня за 1 ₽
                  </div>
                )}
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8,
                  textTransform: 'uppercase',
                  color: accent ? 'rgba(10,10,10,0.55)' : 'var(--text-3)',
                }}>
                  {name}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 16 }}>
                  <span style={{
                    fontSize: 32, fontWeight: 900, letterSpacing: -1,
                    color: accent ? '#0A0A0A' : 'var(--text)',
                  }}>{price}</span>
                  <span style={{ fontSize: 13, color: accent ? 'rgba(10,10,10,0.55)' : 'var(--text-3)' }}>{period}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {features.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: accent ? '#0A0A0A' : 'var(--accent)' }}>✓</span>
                      <span style={{ fontSize: 13, color: accent ? 'rgba(10,10,10,0.8)' : 'var(--text-2)' }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="btn btn-accent"
              style={{ fontSize: 15, padding: '14px 28px' }}>
              Попробовать за 1 ₽
            </a>
            <Link href="/pricing" className="btn btn-ghost" style={{ fontSize: 15, padding: '14px 24px' }}>
              Сравнить тарифы
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-sm" style={{ background: 'var(--surface)', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 520 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.8, marginBottom: 14 }}>
            Начните прямо сейчас
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 28 }}>
            Первые 3 дня Pro-доступа — за 1 ₽. Узнайте, как выглядит ваш рацион на самом деле.
          </p>
          <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="btn btn-accent"
            style={{ fontSize: 16, padding: '16px 36px' }}>
            Попробовать за 1 ₽
          </a>
        </div>
      </section>
    </>
  );
}
