import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useTrackEvent } from '../../hooks/useTrackEvent';

// ── Activity levels ──────────────────────────────────────────────────

const ACTIVITY_OPTIONS = [
  {
    value: 1.2,
    title: 'Почти нет активности',
    description: 'Сидячая работа, минимум движения',
    steps: '< 4 000 шагов / день',
  },
  {
    value: 1.375,
    title: 'Лёгкая активность',
    description: 'Несколько прогулок и лёгких нагрузок в неделю',
    steps: '4 000–7 000 шагов / день',
  },
  {
    value: 1.55,
    title: 'Средняя активность',
    description: 'Регулярные тренировки несколько раз в неделю',
    steps: '7 000–12 000 шагов / день',
  },
  {
    value: 1.725,
    title: 'Высокая активность',
    description: 'Интенсивные нагрузки почти каждый день',
    steps: '12 000–17 000 шагов / день',
  },
  {
    value: 1.9,
    title: 'Очень высокая',
    description: 'Профессиональный спорт или двойные тренировки',
    steps: '> 17 000 шагов / день',
  },
];

// ── Screen ───────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  useTrackEvent('onboarding_started');
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Load profile-full so the PickerRows can show already-set values
  // (e.g. if user partially filled data via bot before opening mini app)
  const { data } = useQuery({
    queryKey: ['profile-full'],
    queryFn: api.profile,
  });
  const p = data?.profile;

  const [sex, setSex] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [goalType, setGoalType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill once when profile loads (only if state is still blank)
  if (p && sex === '' && birthDate === '' && activityLevel === '') {
    if (p.sex) setSex(p.sex);
    if (p.birthDate) setBirthDate(p.birthDate.split('T')[0]);
    if (p.activityLevel) setActivityLevel(String(p.activityLevel));
    if (p.goalType) setGoalType(p.goalType);
  }

  const canSave = !!sex && !!birthDate && !!activityLevel && !!(p?.heightCm) && !!(p?.currentWeightKg);

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const body: Parameters<typeof api.patchProfileData>[0] = {};
      const al = parseFloat(activityLevel);
      if (sex) body.sex = sex;
      if (birthDate) body.birthDate = birthDate;
      if (!isNaN(al) && al > 0) body.activityLevel = al;
      if (goalType) body.goalType = goalType;

      await api.patchProfileData(body);
      api.trackEvent('onboarding_completed');
      await qc.invalidateQueries({ queryKey: ['bootstrap'] });
      await qc.invalidateQueries({ queryKey: ['profile-full'] });
      navigate('/', { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen" style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ padding: '28px 20px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
          Настройка профиля
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Заполните данные, чтобы получать точный расчёт калорий и рекомендации
        </div>
      </div>

      {/* Physical data */}
      <GroupCard>
        <GroupLabel>Физические данные</GroupLabel>
        <PickerRow
          label="Рост"
          value={p?.heightCm ? `${Math.round(p.heightCm)} см` : null}
          placeholder="Не задан"
          required
          onClick={() => navigate('/profile/pick/height')}
        />
        <PickerRow
          label="Текущий вес"
          value={p?.currentWeightKg ? `${(Math.round(p.currentWeightKg * 10) / 10).toFixed(1)} кг` : null}
          placeholder="Не задан"
          required
          onClick={() => navigate('/profile/pick/weight')}
        />
        <PickerRow
          label="Желаемый вес"
          value={p?.desiredWeightKg ? `${(Math.round(p.desiredWeightKg * 10) / 10).toFixed(1)} кг` : null}
          placeholder="Не задан"
          isLast
          onClick={() => navigate('/profile/pick/desired-weight')}
        />
      </GroupCard>

      {/* Personal info */}
      <GroupCard>
        <GroupLabel>О себе</GroupLabel>

        <FieldRow label="Пол" required>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'male', l: 'Мужской' }, { v: 'female', l: 'Женский' }].map(opt => (
              <button
                key={opt.v}
                onClick={() => setSex(opt.v)}
                style={{
                  flex: 1, padding: '9px 4px', fontSize: 13, fontWeight: 600,
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: sex === opt.v ? 'var(--accent)' : 'var(--surface-2)',
                  color: sex === opt.v ? '#000' : 'var(--text-2)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Дата рождения" isLast required>
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface-2)', border: '1px solid var(--border-2)',
              borderRadius: 8, padding: '10px 12px',
              fontSize: 15, color: birthDate ? 'var(--text)' : 'var(--text-3)',
              fontWeight: birthDate ? 600 : 400,
              pointerEvents: 'none',
            }}>
              <span>
                {birthDate
                  ? new Date(birthDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'Не задана'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>›</span>
            </div>
            <input
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer',
              }}
            />
          </div>
        </FieldRow>
      </GroupCard>

      {/* Activity level */}
      <GroupCard>
        <GroupLabel required>Уровень активности</GroupLabel>
        {ACTIVITY_OPTIONS.map((opt, i) => {
          const active = String(activityLevel) === String(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => setActivityLevel(String(opt.value))}
              style={{
                display: 'block',
                width: '100%', textAlign: 'left', padding: '12px 18px 14px',
                background: active ? 'var(--accent-soft)' : 'transparent',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text)' }}>
                  {opt.title}
                </span>
                {active && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                    background: 'rgba(215,255,63,0.14)', padding: '2px 8px', borderRadius: 6,
                  }}>
                    Выбрано
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: active ? 'rgba(215,255,63,0.75)' : 'var(--text-2)', marginBottom: 3 }}>
                {opt.description}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 5,
                border: '1px solid var(--border)',
              }}>
                {opt.steps}
              </span>
            </button>
          );
        })}
      </GroupCard>

      {/* Goal type */}
      <GroupCard>
        <GroupLabel>Цель</GroupLabel>
        {[
          { v: 'lose', l: 'Похудение', d: 'Снизить вес' },
          { v: 'maintain', l: 'Поддержание', d: 'Сохранить вес' },
          { v: 'gain', l: 'Набор массы', d: 'Увеличить вес' },
          { v: 'track', l: 'Контроль питания', d: 'Следить за КБЖУ' },
        ].map((opt, i) => {
          const active = goalType === opt.v;
          return (
            <button
              key={opt.v}
              onClick={() => setGoalType(opt.v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', textAlign: 'left', padding: '13px 18px',
                background: active ? 'var(--accent-soft)' : 'transparent',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>
                  {opt.l}
                </div>
                <div style={{ fontSize: 12, color: active ? 'rgba(215,255,63,0.75)' : 'var(--text-3)' }}>
                  {opt.d}
                </div>
              </div>
              {active && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                  background: 'rgba(215,255,63,0.14)', padding: '2px 8px', borderRadius: 6,
                  flexShrink: 0,
                }}>
                  Выбрано
                </span>
              )}
            </button>
          );
        })}
      </GroupCard>

      {!canSave && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginBottom: 12 }}>
          Заполните рост, вес, пол, дату рождения и уровень активности
        </div>
      )}

      {error && (
        <div style={{
          color: 'var(--danger)', fontSize: 13, marginBottom: 12,
          padding: '10px 14px', background: 'rgba(255,87,87,0.1)',
          borderRadius: 8, border: '1px solid rgba(255,87,87,0.2)',
        }}>
          {error}
        </div>
      )}

      <button
        className="btn"
        onClick={handleSave}
        disabled={!canSave || saving}
        style={{ opacity: canSave ? 1 : 0.45 }}
      >
        {saving ? 'Сохраняем...' : 'Начать'}
      </button>
    </div>
  );
}

// ── Local components ─────────────────────────────────────────────────

function GroupCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)', marginBottom: 10, overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

function GroupLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{
      padding: '12px 18px 2px',
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 1, color: 'var(--text-3)',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      {children}
      {required && <span style={{ color: 'var(--accent)', fontSize: 13, lineHeight: 1 }}>*</span>}
    </div>
  );
}

function FieldRow({ label, children, isLast, required }: {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
  required?: boolean;
}) {
  return (
    <div style={{
      padding: '10px 18px 14px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      <label style={{
        fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center',
        gap: 4, marginBottom: 6, fontWeight: 500,
      }}>
        {label}
        {required && <span style={{ color: 'var(--accent)', fontSize: 13, lineHeight: 1 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function PickerRow({ label, value, placeholder, isLast, required, onClick }: {
  label: string;
  value: string | null;
  placeholder: string;
  isLast?: boolean;
  required?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', textAlign: 'left', padding: '14px 18px',
        background: 'transparent', border: 'none',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
        {required && !value && <span style={{ color: 'var(--accent)', fontSize: 13, lineHeight: 1 }}>*</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: value ? 'var(--text)' : 'var(--text-3)' }}>
          {value ?? placeholder}
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-3)' }}>›</span>
      </div>
    </button>
  );
}
