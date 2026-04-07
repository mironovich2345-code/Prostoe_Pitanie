import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BootstrapData, TrainerVerificationStatus } from '../../types';
import { Chip, ListCard, ListItem } from '../../ui';
import RoleSwitcher from '../../components/RoleSwitcher';

interface Props {
  bootstrap: BootstrapData;
  onSwitchToCoach?: () => void;
}

type ProfileTab = 'weight' | 'trainer';

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'weight',  label: 'Вес'    },
  { key: 'trainer', label: 'Эксперт' },
];

const ACTIVITY_LABELS: Record<number, string> = {
  1.2: 'Почти нет', 1.375: 'Лёгкая', 1.55: 'Средняя', 1.725: 'Высокая', 1.9: 'Очень высокая',
};

// ─── ExpertChip ────────────────────────────────────────────────────────────

function ExpertChip({ status }: { status: TrainerVerificationStatus | undefined }) {
  const navigate = useNavigate();
  if (status === 'pending')
    return <Chip variant="warn" onClick={() => navigate('/expert/status')} style={{ cursor: 'pointer' }}>На проверке</Chip>;
  if (status === 'rejected')
    return <Chip variant="danger" onClick={() => navigate('/expert/status')} style={{ cursor: 'pointer' }}>Отклонено</Chip>;
  if (status === 'blocked')
    return <Chip variant="muted" onClick={() => navigate('/expert/status')} style={{ cursor: 'pointer' }}>Заблокирован</Chip>;
  if (status === 'verified') return null; // handled by RoleSwitcher
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

function UserHeroCard({ bootstrap, onSwitchToCoach }: { bootstrap: BootstrapData; onSwitchToCoach?: () => void }) {
  const user = bootstrap.telegramUser;
  const p = bootstrap.profile;
  const trainerStatus = bootstrap.trainerProfile?.verificationStatus;
  const isVerified = trainerStatus === 'verified' && !!onSwitchToCoach;

  const firstName = user?.first_name ?? '';
  const lastName = user?.last_name ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Пользователь';
  // Use preferredName as display name when set; fall back to Telegram name
  const displayName = p?.preferredName?.trim() || fullName;
  const initial = fullName.charAt(0).toUpperCase() || displayName.charAt(0).toUpperCase();

  const age = p?.birthDate
    ? Math.floor((Date.now() - new Date(p.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const [localAvatar, setLocalAvatar] = useState<string | null>(p?.avatarData ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const avatarMutation = useMutation({
    mutationFn: api.patchProfileAvatar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bootstrap'] }),
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setLocalAvatar(base64);
      avatarMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--r-xl)',
      padding: '20px',
      border: '1px solid var(--border)',
      marginBottom: 12,
    }}>
      {/* Top row: avatar + info + role switcher */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: (p?.currentWeightKg || p?.desiredWeightKg) ? 16 : 0 }}>

        {/* Avatar with upload button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: localAvatar ? 'transparent' : 'var(--accent-soft)',
            border: '2px solid rgba(215,255,63,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: 'var(--accent)',
            overflow: 'hidden',
          }}>
            {localAvatar
              ? <img src={localAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initial
            }
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 22, height: 22, borderRadius: '50%',
              background: 'var(--accent)', border: '2px solid var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#000', padding: 0,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', lineHeight: 1.15, marginBottom: 4 }}>
            {displayName}
          </div>
          {/* Show Telegram username or full name as subtitle when preferredName is set */}
          {user?.username ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>@{user.username}</div>
          ) : p?.preferredName && fullName !== displayName ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>{fullName}</div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {p?.city && (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>📍 {p.city}</span>
            )}
            {age && (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{age} лет</span>
            )}
          </div>
        </div>

        {/* Role switcher for verified trainers */}
        {isVerified && (
          <div style={{ flexShrink: 0 }}>
            <RoleSwitcher mode="client" onChange={m => { if (m === 'coach') onSwitchToCoach!(); }} />
          </div>
        )}
      </div>

      {/* Mini stat tiles: weight + target */}
      {(p?.currentWeightKg || p?.desiredWeightKg) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {p?.currentWeightKg && (
            <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 12, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--text-3)', marginBottom: 4 }}>Вес</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', lineHeight: 1 }}>
                {p.currentWeightKg}
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)' }}> кг</span>
              </div>
            </div>
          )}
          {p?.desiredWeightKg && (
            <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 12, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--text-3)', marginBottom: 4 }}>Цель</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: 'var(--accent)', lineHeight: 1 }}>
                {p.desiredWeightKg}
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)' }}> кг</span>
              </div>
            </div>
          )}
          {p?.dailyCaloriesKcal && (
            <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 12, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--text-3)', marginBottom: 4 }}>Норма</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', lineHeight: 1 }}>
                {p.dailyCaloriesKcal}
                <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-3)' }}> кк</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function weightDeltaColor(delta: number, goalType: string | null | undefined): string {
  if (Math.abs(delta) < 0.01) return 'var(--text-3)';
  if (!goalType || goalType === 'maintain' || goalType === 'track') return 'var(--text-2)';
  if (goalType === 'gain') return delta > 0 ? 'var(--accent)' : 'var(--danger)';
  return delta < 0 ? 'var(--accent)' : 'var(--danger)'; // 'lose'
}

