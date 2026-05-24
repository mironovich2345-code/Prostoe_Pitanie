import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Поддержка',
  description: 'Частые вопросы и контакты поддержки EATLYY. Ответим в Telegram.',
  openGraph: {
    title: 'Поддержка | EATLYY',
    description: 'Частые вопросы и контакты поддержки EATLYY.',
    url: '/support',
  },
  twitter: {
    title: 'Поддержка | EATLYY',
    description: 'Частые вопросы и контакты поддержки EATLYY.',
  },
};

const TG_BOT     = process.env.NEXT_PUBLIC_BOT_URL     ?? 'https://t.me/EATLYY_bot';
const TG_SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_URL ?? 'https://t.me/EATLYY_help';

const FAQ = [
  {
    q: 'Как начать пользоваться EATLYY?',
    a: 'Откройте бот @EATLYY_bot в Telegram, нажмите /start и следуйте инструкциям. На настройку профиля уйдёт около 2 минут.',
  },
  {
    q: 'Как подключить нутрициолога?',
    a: 'После регистрации перейдите в раздел «Эксперт» внутри приложения. Там вы найдёте каталог и сможете выбрать подходящего специалиста.',
  },
  {
    q: 'Как отменить подписку или автопродление?',
    a: 'Откройте раздел «Подписка» в мини-приложении EATLYY. Там есть кнопка отключения автопродления. Текущий оплаченный период сохраняется.',
  },
  {
    q: 'Что делать, если оплата не прошла?',
    a: 'Попробуйте снова через несколько минут. Если проблема не решилась — напишите в поддержку, мы разберёмся.',
  },
  {
    q: 'Могу ли я стать экспертом на платформе?',
    a: 'Да. Подайте заявку через приложение EATLYY — команда рассмотрит её в течение 1–2 рабочих дней.',
  },
  {
    q: 'Безопасны ли мои данные?',
    a: 'Мы храним данные на защищённых серверах и не передаём их третьим лицам без вашего согласия. Подробнее — в Политике конфиденциальности.',
  },
  {
    q: 'На каких платформах работает EATLYY?',
    a: 'Сейчас EATLYY работает в Telegram (бот + мини-приложение) и в мессенджере MAX. Веб-версия находится в разработке.',
  },
];

export default function SupportPage() {
  return (
    <section style={{ padding: '72px 0 96px' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        {/* Header */}
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900,
          letterSpacing: -1, lineHeight: 1.05, marginBottom: 12,
        }}>
          Поддержка
        </h1>
        <p style={{
          fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 48,
        }}>
          Ответы на частые вопросы — ниже. Если не нашли нужное — напишите нам напрямую.
        </p>

        {/* Contact cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12, marginBottom: 56,
        }}>
          <a href={TG_SUPPORT} target="_blank" rel="noopener noreferrer" style={{
            display: 'block',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(215,255,63,0.2)',
            borderRadius: 'var(--r-xl)',
            padding: '22px 20px',
            textDecoration: 'none', color: 'inherit',
            transition: 'border-color 0.2s',
          }}>
            <div style={{
              width: 40, height: 40,
              background: 'rgba(215,255,63,0.15)',
              border: '1px solid rgba(215,255,63,0.2)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)', marginBottom: 14,
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H7.5L3 17V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M7 8.5h6M7 11h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Написать в поддержку
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              Telegram — обычно отвечаем в течение нескольких часов
            </div>
          </a>

          <a href={TG_BOT} target="_blank" rel="noopener noreferrer" style={{
            display: 'block',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)',
            padding: '22px 20px',
            textDecoration: 'none', color: 'inherit',
            transition: 'border-color 0.2s, background 0.2s',
          }}>
            <div style={{
              width: 40, height: 40,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-2)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-2)', marginBottom: 14,
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 10h6M10 7l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Открыть EATLYY
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              Перейти в бот в Telegram
            </div>
          </a>
        </div>

        {/* FAQ */}
        <h2 style={{
          fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800,
          letterSpacing: -0.5, marginBottom: 28,
        }}>
          Частые вопросы
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQ.map(({ q, a }) => (
            <div key={q} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl)',
              padding: '20px 22px',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{q}</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{a}</div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 40,
          padding: '18px 22px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6,
        }}>
          По вопросам партнёрства и размещения экспертов:{' '}
          <a href={TG_SUPPORT} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text-2)', textDecoration: 'underline' }}>
            написать в Telegram
          </a>
        </div>
      </div>
    </section>
  );
}
