/**
 * Partnership screen — expert acquisition referral.
 * Shows the expert's shareable link and a list of recruited experts with phase stats.
 * Accessible to verified experts and companies.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRub(rub: number): string {
  if (rub === 0) return '—';
  return `${rub.toLocaleString('ru')} ₽`;
}

export default function PartnershipScreen() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const linkQuery = useQuery({
    queryKey: ['expert-referral-link'],
    queryFn: api.expertReferralLink,
    // Don't retry on access-denied; retry once on other errors (server/network hiccup)
    retry: (count, err) => count < 1 && !(err as Error).message?.includes('required'),
  });

  const recruitsQuery = useQuery({
    queryKey: ['expert-referral-recruits'],
    queryFn: api.expertReferralRecruits,
    enabled: linkQuery.isSuccess,
  });

  function handleCopy() {
    const link = linkQuery.data?.link;
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => null);
  }

  function handleShare() {
    const link = linkQuery.data?.link;
    if (!link) return;
    if (navigator.share) {
      navigator.share({ title: 'Присоединяйтесь как эксперт', url: link }).catch(() => null);
    } else {
      handleCopy();
    }
  }

  const model = linkQuery.data?.model;
  const recruits = recruitsQuery.data?.recruits ?? [];
  const summary = recruitsQuery.data;

  return (
    <div className="screen">
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 16, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ← Назад
      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 6 }}>
          Партнёрство
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Приглашайте новых экспертов и получайте долю от их дохода.
        </div>
      </div>

      {/* Loading */}
      {linkQuery.isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      )}

      {/* Error state — distinguish access-denied from temporary errors */}
      {linkQuery.isError && (() => {
        const isAccessDenied = (linkQuery.error as Error)?.message?.includes('required');
        return (
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '20px 16px',
            border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-3)', fontSize: 14,
          }}>
            {isAccessDenied
              ? 'Партнёрские ссылки доступны только верифицированным экспертам и компаниям.'
              : 'Не удалось загрузить данные. Попробуйте позже.'}
          </div>
        );
      })()}

      {linkQuery.isSuccess && (
        <>
          {/* Earning model card */}
          {model && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-xl)',
              border: '1px solid var(--border)', padding: '16px 18px', marginBottom: 12,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10 }}>
                Условия программы
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Первые {model.phase1Days} дней</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{model.phase1Rate * 100}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    После месяца <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>(при &gt;{model.qualificationThreshold} клиентах)</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{model.phase2Rate * 100}%</span>
                </div>
              </div>
              <div style={{
                marginTop: 10, padding: '10px 12px', borderRadius: 8,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5,
              }}>
                {model.description}
              </div>
            </div>
          )}

          {/* Link card */}
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r-xl)',
            border: '1px solid var(--border)', padding: '16px 18px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10 }}>
              Ваша ссылка
            </div>
            <div style={{
              background: 'var(--surface-2)', borderRadius: 10,
              padding: '9px 12px', marginBottom: 12,
              border: '1px solid var(--border)',
              fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)',
              wordBreak: 'break-all', lineHeight: 1.5,
            }}>
              {linkQuery.data.link}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCopy} className="btn" style={{ flex: 1, fontSize: 13, padding: '10px 12px' }}>
                {copied ? '✓ Скопировано' : 'Скопировать'}
              </button>
              <button onClick={handleShare} className="btn btn-secondary" style={{ flex: 1, fontSize: 13, padding: '10px 12px' }}>
                Поделиться
              </button>
            </div>
          </div>

          {/* Summary stats */}
          {summary && summary.totalRecruits > 0 && (
            <div style={{
              display: 'flex', gap: 10, marginBottom: 12,
            }}>
              {[
                { label: 'Привлечено', value: String(summary.totalRecruits) },
                { label: 'Квалифицированы', value: String(summary.totalQualified) },
                { label: 'Начислено', value: formatRub(summary.totalEarningsRub) },
              ].map(stat => (
                <div key={stat.label} style={{
                  flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--border)', padding: '12px 8px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: -0.5 }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Recruits list */}
          {recruitsQuery.isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <div className="spinner" />
            </div>
          )}

          {recruits.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '4px 4px 8px' }}>
                Привлечённые эксперты
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {recruits.map((r, i) => {
                  const isExpanded = expandedId === r.invitedExpertChatId;
                  const phase1Done = r.isPhase1Complete;
                  return (
                    <div
                      key={r.invitedExpertChatId}
                      style={{
                        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                        border: '1px solid var(--border)', overflow: 'hidden',
                      }}
                    >
                      {/* Header row */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : r.invitedExpertChatId)}
                        style={{
                          width: '100%', padding: '14px 16px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                        }}
                      >
                        <div style={{
                          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                          background: 'var(--accent-soft)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18,
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
                              }}>
                                КВАЛ
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                            Подключён {formatDate(r.attributedAt)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: r.totalEarningsRub > 0 ? 'var(--accent)' : 'var(--text-3)' }}>
                            {formatRub(r.totalEarningsRub)}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                            {isExpanded ? '▲' : '▼'}
                          </div>
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {/* Phase 1 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                              Месяц 1 {phase1Done ? '(завершён)' : `до ${formatDate(r.phase1EndsAt)}`}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                              {r.phase1ClientCount} кл.
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Доход Месяц 1 (50%)</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{formatRub(r.phase1EarningsRub)}</span>
                          </div>
                          {r.isQualified && (
                            <>
                              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }} />
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Клиенты после месяца 1</span>
                                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.phase2ClientCount} кл.</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Доход Месяц 2+ (100%)</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{formatRub(r.phase2EarningsRub)}</span>
                              </div>
                            </>
                          )}
                          {!r.isQualified && phase1Done && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
                              Квалификация не получена (нужно &gt;{5} клиентов в первый месяц)
                            </div>
                          )}
                          {!r.isQualified && !phase1Done && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
                              Квалификация: нужно &gt;5 клиентов до {formatDate(r.phase1EndsAt)}
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

          {recruitsQuery.isSuccess && recruits.length === 0 && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '20px 16px',
              border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-3)', fontSize: 14,
            }}>
              Пока нет привлечённых экспертов. Поделитесь ссылкой!
            </div>
          )}

          {/* Rules */}
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border)', overflow: 'hidden', marginTop: 4,
          }}>
            {[
              'Новый эксперт должен пройти по вашей ссылке до подачи заявки',
              'Самореферал не засчитывается',
              'Доходы считаются только по подтверждённым выплатам',
            ].map((text, i, arr) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-3)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
