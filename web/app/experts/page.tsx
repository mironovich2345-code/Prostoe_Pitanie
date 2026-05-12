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
    icon: '👥',
    title: 'Клиенты, которые уже мотивированы',
    desc: 'В EATLYY приходят люди, которые уже ведут дневник питания и готовы работать с экспертом.',
  },
  {
    icon: '📊',
    title: 'Дневник клиента в реальном времени',
    desc: 'Вы видите все приёмы пищи клиента, можете оценивать их и оставлять комментарии прямо в приложении.',
  },
  {
    icon: '💬',
    title: 'Коммуникация внутри платформы',
    desc: 'Все взаимодействия с клиентами — в одном месте. Не нужно переключаться между мессенджерами.',
  },
  {
    icon: '💰',
    title: 'Реферальный доход',
    desc: 'Приводите клиентов на платформу и получайте процент с их подписки — пока они остаются активными.',
  },
  {
    icon: '🏆',
    title: 'Публичный профиль',
    desc: 'Ваши специализация, опыт и отзывы клиентов видны на сайте — новые клиенты находят вас сами.',
  },
  {
    icon: '📱',
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
            EATLYY — это инструмент для нутрициологов и диетологов, которые хотят работать
            эффективно и масштабировать практику.
          </p>
          <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="btn btn-accent"
            style={{ fontSize: 15, padding: '14px 32px' }}>
            Подать заявку
          </a>
        </div>
      </section>

      {/* Benefits */}
      <section className="section" style={{ background: 'var(--surface)' }}>
        <div className="container">
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 48, textAlign: 'center',
          }}>
            Почему EATLYY
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
                padding: '24px 22px',
                background: 'var(--surface-2)',
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="section">
        <div className="container">
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 48, textAlign: 'center',
          }}>
            Как стать экспертом
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}>
            {STEPS.map(({ step, title, desc }) => (
              <div key={step} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '28px 24px',
                position: 'relative',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: 'var(--accent)',
                  letterSpacing: 0.8, marginBottom: 14,
                }}>
                  {step}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catalog CTA */}
      <section style={{
        padding: '64px 0',
        background: 'var(--surface)',
        textAlign: 'center',
      }}>
        <div className="container" style={{ maxWidth: 520 }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, marginBottom: 14 }}>
            Смотрите, как выглядят профили
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 28 }}>
            Посмотрите каталог экспертов — именно так будет выглядеть ваш профиль на платформе.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/trainers" className="btn btn-outline" style={{ fontSize: 15, padding: '14px 28px' }}>
              Смотреть каталог
            </Link>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="btn btn-accent"
              style={{ fontSize: 15, padding: '14px 28px' }}>
              Подать заявку
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
