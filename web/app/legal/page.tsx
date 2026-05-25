import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Документы',
  description: 'Юридические документы EATLYY: пользовательское соглашение, политика конфиденциальности, условия подписки и другие.',
  openGraph: {
    title: 'Документы | EATLYY',
    description: 'Юридические документы EATLYY.',
    url: '/legal',
  },
};

const DOCS = [
  {
    title: 'Пользовательское соглашение',
    desc: 'Правила использования сервиса EATLYY, права и обязанности пользователей.',
    href: '/legal/terms',
  },
  {
    title: 'Политика конфиденциальности',
    desc: 'Как мы собираем, используем и защищаем ваши персональные данные.',
    href: '/legal/privacy',
  },
  {
    title: 'Согласие на обработку персональных данных',
    desc: 'Форма согласия в соответствии с Федеральным законом № 152-ФЗ.',
    href: '/legal/personal-data',
  },
  {
    title: 'Условия подписки и автопродления',
    desc: 'Как работает подписка, тарифы, автопродление и его отмена.',
    href: '/legal/subscription',
  },
  {
    title: 'Медицинский дисклеймер',
    desc: 'Важная информация о характере рекомендаций и ограничениях сервиса.',
    href: '/legal/medical-disclaimer',
  },
  {
    title: 'Уведомления',
    desc: 'Правила отправки уведомлений и условия согласия на их получение.',
    href: '/legal/notifications',
  },
];

export default function LegalPage() {
  return (
    <section style={{ padding: '72px 0 96px' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900,
          letterSpacing: -1, lineHeight: 1.05, marginBottom: 12,
        }}>
          Документы
        </h1>
        <p style={{
          fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 48,
        }}>
          Юридические документы EATLYY. Используя сервис, вы соглашаетесь с условиями ниже.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DOCS.map(({ title, desc }) => (
            <div
              key={title}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '20px 22px',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 40,
          padding: '18px 22px',
          background: 'var(--accent-dim)',
          border: '1px solid rgba(215,255,63,0.15)',
          borderRadius: 'var(--r-lg)',
          fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6,
        }}>
          Если у вас есть вопросы по документам — обратитесь в{' '}
          <a href="/support" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
            службу поддержки
          </a>.
        </div>
      </div>
    </section>
  );
}
