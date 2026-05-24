import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Для экспертов',
  description:
    'Ведите клиентов, отслеживайте их дневники и зарабатывайте на реферальной программе EATLYY. Присоединяйтесь как нутрициолог.',
  openGraph: {
    title: 'Для экспертов | EATLYY',
    description: 'Ведите клиентов через платформу и стройте практику онлайн с EATLYY.',
    url: '/experts',
  },
  twitter: {
    title: 'Для экспертов | EATLYY',
    description: 'Ведите клиентов через платформу и стройте практику онлайн с EATLYY.',
  },
};

const TG_BOT = process.env.NEXT_PUBLIC_BOT_URL ?? 'https://t.me/EATLYY_bot';

const BENEFITS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="7.5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 17c0-3.038 2.462-5.5 5.5-5.5S13 13.962 13 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="14.5" cy="6" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M14.5 11c2.2.4 3.5 2 3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Клиенты, которые уже мотивированы',
    desc: 'В EATLYY приходят люди, которые уже ведут дневник питания и готовы работать с экспертом.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="2.5" width="14" height="15" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6.5 7h7M6.5 10h7M6.5 13h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Дневник клиента в реальном времени',
    desc: 'Вы видите все приёмы пищи клиента, можете оценивать их и оставлять комментарии прямо в приложении.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H7.5L3 17V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M7 8.5h6M7 11h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Коммуникация внутри платформы',
    desc: 'Все взаимодействия с клиентами — в одном месте. Не нужно переключаться между мессенджерами.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 5.5v1.75m0 5.5v1.75M7.5 12.2c.35.9 1.2 1.5 2.5 1.5s2.3-.65 2.3-1.9c0-1.1-.9-1.5-2.3-2s-2.3-.75-2.3-2c0-1.1.9-1.8 2.3-1.8s2.15.6 2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Реферальный доход',
    desc: 'Приводите клиентов на платформу и получайте процент с их подписки — пока они остаются активными.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 6.5v3.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6.5 4.5l1 1M13.5 4.5l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Публичный профиль',
    desc: 'Ваши специализация, опыт и отзывы клиентов видны на сайте — новые клиенты находят вас сами.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H7.5L3 17V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="7.5" cy="8.5" r="1" fill="currentColor"/>
        <circle cx="10" cy="8.5" r="1" fill="currentColor"/>
        <circle cx="12.5" cy="8.5" r="1" fill="currentColor"/>
      </svg>
    ),
    title: 'Работа из Telegram',
    desc: 'Не нужно устанавливать отдельные приложения — всё работает в привычном мессенджере.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Подайте заявку',
    desc: 'Заполните форму в приложении: специализация, опыт, документы. Рассмотрим в течение 1–2 рабочих дней.',
  },
  {
    step: '02',
    title: 'Пройдите верификацию',
    desc: 'Команда EATLYY проверит документы и подтвердит профессиональный статус.',
  },
  {
    step: '03',
    title: 'Начните работать',
    desc: 'Принимайте клиентов, ведите их дневники и зарабатывайте на реферальной программе.',
  },
];

export default function ExpertsPage() {
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
            Для экспертов
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900,
            letterSpacing: -1.5, lineHeight: 1.05, marginBottom: 20,
          }}>
            Ведите клиентов<br />
            <span style={{ color: 'var(--accent)' }}>на одной платформе</span>
          </h1>
          <p style={{
            fontSize: 18, color: 'var(--text-2)', lineHeight: 1.65,
            marginBottom: 36, maxWidth: 560,
          }}>
            EATLYY — инструмент для нутрициологов и диетологов, которые хотят работать
            эффективно и масштабировать практику.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/experts/apply" className="btn btn-accent"
              style={{ fontSize: 15, padding: '14px 32px' }}>
              Подать заявку
            </Link>
            <Link href="/trainers" className="btn btn-ghost"
              style={{ fontSize: 15, padding: '14px 24px' }}>
              Смотреть каталог
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section" style={{ background: 'var(--surface)' }}>
        <div className="container">
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 40, textAlign: 'center',
          }}>
            Почему EATLYY
          </h2>
          <div className="grid-6">
            {BENEFITS.map(({ icon, title, desc }) => (
              <div key={title} style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '24px 20px',
                background: 'var(--surface-2)',
              }}>
                <div style={{
                  width: 40, height: 40,
                  background: 'var(--accent-dim)',
                  border: '1px solid rgba(215,255,63,0.12)',
                  borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent)', marginBottom: 16,
                }}>
                  {icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="section">
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 40, textAlign: 'center',
          }}>
            Как стать экспертом
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}>
            {STEPS.map(({ step, title, desc }) => (
              <div key={step} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '28px 24px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: 'var(--accent)',
                  letterSpacing: 0.8, marginBottom: 14,
                }}>
                  {step}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <Link href="/experts/apply" className="btn btn-accent"
              style={{ fontSize: 15, padding: '14px 36px' }}>
              Подать заявку
            </Link>
          </div>
        </div>
      </section>

      {/* Expert + Pro */}
      <section className="section" style={{ background: 'var(--surface)' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 12, textAlign: 'center',
          }}>
            Эксперт доступен на тарифе Pro
          </h2>
          <p style={{
            fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6,
            textAlign: 'center', maxWidth: 480, margin: '0 auto 40px',
          }}>
            Клиент подключает вас через подписку Pro. Вы получаете доступ к его дневнику
            и начинаете работу сразу.
          </p>
          <div className="grid-2" style={{ gap: 12, marginBottom: 32 }}>
            {[
              { step: '01', title: 'Клиент оформляет Pro', desc: 'Подписка от 499 ₽/мес или 3 дня за 1 ₽ для старта.' },
              { step: '02', title: 'Выбирает вас в каталоге', desc: 'Ваш профиль виден всем пользователям платформы.' },
              { step: '03', title: 'Вы получаете доступ', desc: 'Дневник питания клиента открывается вам в реальном времени.' },
              { step: '04', title: 'Вы зарабатываете', desc: 'Реферальный процент с активной подписки клиента.' },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '22px 20px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: 'var(--accent)',
                  letterSpacing: 0.8, marginBottom: 10,
                }}>{step}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>{desc}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <Link href="/pricing" className="btn btn-outline" style={{ fontSize: 14, padding: '12px 24px' }}>
              Смотреть тарифы для клиентов
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '72px 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 520 }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, marginBottom: 14 }}>
            Готовы присоединиться?
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 28 }}>
            Посмотрите каталог — именно так будет выглядеть ваш профиль на платформе.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/experts/apply" className="btn btn-accent"
              style={{ fontSize: 15, padding: '14px 32px' }}>
              Подать заявку
            </Link>
            <Link href="/trainers" className="btn btn-outline" style={{ fontSize: 15, padding: '14px 28px' }}>
              Смотреть каталог
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
