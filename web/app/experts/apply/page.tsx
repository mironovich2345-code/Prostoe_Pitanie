import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Заявка эксперта EATLYY — стать нутрициологом или тренером на платформе',
  description:
    'Оставьте заявку эксперта EATLYY, чтобы получать клиентов, вести дневник питания и работать с клиентами через платформу.',
  openGraph: {
    title: 'Заявка эксперта | EATLYY',
    description: 'Получайте клиентов, ведите питание в одном кабинете и масштабируйте сопровождение.',
    url: '/experts/apply',
  },
  twitter: {
    title: 'Заявка эксперта | EATLYY',
    description: 'Получайте клиентов, ведите питание в одном кабинете и масштабируйте сопровождение.',
  },
};

const TG_SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_URL
  ?? process.env.NEXT_PUBLIC_BOT_URL
  ?? 'https://t.me/EATLYY_help';

const TG_BOT = process.env.NEXT_PUBLIC_BOT_URL ?? 'https://t.me/EATLYY_bot';

const FOR_WHOM = [
  { icon: '🥗', title: 'Нутрициологам', desc: 'Ведите клиентов через дневник питания, следите за рационом и корректируйте его онлайн.' },
  { icon: '🏋️', title: 'Фитнес-тренерам', desc: 'Дополните тренировочный план контролем питания — клиенты растут быстрее.' },
  { icon: '🩺', title: 'Диетологам', desc: 'Отслеживайте питание пациентов в реальном времени, без таблиц и скриншотов.' },
  { icon: '💻', title: 'Онлайн-экспертам', desc: 'Работайте с клиентами из любого города — дневник доступен всегда и везде.' },
];

const EXPERT_GETS = [
  { icon: '🏆', title: 'Публичная карточка в каталоге', desc: 'Ваш профиль, специализация, опыт и отзывы клиентов видны всем на сайте.' },
  { icon: '👥', title: 'Клиенты из Telegram и сайта', desc: 'Клиенты находят вас через каталог и подключаются напрямую.' },
  { icon: '📊', title: 'Дневник питания клиента на Pro', desc: 'Полный доступ к приёмам пищи, КБЖУ и статистике клиента с Pro-подпиской.' },
  { icon: '📈', title: 'Удобный просмотр статистики', desc: 'История, динамика и баланс нутриентов — в одном интерфейсе.' },
  { icon: '💰', title: 'Реферальный доход', desc: 'Приводите клиентов — получайте процент с их подписки, пока они активны.' },
  { icon: '🚀', title: 'Масштабирование практики', desc: 'Ведите больше клиентов без роста нагрузки — платформа берёт рутину на себя.' },
];

const STEPS = [
  { step: '01', title: 'Оставляете заявку', desc: 'Заполните форму ниже и отправьте её через Telegram. Укажите специализацию, опыт и контакты.' },
  { step: '02', title: 'Проходите проверку', desc: 'Команда EATLYY проверяет данные и подтверждает профессиональный статус за 1–2 рабочих дня.' },
  { step: '03', title: 'Получаете карточку', desc: 'После одобрения ваш профиль появляется в публичном каталоге экспертов.' },
  { step: '04', title: 'Подключаете клиентов', desc: 'Принимайте клиентов, ведите их дневники и зарабатывайте на реферальной программе.' },
];

const REQUIRED_DATA = [
  'Имя и фамилия',
  'Специализация (нутрициолог, диетолог, тренер и т.д.)',
  'Город или онлайн-формат работы',
  'Опыт работы (лет)',
  'Соцсеть или личный сайт',
  'Короткое описание — чем занимаетесь, кому помогаете',
  'Подтверждение экспертности (диплом, сертификат) — по желанию',
];

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'var(--surface-2)',
  border: '1px solid var(--border-2)',
  borderRadius: 'var(--r-md)',
  padding: '12px 16px',
  fontSize: 15,
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-2)',
  marginBottom: 6,
};

