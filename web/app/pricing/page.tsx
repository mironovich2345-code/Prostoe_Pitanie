import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Тарифы',
  description:
    'Тарифы EATLYY: Free, Оптимальный и Pro. Начните с 3 дней Pro за 1 ₽ — без рисков, отмена в любой момент.',
  openGraph: {
    title: 'Тарифы | EATLYY',
    description: 'Free, Оптимальный и Pro. Попробуйте Pro 3 дня за 1 ₽.',
    url: '/pricing',
  },
  twitter: {
    title: 'Тарифы | EATLYY',
    description: 'Free, Оптимальный и Pro. Попробуйте Pro 3 дня за 1 ₽.',
  },
};

const TG_BOT = process.env.NEXT_PUBLIC_BOT_URL ?? 'https://t.me/EATLYY_bot';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '0 ₽',
    period: 'навсегда',
    accent: false,
    badge: null,
    desc: 'Базовый контроль питания без ограничений по времени.',
    features: [
      'Дневник питания (текст)',
      'Ручной ввод КБЖУ',
      'История за 7 дней',
      'Базовая статистика',
    ],
    missing: [
      'Анализ фото и голоса',
      'Полная история',
      'Подключение эксперта',
    ],
    cta: 'Начать бесплатно',
  },
  {
    id: 'optimal',
    name: 'Оптимальный',
    price: '399 ₽',
    period: 'в месяц',
    accent: false,
    badge: null,
    desc: 'Автоматический подсчёт КБЖУ по фото и голосу, полная история.',
    features: [
      'Всё из Free',
      'Анализ фото и голоса',
      'Полная история питания',
      'Расширенная статистика',
      'Динамика веса',
    ],
    missing: [
      'Подключение эксперта',
    ],
    cta: 'Выбрать Оптимальный',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '499 ₽',
    period: 'в месяц',
    accent: true,
    badge: '3 дня за 1 ₽',
    desc: 'Полный доступ + персональный нутрициолог, который видит ваш дневник.',
    features: [
      'Всё из Оптимального',
      'Подключение эксперта',
      'Комментарии нутрициолога',
      'Анализ рациона экспертом',
      'Приоритетная поддержка',
    ],
    missing: [],
    cta: 'Попробовать за 1 ₽',
  },
];

