import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

function formatJoinedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function CoachReferralsScreen() {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['trainer-offer-links'],
    queryFn: api.trainerOfferLinks,
  });

  function handleCopy(offerId: string, link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(offerId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => null);
  }

  function handleShare(link: string, title: string) {
    if (navigator.share) {
      navigator.share({ title, url: link }).catch(() => null);
    } else {
      navigator.clipboard.writeText(link).catch(() => null);
    }
  }

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
          Реферальные офферы
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
          У вас 3 реферальные ссылки — по одной на каждый оффер. Отправляйте подходящую каждому клиенту.
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      )}

      {error && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '20px 16px',
          border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-3)', fontSize: 14,
        }}>
          Не удалось загрузить ссылки. Убедитесь, что у вас статус верифицированного тренера.
        </div>
      )}

      {data?.offers && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.offers.map(offer => {
            const isCopied = copiedId === offer.offerId;
            const isExpanded = expandedId === offer.offerId;
            return (
              <div
                key={offer.offerId}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--r-xl)',
                  padding: 18,
                  border: '1px solid var(--border)',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 13, flexShrink: 0,
                    background: 'var(--accent-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                  }}>
                    {offer.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
                      {offer.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
                      {offer.desc}
                    </div>
                  </div>
                  {offer.invitedCount > 0 && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : offer.offerId)}
                      style={{
                        flexShrink: 0,
                        background: 'var(--accent-soft)', borderRadius: 20,
                        padding: '4px 10px',
                        fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      {offer.invitedCount}
                      <span style={{ fontSize: 10, opacity: 0.7 }}>{isExpanded ? '▲' : '▼'}</span>
                    </button>
                  )}
                </div>

                {/* Expandable user list */}
                {isExpanded && offer.users.length > 0 && (
                  <div style={{
                    background: 'var(--surface-2)', borderRadius: 10,
                    border: '1px solid var(--border)',
                    marginBottom: 12, overflow: 'hidden',
                  }}>
                    {offer.users.map((u, i) => {
                      const namePart = u.displayName || '';
                      const userPart = u.username ? `@${u.username}` : '';
                      const label = namePart && userPart
                        ? `${namePart} (${userPart})`
                        : namePart || userPart || `Пользователь ${i + 1}`;
                      const isReal = !!(namePart || userPart);
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderBottom: i < offer.users.length - 1 ? '1px solid var(--border)' : 'none',
                          }}
                        >
                          <span style={{ fontSize: 13, color: isReal ? 'var(--text)' : 'var(--text-3)', fontWeight: isReal ? 500 : 400 }}>
                            {label}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {formatJoinedAt(u.joinedAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Link */}
                <div style={{
                  background: 'var(--surface-2)', borderRadius: 10,
                  padding: '9px 12px', marginBottom: 10,
                  border: '1px solid var(--border)',
                  fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)',
                  wordBreak: 'break-all', lineHeight: 1.5,
                }}>
                  {offer.link}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleCopy(offer.offerId, offer.link)}
                    className="btn"
                    style={{ flex: 1, fontSize: 13, padding: '10px 12px' }}
                  >
                    {isCopied ? '✓ Скопировано' : 'Скопировать'}
                  </button>
                  <button
                    onClick={() => handleShare(offer.link, offer.title)}
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

      {/* Rules */}
      <div style={{
        marginTop: 20,
        background: 'var(--surface)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        {[
          'Клиент закрепляется за оффером при первом переходе',
          'Повторный переход по другой ссылке ничего не меняет',
          'Самореферал не засчитывается',
        ].map((text, i, arr) => (
          <div
            key={text}
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
    </div>
  );
}
