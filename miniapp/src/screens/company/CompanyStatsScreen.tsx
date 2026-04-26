import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

const MIN_PAYOUT = 2500;

const PAYOUT_STATUS: Record<string, { text: string; color: string }> = {
  pending:   { text: 'Рассматривается', color: 'var(--text-3)' },
  approved:  { text: 'Одобрено',        color: '#7EB8F0' },
  paid:      { text: 'Выплачено',       color: 'var(--accent)' },
  cancelled: { text: 'Отклонено',       color: 'var(--danger)' },
};

function fmtRub(n: number) { return n.toLocaleString('ru') + ' ₽'; }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function getOfferIcon(offerKey: string) {
  if (offerKey === 'first_payment') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    );
  }
  if (offerKey === 'lifetime_20') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4z"/>
        <path d="M12 12c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4z"/>
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="5" x2="5" y2="19"/>
      <circle cx="6.5" cy="6.5" r="2.5"/>
      <circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  );
}

export default function CompanyStatsScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'referrals' | 'partnership'>('referrals');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [partnerCopied, setPartnerCopied] = useState(false);
  const [partnerExpanded, setPartnerExpanded] = useState<string | null>(null);

  // ── Finance ───────────────────────────────────────────────────────────────
  const { data: rewardsData, isLoading: rewardsLoading } = useQuery({
    queryKey: ['trainer-rewards'],
    queryFn: api.trainerRewards,
  });
  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ['trainer-payout-request'],
    queryFn: api.trainerPayoutRequest,
  });
  const createMutation = useMutation({
    mutationFn: api.trainerCreatePayoutRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainer-payout-request'] });
      qc.invalidateQueries({ queryKey: ['trainer-rewards'] });
    },
  });

  // ── Referrals ─────────────────────────────────────────────────────────────
  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ['trainer-offer-links'],
    queryFn: api.trainerOfferLinks,
    enabled: tab === 'referrals',
  });

  // ── Partnership ───────────────────────────────────────────────────────────
  const { data: linkData, isLoading: linkLoading, isError: linkError, error: linkErr } = useQuery({
    queryKey: ['expert-referral-link'],
    queryFn: api.expertReferralLink,
    retry: (count, err) => count < 1 && !(err as Error).message?.includes('required'),
    enabled: tab === 'partnership',
  });
  const { data: recruitsData, isLoading: recruitsLoading } = useQuery({
    queryKey: ['expert-referral-recruits'],
    queryFn: api.expertReferralRecruits,
    enabled: tab === 'partnership' && !!linkData,
  });

  if (rewardsLoading || reqLoading) return <div className="loading"><div className="spinner" /></div>;

  const s = rewardsData?.summary ?? { total: 0, available: 0, paidOut: 0 };
  const activeRequest = reqData?.request ?? null;
  const canRequest = s.available >= MIN_PAYOUT && !activeRequest;
  const statusInfo = activeRequest ? (PAYOUT_STATUS[activeRequest.status] ?? { text: activeRequest.status, color: 'var(--text-3)' }) : null;

  const mutErr = createMutation.error as Error | null;
  let errMessage: string | null = null;
  if (mutErr) {
    try { errMessage = (JSON.parse(mutErr.message || '{}') as { error?: string }).error ?? mutErr.message; }
    catch { errMessage = mutErr.message; }
  }

  return (
    <div className="screen">

      {/* ── Branded header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 16 }}>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>
          <span style={{ color: 'var(--text)' }}>EATL</span>
          <span style={{ color: 'var(--accent)' }}>YY</span>
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Company</span>
      </div>

      {/* ── Balance card ───────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)',
        padding: '20px 16px 18px',
        marginBottom: 12,
      }}>
        {/* Hero zone */}
        <div style={{ padding: '22px 20px 20px' }}>
          {/* Available — hero metric */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 1.2, color: 'var(--text-3)', marginBottom: 8,
            }}>
              Доступно к выводу
            </div>
            <div style={{
              fontSize: 44, fontWeight: 800, letterSpacing: -2, lineHeight: 1,
              color: s.available > 0 ? 'var(--accent)' : 'var(--text-3)',
            }}>
              {s.available.toLocaleString('ru')}
              <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginLeft: 6 }}>₽</span>
            </div>
          </div>

          {/* Secondary metrics */}
          <div style={{ display: 'flex', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            {[
              { label: 'Начислено', value: fmtRub(s.total),   color: 'var(--text)' },
              { label: 'Выплачено', value: fmtRub(s.paidOut), color: 'var(--text-2)' },
            ].map((m, i) => (
              <div key={m.label} style={{
                flex: 1,
                paddingLeft: i === 1 ? 16 : 0,
                marginLeft: i === 1 ? 16 : 0,
                borderLeft: i === 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginBottom: 4, letterSpacing: 0.1 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: m.color, lineHeight: 1 }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active request banner */}
        {activeRequest && statusInfo && (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.03)',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                Заявка на вывод · {fmtRub(activeRequest.amountRub)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {new Date(activeRequest.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, flexShrink: 0,
              background: `${statusInfo.color}18`, color: statusInfo.color,
            }}>
              {statusInfo.text}
            </span>
          </div>
        )}

        {/* CTA zone */}
        <div style={{ padding: '14px 16px 16px', borderTop: '1px solid var(--border)' }}>
          {errMessage && (
            <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10, textAlign: 'center', lineHeight: 1.4 }}>
              {errMessage}
            </div>
          )}

          <button
            onClick={() => canRequest && createMutation.mutate()}
            disabled={createMutation.isPending || !!activeRequest || s.available === 0}
            style={{
              display: 'block', width: '100%',
              padding: '15px 0', fontSize: 16, fontWeight: 700,
              borderRadius: 14, border: 'none',
              background: canRequest ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
              color: canRequest ? '#000' : 'rgba(255,255,255,0.25)',
              cursor: canRequest ? 'pointer' : 'default',
              letterSpacing: canRequest ? -0.3 : 0,
              marginBottom: 8,
            }}
          >
            {createMutation.isPending
              ? 'Создаём...'
              : activeRequest
                ? 'Вывод на рассмотрении'
                : canRequest
                  ? `Вывод ${fmtRub(s.available)}`
                  : s.available === 0
                    ? 'Нет доступных средств'
                    : `Вывод (мин. ${MIN_PAYOUT.toLocaleString('ru')} ₽)`}
          </button>

          <button
            onClick={() => navigate('/requisites')}
            style={{
              display: 'block', width: '100%',
              padding: '9px 0', fontSize: 13, fontWeight: 500,
              background: 'none', border: 'none',
              color: 'var(--text-3)', cursor: 'pointer',
            }}
          >
            Реквизиты →
          </button>
        </div>

        {createMutation.isSuccess && (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 20px', textAlign: 'center',
            fontSize: 13, color: 'var(--accent)', fontWeight: 600,
          }}>
            Заявка отправлена ✓
          </div>
        )}
      </div>

      {/* ── Segment control ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        background: 'var(--surface-2)', borderRadius: 11, padding: 3,
        border: '1px solid var(--border)', marginBottom: 16,
      }}>
        {(['referrals', 'partnership'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 9,
              background: tab === t ? 'var(--surface)' : 'transparent',
              border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
              color: tab === t ? 'var(--text)' : 'var(--text-3)',
              fontWeight: tab === t ? 700 : 500,
              fontSize: 14, cursor: 'pointer',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.18)' : 'none',
            }}
          >
            {t === 'referrals' ? 'Рефералы' : 'Партнёрство'}
          </button>
        ))}
      </div>

      {/* ── REFERRALS TAB ──────────────────────────────────────────────── */}
      {tab === 'referrals' && (
        <>
          {offersLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          )}

          {offersData && (offersData.totalUniqueUsers ?? 0) > 0 && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border)', padding: '12px 16px', marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>Переходов всего</span>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: 'var(--accent)' }}>
                {offersData.totalUniqueUsers}
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 4 }}>чел.</span>
              </span>
            </div>
          )}

          {offersData?.offers && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {offersData.offers.map(offer => {
                const isCopied = copiedId === offer.offerId;
                const isExpanded = expandedId === offer.offerId;
                return (
                  <div key={offer.offerId} style={{
                    background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                    padding: 16, border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: 'rgba(215,255,63,0.07)',
                        border: '1px solid rgba(215,255,63,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--accent)',
                      }}>
                        {getOfferIcon(offer.offerKey)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                          {offer.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>
                          {offer.desc}
                        </div>
                      </div>
                      {offer.invitedCount > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : offer.offerId)}
                          style={{
                            flexShrink: 0, background: 'var(--accent-soft)', borderRadius: 20,
                            padding: '4px 10px', fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          {offer.invitedCount}
                          <span style={{ fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
                        </button>
                      )}
                    </div>

                    {offer.earnedRub !== null && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', marginBottom: 10,
                        border: '1px solid var(--border)',
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>
                          {offer.offerKey === 'first_payment' ? 'Первые оплаты' : 'Начислено'}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3, color: offer.earnedRub > 0 ? 'var(--accent)' : 'var(--text-3)' }}>
                          {offer.earnedRub > 0 ? fmtRub(offer.earnedRub) : '—'}
                        </span>
                      </div>
                    )}

                    {isExpanded && offer.users.length > 0 && (
                      <div style={{
                        background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)',
                        marginBottom: 10, overflow: 'hidden',
                      }}>
                        {offer.users.map((u, i) => {
                          const name = u.displayName || '';
                          const uname = u.username ? `@${u.username}` : '';
                          const label = name && uname ? `${name} (${uname})` : name || uname || `Пользователь ${i + 1}`;
                          return (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderBottom: i < offer.users.length - 1 ? '1px solid var(--border)' : 'none',
                            }}>
                              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtShort(u.joinedAt)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{
                      background: 'var(--surface-2)', borderRadius: 8, padding: '7px 10px', marginBottom: 8,
                      border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 11,
                      color: 'var(--text-2)', wordBreak: 'break-all', lineHeight: 1.5,
                    }}>
                      {offer.link}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(offer.link).then(() => {
                            setCopiedId(offer.offerId);
                            setTimeout(() => setCopiedId(null), 2000);
                          }).catch(() => null);
                        }}
                        className="btn"
                        style={{ flex: 1, fontSize: 13, padding: '9px 12px' }}
                      >
                        {isCopied ? '✓ Скопировано' : 'Скопировать'}
                      </button>
                      <button
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({ title: offer.title, url: offer.link }).catch(() => null);
                          } else {
                            navigator.clipboard.writeText(offer.link).catch(() => null);
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: 13, padding: '9px 12px' }}
                      >
                        Поделиться
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{
            marginTop: 12, background: 'var(--surface)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            {[
              'Клиент закрепляется за оффером при первом переходе',
              'Повторный переход по другой ссылке ничего не меняет',
              'Самореферал не засчитывается',
            ].map((text, i, arr) => (
              <div key={text} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-3)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── PARTNERSHIP TAB ────────────────────────────────────────────── */}
      {tab === 'partnership' && (
        <>
          {linkLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          )}

          {linkError && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '20px 16px',
              border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-3)', fontSize: 14,
            }}>
              {(linkErr as Error)?.message?.includes('required')
                ? 'Партнёрские ссылки доступны только верифицированным компаниям.'
                : 'Не удалось загрузить данные. Попробуйте позже.'}
            </div>
          )}

          {linkData && (
            <>
              {linkData.model && (
                <div style={{
                  background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                  border: '1px solid var(--border)', padding: '16px 18px', marginBottom: 10,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10 }}>
                    Условия программы
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Первые {linkData.model.phase1Days} дней</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                        {linkData.model.phase1Rate * 100}% от дохода эксперта
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>После {linkData.model.phase1Days} дней</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}>—</span>
                    </div>
                  </div>
                  <div style={{
                    marginTop: 10, padding: '9px 11px', borderRadius: 8,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5,
                  }}>
                    {linkData.model.description}
                  </div>
                </div>
              )}

              <div style={{
                background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                border: '1px solid var(--border)', padding: '16px 18px', marginBottom: 10,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10 }}>
                  Ваша ссылка
                </div>
                <div style={{
                  background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px', marginBottom: 10,
                  border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 11,
                  color: 'var(--text-2)', wordBreak: 'break-all', lineHeight: 1.5,
                }}>
                  {linkData.link}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(linkData.link).then(() => {
                        setPartnerCopied(true);
                        setTimeout(() => setPartnerCopied(false), 2000);
                      }).catch(() => null);
                    }}
                    className="btn"
                    style={{ flex: 1, fontSize: 13, padding: '9px 12px' }}
                  >
                    {partnerCopied ? '✓ Скопировано' : 'Скопировать'}
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: 'Присоединяйтесь как эксперт', url: linkData.link }).catch(() => null);
                      } else {
                        navigator.clipboard.writeText(linkData.link).catch(() => null);
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: 13, padding: '9px 12px' }}
                  >
                    Поделиться
                  </button>
                </div>
              </div>

              {recruitsData && recruitsData.totalRecruits > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {[
                    { label: 'Привлечено',      value: String(recruitsData.totalRecruits) },
                    { label: 'Квалифицированы', value: String(recruitsData.totalQualified) },
                    { label: 'Начислено',        value: recruitsData.totalEarningsRub > 0 ? fmtRub(recruitsData.totalEarningsRub) : '—' },
                  ].map(stat => (
                    <div key={stat.label} style={{
                      flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)',
                      border: '1px solid var(--border)', padding: '11px 6px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)', letterSpacing: -0.5 }}>{stat.value}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {recruitsLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <div className="spinner" />
                </div>
              )}

              {recruitsData && recruitsData.recruits.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '4px 4px 8px' }}>
                    Привлечённые эксперты
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {recruitsData.recruits.map((r, i) => {
                      const isExp = partnerExpanded === r.invitedExpertChatId;
                      const phase1Done = r.isPhase1Complete;
                      return (
                        <div key={r.invitedExpertChatId} style={{
                          background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                          border: '1px solid var(--border)', overflow: 'hidden',
                        }}>
                          <button
                            onClick={() => setPartnerExpanded(isExp ? null : r.invitedExpertChatId)}
                            style={{
                              width: '100%', padding: '12px 14px',
                              background: 'none', border: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                            }}
                          >
                            <div style={{
                              width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                              background: 'var(--accent-soft)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                            }}>
                              {r.isQualified ? '★' : `${i + 1}`}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                                Эксперт #{i + 1}
                                {r.isQualified && (
                                  <span style={{
                                    marginLeft: 6, fontSize: 10, fontWeight: 700,
                                    background: 'var(--accent-soft)', color: 'var(--accent)',
                                    borderRadius: 4, padding: '2px 5px',
                                  }}>КВАЛ</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                                {fmtDate(r.attributedAt)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: r.totalEarningsRub > 0 ? 'var(--accent)' : 'var(--text-3)' }}>
                                {r.totalEarningsRub > 0 ? fmtRub(r.totalEarningsRub) : '—'}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{isExp ? '▲' : '▼'}</div>
                            </div>
                          </button>
                          {isExp && (
                            <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                                  Месяц 1 {phase1Done ? '(завершён)' : `до ${fmtDate(r.phase1EndsAt)}`}
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.phase1ClientCount} кл.</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Доход за месяц 1 (50%)</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                                  {r.phase1EarningsRub > 0 ? fmtRub(r.phase1EarningsRub) : '—'}
                                </span>
                              </div>
                              {!r.isQualified && phase1Done && (
                                <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
                                  Квалификация не получена (нужно &gt;5 клиентов)
                                </div>
                              )}
                              {!r.isQualified && !phase1Done && (
                                <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
                                  Нужно &gt;5 клиентов до {fmtDate(r.phase1EndsAt)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {recruitsData && recruitsData.recruits.length === 0 && (
                <div style={{
                  background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '18px 16px',
                  border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-3)', fontSize: 14,
                }}>
                  Пока нет привлечённых экспертов. Поделитесь ссылкой!
                </div>
              )}

              <div style={{
                marginTop: 4, background: 'var(--surface)', borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)', overflow: 'hidden',
              }}>
                {[
                  'Новый эксперт должен пройти по вашей ссылке до подачи заявки',
                  'Самореферал не засчитывается',
                  'Доходы считаются только по подтверждённым выплатам',
                ].map((text, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-3)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>{text}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

    </div>
  );
}
