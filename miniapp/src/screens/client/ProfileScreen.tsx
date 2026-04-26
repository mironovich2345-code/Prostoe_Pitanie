import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, detectPlatform } from '../../api/client';
import type { BootstrapData, TrainerVerificationStatus } from '../../types';
import { Chip, ListCard, ListItem } from '../../ui';

interface Props {
  bootstrap: BootstrapData;
  onSwitchToCoach?: () => void;
  onSwitchToAdmin?: () => void;
}

// ─── ExpertChip ────────────────────────────────────────────────────────────

function ExpertChip({ status }: { status: TrainerVerificationStatus | undefined }) {
  const navigate = useNavigate();
  if (status === 'pending')
    return <Chip variant="warn" onClick={() => navigate('/expert/status')} style={{ cursor: 'pointer' }}>На проверке</Chip>;
  if (status === 'rejected')
    return <Chip variant="danger" onClick={() => navigate('/expert/status')} style={{ cursor: 'pointer' }}>Отклонено</Chip>;
  if (status === 'blocked')
    return <Chip variant="muted" onClick={() => navigate('/expert/status')} style={{ cursor: 'pointer' }}>Заблокирован</Chip>;
  if (status === 'verified') return null; // handled by role toggle in UserHeroCard
  return (
    <button
      onClick={() => navigate('/expert/apply')}
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      Стать экспертом
    </button>
  );
}

// ─── User Hero Card ────────────────────────────────────────────────────────

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 512;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = url;
  });
}

function UserHeroCard({ bootstrap, onSwitchToCoach }: { bootstrap: BootstrapData; onSwitchToCoach?: () => void }) {
  const user = bootstrap.telegramUser;
  const p = bootstrap.profile;
  const trainerStatus = bootstrap.trainerProfile?.verificationStatus;
  const isVerified = trainerStatus === 'verified' && !!onSwitchToCoach;
  const isCompany = bootstrap.trainerProfile?.specialization === 'Компания';

  const firstName = user?.first_name ?? '';
  const lastName = user?.last_name ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Пользователь';
  const displayName = p?.preferredName?.trim() || fullName;
  const initial = (displayName.charAt(0) || fullName.charAt(0)).toUpperCase();

  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const displayAvatar = localAvatar ?? p?.avatarData ?? null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const avatarMutation = useMutation({
    mutationFn: api.patchProfileAvatar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bootstrap'] }),
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await compressImage(file);
    setLocalAvatar(base64);
    avatarMutation.mutate(base64);
  };

  const roleLabel = isCompany ? 'Компания' : 'Эксперт';

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--r-xl)',
      padding: '24px 20px 20px',
      border: '1px solid var(--border)',
      marginBottom: 12,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      position: 'relative',
    }}>
      {/* Role toggle — top-right, only for verified trainers */}
      {isVerified && (
        <div style={{
          position: 'absolute', top: 14, right: 16,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)' }}>
            {roleLabel}
          </span>
          {/* iPhone-style toggle, always "off" in client view */}
          <button
            onClick={onSwitchToCoach}
            aria-label={`Переключить на ${roleLabel}`}
            style={{
              width: 44, height: 26, borderRadius: 13,
              background: 'var(--surface-2)',
              border: '1.5px solid var(--border)',
              padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', left: 3,
              width: 18, height: 18, borderRadius: '50%',
              background: 'var(--text-3)',
              transition: 'left 0.2s, background 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }} />
          </button>
        </div>
      )}

      {/* Avatar centered */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div style={{
          width: 112, height: 112, borderRadius: '50%',
          background: displayAvatar ? 'transparent' : 'var(--accent-soft)',
          border: '2px solid rgba(215,255,63,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 44, fontWeight: 700, color: 'var(--accent)',
          overflow: 'hidden',
        }}>
          {displayAvatar
            ? <img src={displayAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initial
          }
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--accent)', border: '2px solid var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#000', padding: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
      </div>

      {/* Name */}
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', textAlign: 'center', marginBottom: 4, lineHeight: 1.2 }}>
        {displayName}
      </div>

      {/* @username */}
      {user?.username && (
        <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginBottom: 4 }}>
          @{user.username}
        </div>
      )}

      {/* City */}
      {p?.city && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          {p.city}
        </div>
      )}
    </div>
  );
}