const FAQ = [
  {
    q: 'Как работает пробный период Pro?',
    a: 'Первые 3 дня Pro-доступа стоят 1 ₽. После этого подписка автоматически продлевается за 499 ₽/мес. Отменить можно в любой момент в разделе «Подписка» в приложении.',
  },
  {
    q: 'Можно ли отменить подписку?',
    a: 'Да. Откройте раздел «Подписка» в мини-приложении EATLYY и нажмите «Отключить автопродление». Доступ сохраняется до конца оплаченного периода.',
  },
  {
    q: 'Как подключить эксперта на тарифе Pro?',
    a: 'После оформления Pro перейдите в раздел «Эксперт» в приложении, выберите нутрициолога из каталога и подключите его к своему дневнику.',
  },
  {
    q: 'Могу ли я перейти с Free на Pro в любой момент?',
    a: 'Да. Перейти на платный тариф можно в любое время через раздел «Подписка» внутри приложения.',
  },
  {
    q: 'Что произойдёт, если я перестану платить?',
    a: 'Доступ к платным функциям (фото/голос, эксперт) закроется. Ваш дневник и история данных останутся — вы сможете возобновить подписку в любой момент.',
  },
];

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ padding: '80px 0 64px', textAlign: 'center' }}>
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
            Тарифы
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900,
            letterSpacing: -1.5, lineHeight: 1.05, marginBottom: 18,
          }}>
            Простые и честные<br />
            <span style={{ color: 'var(--accent)' }}>тарифы</span>
          </h1>
          <p style={{
            fontSize: 17, color: 'var(--text-2)', lineHeight: 1.65,
            maxWidth: 520, margin: '0 auto 0',
          }}>
            Начните бесплатно. Подключите эксперта на Pro — первые 3 дня всего за 1 ₽.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section style={{ padding: '0 0 80px' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            alignItems: 'start',
          }}>
            {PLANS.map((plan) => (
              <div key={plan.id} style={{
                background: plan.accent ? 'var(--accent)' : 'var(--surface)',
                border: plan.accent ? '2px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '32px 28px',
                position: 'relative',
                color: plan.accent ? '#0A0A0A' : 'inherit',
              }}>
                {plan.badge && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: '#0A0A0A',
                    color: 'var(--accent)',
                    fontSize: 12, fontWeight: 800, letterSpacing: 0.5,
                    padding: '4px 16px', borderRadius: 20,
                    whiteSpace: 'nowrap',
                    border: '1px solid var(--accent)',
                  }}>
                    {plan.badge}
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8,
                    color: plan.accent ? 'rgba(10,10,10,0.6)' : 'var(--text-3)',
                    textTransform: 'uppercase',
                  }}>
                    {plan.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 42, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1,
                      color: plan.accent ? '#0A0A0A' : 'var(--text)',
                    }}>
                      {plan.price}
                    </span>
                    <span style={{
                      fontSize: 14,
                      color: plan.accent ? 'rgba(10,10,10,0.6)' : 'var(--text-3)',
                    }}>
                      {plan.period}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 14, lineHeight: 1.55,
                    color: plan.accent ? 'rgba(10,10,10,0.7)' : 'var(--text-2)',
                  }}>
                    {plan.desc}
                  </p>
                </div>

                <a href={TG_BOT} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'block', textAlign: 'center',
                    padding: '13px 20px', borderRadius: 'var(--r-md)',
                    fontSize: 15, fontWeight: 700,
                    background: plan.accent ? '#0A0A0A' : 'transparent',
                    color: plan.accent ? 'var(--accent)' : 'var(--text)',
                    border: plan.accent ? '1.5px solid transparent' : '1.5px solid var(--border-2)',
                    textDecoration: 'none',
                    marginBottom: 28,
                    transition: 'opacity 0.15s',
                  }}>
                  {plan.cta}
                </a>

                <div style={{
                  borderTop: `1px solid ${plan.accent ? 'rgba(10,10,10,0.15)' : 'var(--border)'}`,
                  paddingTop: 24,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 800, flexShrink: 0, marginTop: 1,
                        color: plan.accent ? '#0A0A0A' : 'var(--accent)',
                      }}>✓</span>
                      <span style={{
                        fontSize: 14,
                        color: plan.accent ? 'rgba(10,10,10,0.8)' : 'var(--text-2)',
                      }}>
                        {f}
                      </span>
                    </div>
                  ))}
                  {plan.missing.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 800, flexShrink: 0, marginTop: 1,
                        color: 'var(--text-3)',
                      }}>✗</span>
                      <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison note */}
      <section style={{ padding: '0 0 80px' }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)',
            padding: '28px 28px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 24,
          }}>
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M15 7A7 7 0 1 0 10 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M13 4l2 3 2.5-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
                title: 'Отмена в любой момент',
                desc: 'Без скрытых условий — отключите автопродление одной кнопкой.',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M3 9.5h14" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="5.5" y="12.5" width="4" height="1.5" rx="0.75" fill="currentColor"/>
                  </svg>
                ),
                title: 'Безопасная онлайн-оплата',
                desc: 'Данные карты защищены — платёжный провайдер не передаёт их третьим лицам.',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 5a2 2 0 0 1 2-2h3.5l2 2H16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                ),
                title: 'Данные остаются',
                desc: 'При отмене подписки ваш дневник и история никуда не пропадут.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 38, height: 38,
                  background: 'var(--accent-dim)',
                  border: '1px solid rgba(215,255,63,0.12)',
                  borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent)',
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '0 0 80px' }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <h2 style={{
            fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800,
            letterSpacing: -0.6, marginBottom: 32, textAlign: 'center',
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
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '64px 0 96px',
        background: 'var(--surface)',
        textAlign: 'center',
      }}>
        <div className="container" style={{ maxWidth: 520 }}>
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 14,
          }}>
            Готовы начать?
          </h2>
          <p style={{
            fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 28,
          }}>
            Откройте EATLYY в Telegram и начните — бесплатно или за 1 ₽ на Pro.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/subscription" className="btn btn-accent"
              style={{ fontSize: 15, padding: '14px 32px' }}>
              Оформить подписку
            </Link>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"
              style={{ fontSize: 15, padding: '14px 24px' }}>
              Открыть в Telegram
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
