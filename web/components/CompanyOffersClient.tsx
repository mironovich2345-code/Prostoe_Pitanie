'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { webApi, ApiError, type WebCompanyOffer } from '@/lib/webApi';
import MaxLoginButton from '@/components/MaxLoginButton';
import CompanyNav from '@/components/CompanyNav';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_COMPANY_OFF__?: (user: Record<string, string | number>) => void;
  }
}

const BOT_USERNAME_FALLBACK = 'EATLYY_bot';

interface Props { botUsername: string }

export default function CompanyOffersClient({ botUsername }: Props) {
  const [authState, setAuthState]   = useState<'loading' | 'unauthenticated' | 'authenticated'>('loading');
  const [notCompany, setNotCompany] = useState(false);
  const [offers, setOffers]         = useState<WebCompanyOffer[]>([]);
  const [expertLink, setExpertLink] = useState<string | null>(null);
  const [copiedKey, setCopiedKey]   = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const username  = botUsername || BOT_USERNAME_FALLBACK;

  async function loadData() {
    try {
      const resp = await webApi.getCompanyOffers();
      setOffers(resp.offers);
      setExpertLink(resp.expertAcquisitionLink);
      setAuthState('authenticated');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'not_company') {
        setNotCompany(true);
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
      }
    }
  }

  useEffect(() => {
    webApi.getMe().then(() => loadData()).catch(() => setAuthState('unauthenticated'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authState !== 'unauthenticated') return;
    const container = widgetRef.current;
    if (!container) return;

    window.__EATLYY_TG_AUTH_COMPANY_OFF__ = async (tgUser) => {
      try {
        await webApi.telegramLogin(tgUser);
        await loadData();
      } catch (err) {
        const code = err instanceof ApiError ? err.code : null;
        setLoginError(code ? `Ошибка входа: ${code}` : 'Ошибка входа через Telegram.');
      }
    };

    container.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', username);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_COMPANY_OFF__(user)');
    script.onerror = () => setLoginError('Не удалось загрузить виджет Telegram.');
    container.appendChild(script);
    return () => { container.innerHTML = ''; delete window.__EATLYY_TG_AUTH_COMPANY_OFF__; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, username]);

  function handleCopy(key: string, link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }).catch(() => null);
  }

  async function handleLogout() {
    await webApi.logout().catch(() => {});
    setOffers([]); setNotCompany(false);
    setAuthState('unauthenticated');
  }

  if (authState === 'loading') {
    return <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>Загрузка…</div>;
  }

  if (authState === 'unauthenticated') {
    return (
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: 'var(--text-3)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Войдите через Telegram</h3>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto 28px' }}>
          Кабинет компании доступен только после входа.
        </p>
        <div ref={widgetRef} style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }} />
        {loginError && <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 12 }}>{loginError}</p>}
        <OrDivider />
        <MaxLoginButton onSuccess={loadData} />
      </div>
    );
  }

  if (notCompany) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>🏢</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Кабинет компании</h3>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 420, margin: '0 auto 28px' }}>
          Раздел доступен только подтверждённым компаниям EATLYY.
        </p>
        <Link href="/support" className="btn btn-accent" style={{ fontSize: 15, padding: '14px 32px' }}>
          Связаться с поддержкой
        </Link>
        <div style={{ marginTop: 20 }}>
          <button onClick={handleLogout} style={{
            background: 'none', border: 'none', padding: 0,
            color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
          }}>
            Выйти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CompanyNav active="offers" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Реферальные офферы</div>
        <button onClick={handleLogout} style={{
          background: 'none', border: 'none', padding: 0,
          color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0,
        }}>
          Выйти
        </button>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.55 }}>
        Используйте эти ссылки для привлечения клиентов. Каждый оффер — отдельный сценарий монетизации.
      </p>

      {offers.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)', padding: '40px 20px', textAlign: 'center',
          color: 'var(--text-3)', fontSize: 14,
        }}>
          Офферы станут доступны после того, как EATLYY назначит вашей компании реферальный код.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {offers.map(offer => {
            const isCopied = copiedKey === offer.key;
            return (
              <div key={offer.key} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)', padding: '18px 20px',
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  {offer.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
                  {offer.description}
                </div>
                <div style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 10,
                  fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)',
                  wordBreak: 'break-all', lineHeight: 1.5,
                }}>
                  {offer.link}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleCopy(offer.key, offer.link)}
                    className="btn"
                    style={{ flex: 1, fontSize: 13, padding: '10px 12px' }}
                  >
                    {isCopied ? '✓ Скопировано' : 'Скопировать'}
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: offer.title, url: offer.link }).catch(() => null);
                      } else {
                        handleCopy(offer.key, offer.link);
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: 13, padding: '10px 12px' }}
                  >
                    Поделиться
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expert acquisition link */}
      {expertLink && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)', padding: '18px 20px',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Привлечение экспертов
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
              Ссылка для приглашения новых экспертов в партнёрскую программу EATLYY.
            </div>
            <div style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', marginBottom: 10,
              fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)',
              wordBreak: 'break-all', lineHeight: 1.5,
            }}>
              {expertLink}
            </div>
            <button
              onClick={() => handleCopy('expert_acq', expertLink)}
              className="btn"
              style={{ width: '100%', fontSize: 13, padding: '10px 12px' }}
            >
              {copiedKey === 'expert_acq' ? '✓ Скопировано' : 'Скопировать'}
            </button>
          </div>
        </div>
      )}

      {/* Rules */}
      <div style={{
        marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', overflow: 'hidden',
      }}>
        {[
          'Клиент закрепляется за оффером при первом переходе',
          'Повторный переход по другой ссылке ничего не меняет',
          'Самореферал не засчитывается',
        ].map((text, i, arr) => (
          <div key={text} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-3)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px auto', maxWidth: 280 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>или</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}