// ─── Trainer section ───────────────────────────────────────────────────────

function TrainerTab({ bootstrap }: { bootstrap: BootstrapData }) {
  const navigate = useNavigate();
  const trainer = bootstrap.connectedTrainer;

  if (trainer) {
    const connectedDate = new Date(trainer.connectedAt).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const trainerName = trainer.fullName?.trim() || 'Эксперт';
    const initial = trainerName.charAt(0).toUpperCase();

    return (
      <div>
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-xl)',
          padding: '18px', border: '1px solid var(--border)', marginBottom: 10,
        }}>
          {/* Trainer header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
              background: trainer.avatarData ? 'transparent' : 'var(--accent-soft)',
              border: '2px solid rgba(215,255,63,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: 'var(--accent)', overflow: 'hidden',
            }}>
              {trainer.avatarData
                ? <img src={trainer.avatarData} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initial
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
                {trainerName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Подключён с {connectedDate}</div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
              background: 'var(--accent-soft)', color: 'var(--accent)',
            }}>
              Активен
            </span>
          </div>

          {/* Access level */}
          <div style={{
            background: 'var(--surface-2)', borderRadius: 12, padding: '11px 14px',
            border: '1px solid var(--border)', marginBottom: 14,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Доступ к истории</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: trainer.fullHistoryAccess ? 'var(--accent)' : 'var(--text)' }}>
              {trainer.fullHistoryAccess ? 'Полный' : 'Только текущие'}
            </span>
          </div>

          <button
            onClick={() => navigate('/trainer')}
            className="btn"
            style={{ fontSize: 14 }}
          >
            Открыть профиль эксперта
          </button>
        </div>
      </div>
    );
  }

  // No trainer — premium empty state
  return (
    <div>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        padding: '32px 20px', border: '1px solid var(--border)',
        textAlign: 'center', marginBottom: 10,
      }}>
        <div style={{ opacity: 0.2, marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Пока без эксперта
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.55, marginBottom: 24, maxWidth: 270, margin: '0 auto 24px' }}>
          С экспертом легче не съехать с цели. Меньше срывов, больше контроля — и быстрее результат.
        </div>
        <button
          onClick={() => navigate('/connect-trainer')}
          className="btn"
          style={{ width: 'auto', padding: '11px 28px', display: 'inline-block', fontSize: 14 }}
        >
          Подключить эксперта
        </button>
      </div>

      {/* Feature list */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {[
          'Эксперт видит твой рацион и помогает с корректировкой',
          'Персональная обратная связь по питанию и целям',
          'Ты сам выбираешь, какие данные доступны эксперту',
        ].map((label, i, arr) => (
          <div
            key={label}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Referral Section ──────────────────────────────────────────────────────

function ReferralSection() {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['referral-me'],
    queryFn: api.referralMe,
  });

  const { data: invitedData, isLoading: invitedLoading } = useQuery({
    queryKey: ['referral-my-invited'],
    queryFn: api.referralMyInvited,
    enabled: expanded,
  });

  function handleCopy() {
    if (!data?.link) return;
    navigator.clipboard.writeText(data.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => null);
  }

  const invited = invitedData?.invited ?? [];

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 10px' }}>
        Реферальная программа
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '16px' }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.5 }}>
          Приглашай друзей по своей ссылке — ты получишь бонусы, когда они подключатся.
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
            <div className="spinner" />
          </div>
        ) : data ? (
          <>
            {/* Link display */}
            <div style={{
              background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px',
              border: '1px solid var(--border)', marginBottom: 10,
              fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)',
              wordBreak: 'break-all', lineHeight: 1.5,
            }}>
              {data.link}
            </div>

            {/* Copy button + invited count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: data.invitedCount > 0 ? 12 : 0 }}>
              <button
                onClick={handleCopy}
                className="btn"
                style={{ flex: 1, fontSize: 14, padding: '11px 16px' }}
              >
                {copied ? 'Скопировано' : 'Скопировать ссылку'}
              </button>
              {data.invitedCount > 0 && (
                <div style={{
                  flexShrink: 0, background: 'var(--accent-soft)', borderRadius: 10,
                  padding: '10px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{data.invitedCount}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                    {data.invitedCount === 1 ? 'друг' : data.invitedCount < 5 ? 'друга' : 'друзей'}
                  </div>
                </div>
              )}
            </div>

            {/* Invited list expand/collapse */}
            {data.invitedCount > 0 && (
              <div>
                <button
                  onClick={() => setExpanded(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px 0',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                    Кто перешёл по ссылке
                  </span>
                  <span style={{
                    fontSize: 14, color: 'var(--text-3)',
                    display: 'inline-block',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.18s',
                  }}>
                    ▾
                  </span>
                </button>

                {expanded && (
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    {invitedLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                        <div className="spinner" style={{ width: 18, height: 18 }} />
                      </div>
                    ) : invited.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0' }}>
                        Пока никто не перешёл по вашей ссылке
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {invited.map((u, i) => {
                          const namePart = u.displayName || '';
                          const userPart = u.username ? `@${u.username}` : '';
                          const label = namePart && userPart
                            ? `${namePart} (${userPart})`
                            : namePart || userPart || `Пользователь ${i + 1}`;
                          const dateLabel = new Date(u.joinedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
                          return (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '9px 0',
                              borderBottom: i < invited.length - 1 ? '1px solid var(--border)' : 'none',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                  background: 'var(--accent-soft)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                                }}>
                                  {label.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
                                  {label}
                                </span>
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                                {dateLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0' }}>
            Не удалось загрузить ссылку
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen({ bootstrap, onSwitchToCoach, onSwitchToAdmin }: Props) {
  const navigate = useNavigate();

  const trainerStatus = bootstrap.trainerProfile?.verificationStatus;
  const isVerified = trainerStatus === 'verified' && !!onSwitchToCoach;

  return (
    <div className="screen">

      {/* User hero card */}
      <UserHeroCard bootstrap={bootstrap} onSwitchToCoach={isVerified ? onSwitchToCoach : undefined} />

      {/* Expert section */}
      <div style={{ marginBottom: 16 }}>
        <TrainerTab bootstrap={bootstrap} />
      </div>

      {/* Settings sections */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '16px 2px 10px' }}>
        Настройки
      </div>
      <ListCard>
        <ListItem label="Мои данные"   onClick={() => navigate('/profile/edit-data')} />
        <ListItem label="Подписка"     onClick={() => navigate('/subscription')} />
        <ListItem label="Уведомления"  onClick={() => navigate('/notifications')} />
        <ListItem label="Документы"    onClick={() => navigate('/documents')} />
        <ListItem label="Связать аккаунт" onClick={() => navigate('/account-link')} />
        <ListItem
          label={<span style={{ color: 'var(--accent)', fontWeight: 600 }}>Поддержка</span>}
          onClick={() => {
            api.trackEvent('support_clicked');
            const supportUrl = detectPlatform() === 'max'
              ? (import.meta.env.VITE_SUPPORT_URL_MAX || 'https://t.me/EATLYY_help')
              : 'https://t.me/EATLYY_help';
            window.open(supportUrl, '_blank');
          }}
        />
      </ListCard>

      {/* Expert status / apply (only for non-verified trainers) */}
      {!isVerified && (
        <div style={{ marginTop: 6 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)', borderRadius: 'var(--r-md)',
            padding: '13px 16px', border: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>Тренерский кабинет</span>
            <ExpertChip status={trainerStatus} />
          </div>
        </div>
      )}

      <ReferralSection />

      {onSwitchToAdmin && (
        <button
          onClick={onSwitchToAdmin}
          style={{
            width: '100%', marginTop: 16, padding: '14px 16px', borderRadius: 'var(--r-xl)',
            background: 'rgba(52,199,89,0.15)', border: '1px solid rgba(52,199,89,0.4)',
            color: '#34C759', fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: -0.2,
          }}
        >
          Панель администратора
        </button>
      )}

    </div>
  );
}