export default function ExpertApplyPage() {
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
            Станьте экспертом<br />
            <span style={{ color: 'var(--accent)' }}>EATLYY</span>
          </h1>
          <p style={{
            fontSize: 18, color: 'var(--text-2)', lineHeight: 1.65,
            marginBottom: 36, maxWidth: 560,
          }}>
            Получайте клиентов, ведите питание в одном кабинете и масштабируйте сопровождение.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="#apply-form" className="btn btn-accent"
              style={{ fontSize: 15, padding: '14px 32px' }}>
              Подать заявку
            </a>
            <a href={TG_SUPPORT} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"
              style={{ fontSize: 15, padding: '14px 24px' }}>
              Задать вопрос
            </a>
          </div>
        </div>
      </section>

      {/* For whom */}
      <section className="section" style={{ background: 'var(--surface)' }}>
        <div className="container">
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 12, textAlign: 'center',
          }}>
            Кому подойдёт
          </h2>
          <p style={{
            fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6,
            textAlign: 'center', maxWidth: 440, margin: '0 auto 40px',
          }}>
            Платформа открыта для специалистов, которые помогают людям с питанием и здоровьем.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}>
            {FOR_WHOM.map(({ icon, title, desc }) => (
              <div key={title} style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '24px 22px',
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What expert gets */}
      <section className="section">
        <div className="container">
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 48, textAlign: 'center',
          }}>
            Что получает эксперт
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {EXPERT_GETS.map(({ icon, title, desc }) => (
              <div key={title} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '24px 22px',
              }}>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
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
            Как проходит подключение
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}>
            {STEPS.map(({ step, title, desc }) => (
              <div key={step} style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '26px 22px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: 'var(--accent)',
                  letterSpacing: 0.8, marginBottom: 12,
                }}>
                  {step}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Required data */}
      <section className="section">
        <div className="container" style={{ maxWidth: 720 }}>
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 12, textAlign: 'center',
          }}>
            Какие данные понадобятся
          </h2>
          <p style={{
            fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6,
            textAlign: 'center', maxWidth: 440, margin: '0 auto 36px',
          }}>
            Всё это можно указать в форме ниже или написать напрямую в Telegram.
          </p>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)',
            padding: '28px 28px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {REQUIRED_DATA.map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--accent)', flexShrink: 0, marginTop: 7,
                }} />
                <span style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pseudo-form */}
      <section id="apply-form" className="section" style={{ background: 'var(--surface)' }}>
        <div className="container" style={{ maxWidth: 640 }}>
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: -0.8, marginBottom: 12, textAlign: 'center',
          }}>
            Оставить заявку
          </h2>
          <p style={{
            fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6,
            textAlign: 'center', maxWidth: 440, margin: '0 auto 36px',
          }}>
            Заполните поля ниже, а затем отправьте заявку через Telegram — мы рассмотрим её в течение 1–2 дней.
          </p>

          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)',
            padding: '32px 28px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 28 }}>
              <div>
                <label style={labelStyle}>Имя и фамилия</label>
                <input type="text" placeholder="Анна Соколова" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Специализация</label>
                <input type="text" placeholder="Нутрициолог, диетолог, фитнес-тренер…" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Город или формат работы</label>
                <input type="text" placeholder="Москва / Онлайн" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Соцсеть или сайт</label>
                <input type="text" placeholder="instagram.com/username" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Коротко о себе</label>
                <textarea
                  placeholder="Чем занимаетесь, кому помогаете, каких результатов достигают ваши клиенты…"
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                />
              </div>
            </div>

            <a
              href={TG_SUPPORT}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-accent"
              style={{
                display: 'block', textAlign: 'center',
                fontSize: 16, padding: '15px 20px',
                width: '100%', boxSizing: 'border-box',
              }}
            >
              Отправить заявку в Telegram
            </a>

            <p style={{
              marginTop: 14,
              fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55, textAlign: 'center',
            }}>
              Пока заявки принимаются через Telegram. Позже форма будет отправляться напрямую в личный кабинет EATLYY.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ padding: '64px 0 96px', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 520 }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24 }}>
            Хотите сначала посмотреть, как выглядят профили других экспертов?
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/trainers" className="btn btn-outline" style={{ fontSize: 14, padding: '12px 24px' }}>
              Смотреть каталог
            </Link>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"
              style={{ fontSize: 14, padding: '12px 20px' }}>
              Открыть EATLYY
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