function deriveGoal(current: number | null | undefined, target: number | null | undefined): 'lose' | 'gain' | 'maintain' | null {
  if (!current || !target) return null;
  if (current > target + 0.05) return 'lose';
  if (current < target - 0.05) return 'gain';
  return 'maintain';
}

// ─── BMI Info Overlay ──────────────────────────────────────────────────────

function BmiInfoOverlay({ onClose }: { onClose: () => void }) {
  const BMI_RANGES = [
    { range: '< 18.5',     label: 'Дефицит веса', color: 'var(--warn)'   },
    { range: '18.5 – 24.9', label: 'Норма',        color: 'var(--accent)' },
    { range: '25 – 29.9',  label: 'Избыток веса',  color: 'var(--warn)'   },
    { range: '≥ 30',       label: 'Ожирение',      color: 'var(--danger)' },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200 }} />
      <div className="bottom-sheet">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.3 }}>
            Индекс массы тела
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--surface-2)', border: 'none',
              color: 'var(--text-3)', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, lineHeight: 1,
            }}
            aria-label="Закрыть"
          >✕</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>Что такое ИМТ</p>
          <p style={{ margin: '0 0 12px' }}>
            Ориентировочный показатель соотношения веса и роста. Не учитывает мышечную массу и индивидуальные особенности состава тела.
          </p>
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>Формула</p>
          <div style={{
            margin: '0 0 12px', padding: '8px 12px',
            background: 'var(--surface-2)', borderRadius: 10,
            fontSize: 12, color: 'var(--accent)', fontWeight: 600, letterSpacing: 0.1,
          }}>
            ИМТ = вес (кг) ÷ рост² (м)
          </div>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>Диапазоны</p>
          {BMI_RANGES.map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{row.range}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: row.color }}>{row.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Tab: Вес ──────────────────────────────────────────────────────────────

function WeightTab({ bootstrap }: { bootstrap: BootstrapData }) {
  const navigate = useNavigate();
  const p = bootstrap.profile;
  const [showBmiInfo, setShowBmiInfo] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['profile-full'],
    queryFn: api.profile,
  });
  const history = data?.weightHistory ?? [];

  const weight = p?.currentWeightKg;
  const target = p?.desiredWeightKg;
  const height = p?.heightCm;

  // BMI
  const bmi = weight && height ? weight / ((height / 100) ** 2) : null;
  const bmiLabel = bmi == null ? null
    : bmi < 18.5 ? 'Дефицит веса'
    : bmi < 25   ? 'Норма'
    : bmi < 30   ? 'Избыток веса'
    : 'Ожирение';
  const bmiColor = bmi == null ? 'var(--text-2)'
    : bmi < 18.5 ? 'var(--warn)'
    : bmi < 25   ? 'var(--accent)'
    : bmi < 30   ? 'var(--warn)'
    : 'var(--danger)';

  const diff = weight && target ? weight - target : null;

  if (!weight && !isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
        <div style={{ opacity: 0.2, marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Вес не указан</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24, lineHeight: 1.5 }}>
          Добавь данные о весе, чтобы отслеживать прогресс и динамику изменений
        </div>
        <button
          onClick={() => navigate('/profile/edit-data')}
          className="btn"
          style={{ width: 'auto', padding: '11px 28px', display: 'inline-block', fontSize: 14 }}
        >
          Добавить данные
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Main weight + target */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {/* Current weight — tappable → picker */}
        <div
          onClick={() => navigate('/profile/pick/weight')}
          style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '18px 16px', border: '1px solid var(--border)', cursor: 'pointer', position: 'relative' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)' }}>
              Текущий вес
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>✏</span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1.2, color: 'var(--text)', lineHeight: 1 }}>
            {weight?.toFixed(1) ?? '—'}
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-3)' }}> кг</span>
          </div>
          {height && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>Рост {height} см</div>
          )}
        </div>

        {/* Target weight — tappable → picker */}
        <div
          onClick={() => navigate(target ? '/profile/pick/desired-weight' : '/profile/pick/desired-weight')}
          style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '18px 16px', border: '1px solid var(--border)', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)' }}>
              Цель
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>✏</span>
          </div>
          {target ? (
            <>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1.2, color: 'var(--accent)', lineHeight: 1 }}>
                {target.toFixed(1)}
                <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-3)' }}> кг</span>
              </div>
              {diff !== null && (
                <div style={{ fontSize: 12, color: diff > 0 ? 'var(--text-3)' : 'var(--accent)', marginTop: 6 }}>
                  {diff > 0.05 ? `осталось ${diff.toFixed(1)} кг` : diff < -0.05 ? `набрать ${Math.abs(diff).toFixed(1)} кг` : 'цель достигнута'}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>Не задана</div>
          )}
        </div>
      </div>

      {/* BMI */}
      {bmi !== null && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '14px 16px',
          border: '1px solid var(--border)', marginBottom: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)' }}>
                Индекс массы тела
              </div>
              <button
                onClick={() => setShowBmiInfo(true)}
                style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: 'transparent', border: '1px solid var(--border-2, #2a2a2a)',
                  color: 'var(--text-3)', fontSize: 10, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, lineHeight: 1,
                }}
                aria-label="Что такое ИМТ"
              >?</button>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)', lineHeight: 1 }}>
              {bmi.toFixed(1)}
            </div>
          </div>
          <div style={{
            fontSize: 13, fontWeight: 600, color: bmiColor,
            background: 'var(--surface-2)', padding: '7px 14px',
            borderRadius: 20, border: '1px solid var(--border)',
          }}>
            {bmiLabel}
          </div>
        </div>
      )}
      {showBmiInfo && <BmiInfoOverlay onClose={() => setShowBmiInfo(false)} />}

      {/* Weight history */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
          <div className="spinner" />
        </div>
      ) : history.length > 0 ? (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '8px 2px 10px' }}>
            История
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {/* API returns DESC (newest first) — no reverse needed.
                arr[i+1] is the older entry → delta = newer − older = correct sign. */}
            {[...history].slice(0, 8).map((entry, i, arr) => {
              const prev = arr[i + 1]; // older entry (DESC order)
              const delta = prev ? entry.weightKg - prev.weightKg : null;
              const dateLabel = new Date(entry.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
              const goal = deriveGoal(weight, target);
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4, color: 'var(--text)', lineHeight: 1 }}>
                      {entry.weightKg.toFixed(1)}
                      <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}> кг</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{dateLabel}</div>
                  </div>
                  {delta !== null && (
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: weightDeltaColor(delta, goal),
                    }}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)} кг
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>История взвешиваний появится здесь</div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Тренер ───────────────────────────────────────────────────────────

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
          Эксперт не подключён
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.55, marginBottom: 24, maxWidth: 260, margin: '0 auto 24px' }}>
          Подключи персонального эксперта для контроля питания и достижения целей
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
          'Эксперт видит твою статистику питания',
          'Персональные рекомендации по рациону',
          'Обратная связь и корректировка целей',
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
                          const label = u.displayName ?? `Пользователь ${i + 1}`;
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

export default function ProfileScreen({ bootstrap, onSwitchToCoach }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ProfileTab>('weight');

  const trainerStatus = bootstrap.trainerProfile?.verificationStatus;
  const isVerified = trainerStatus === 'verified' && !!onSwitchToCoach;

  return (
    <div className="screen">

      {/* User hero card */}
      <UserHeroCard bootstrap={bootstrap} onSwitchToCoach={isVerified ? onSwitchToCoach : undefined} />

      {/* Segment tabs */}
      <div className="period-tabs" style={{ marginBottom: 16 }}>
        {PROFILE_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`period-tab${tab === t.key ? ' active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'weight'  && <WeightTab  bootstrap={bootstrap} />}
      {tab === 'trainer' && <TrainerTab bootstrap={bootstrap} />}

      {/* Settings sections */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '16px 2px 10px' }}>
        Настройки
      </div>
      <ListCard>
        <ListItem label="Мои данные"   onClick={() => navigate('/profile/edit-data')} />
        <ListItem label="Подписка"     onClick={() => navigate('/subscription')} />
        <ListItem label="Уведомления"  onClick={() => navigate('/notifications')} />
        <ListItem label="Документы"    onClick={() => navigate('/documents')} />
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

    </div>
  );
}
