import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { PageHeader } from '../../ui';

// ── Activity levels ──────────────────────────────────────────────────

const ACTIVITY_OPTIONS = [
  {
    value: 1.2,
    title: 'Почти нет активности',
    description: 'Сидячая работа, минимум движения в течение дня',
    example: 'Офис, дом, редкие прогулки',
    steps: '< 4 000 шагов / день',
  },
  {
    value: 1.375,
    title: 'Лёгкая активность',
    description: 'Несколько прогулок и лёгких нагрузок в неделю',
    example: 'Ходьба, зарядка, йога 1–3 раза/нед',
    steps: '4 000–7 000 шагов / день',
  },
  {
    value: 1.55,
    title: 'Средняя активность',
    description: 'Регулярные тренировки несколько раз в неделю',
    example: 'Зал, бег, велосипед 3–5 раз/нед',
    steps: '7 000–12 000 шагов / день',
  },
  {
    value: 1.725,
    title: 'Высокая активность',
    description: 'Интенсивные нагрузки почти каждый день',
    example: 'Ежедневный спорт или физическая работа',
    steps: '12 000–17 000 шагов / день',
  },
  {
    value: 1.9,
    title: 'Очень высокая',
    description: 'Профессиональный спорт или двойные тренировки',
    example: 'Соревновательный уровень нагрузок',
    steps: '> 17 000 шагов / день',
  },
];

// ── Screen ───────────────────────────────────────────────────────────

export default function EditProfileDataScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['profile-full'],
    queryFn: api.profile,
  });

  const p = data?.profile;

  const [preferredName, setPreferredName] = useState('');
  const [sex, setSex] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [activityLevel, setActivityLevel] = useState('');

  // Pre-fill once data loads (only if state is still empty)
  if (p && sex === '' && birthDate === '') {
    if (p.preferredName) setPreferredName(p.preferredName);
    if (p.sex) setSex(p.sex);
    if (p.birthDate) setBirthDate(p.birthDate.split('T')[0]);
    if (p.activityLevel) setActivityLevel(String(p.activityLevel));
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body: Parameters<typeof api.patchProfileData>[0] = {};
      const al = parseFloat(activityLevel);
      if (preferredName.trim()) body.preferredName = preferredName.trim();
      if (sex) body.sex = sex;
      if (birthDate) body.birthDate = birthDate;
      if (!isNaN(al) && al > 0) body.activityLevel = al;

      await api.patchProfileData(body);
      await qc.invalidateQueries({ queryKey: ['bootstrap'] });
      await qc.invalidateQueries({ queryKey: ['profile-full'] });
      navigate('/profile');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  return (
    <div className="screen">
      <PageHeader title="Мои данные" onBack={() => navigate('/profile')} />

      {/* Physical data — tap to open wheel picker */}
      <GroupCard>
        <GroupLabel>Физические данные</GroupLabel>
        <PickerRow
          label="Рост"
          value={p?.heightCm ? `${Math.round(p.heightCm)} см` : null}
          placeholder="Не задан"
          onClick={() => navigate('/profile/pick/height')}
        />
        <PickerRow
          label="Текущий вес"
          value={p?.currentWeightKg ? `${(Math.round(p.currentWeightKg * 10) / 10).toFixed(1)} кг` : null}
          placeholder="Не задан"
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

        {/* Preferred name with gender-based hint */}
        <FieldRow label="Как к вам обращаться">
          <input
            value={preferredName}
            onChange={e => setPreferredName(e.target.value)}
            placeholder="Введите имя или прозвище"
            maxLength={40}
            style={inputStyle}
          />
          {/* Gender-based hint — shown when field is empty and sex is selected */}
          {!preferredName && sex && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {sex === 'male' ? 'Например: Крутой перец' : 'Например: Крутая леди'}
              </span>
              <button
                onClick={() => setPreferredName(sex === 'male' ? 'Крутой перец' : 'Крутая леди')}
                style={{
                  background: 'var(--accent-soft)', border: 'none', borderRadius: 6,
                  padding: '3px 10px', fontSize: 11, fontWeight: 600,
                  color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Использовать
              </button>
            </div>
          )}
        </FieldRow>

        <FieldRow label="Пол">
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
        <FieldRow label="Дата рождения">
          <input
            type="date" value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
            style={inputStyle}
          />
        </FieldRow>
        <FieldRow label="Город" isLast>
          {/* City is edited via a separate screen to ensure correct timezone resolution */}
          <button
            onClick={() => navigate('/profile/pick-city')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border-2)',
              borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 15, color: p?.city ? 'var(--text)' : 'var(--text-3)', fontWeight: p?.city ? 600 : 400 }}>
              {p?.city ?? 'Не задан'}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>›</span>
          </button>
        </FieldRow>
      </GroupCard>

      {/* Activity level */}
      <GroupCard>
        <GroupLabel>Уровень активности</GroupLabel>
        {ACTIVITY_OPTIONS.map((opt, i) => {
          const active = String(activityLevel) === String(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => setActivityLevel(String(opt.value))}
              style={{
                display: 'block',
                width: '100%', textAlign: 'left', padding: '14px 18px 16px',
                background: active ? 'var(--accent-soft)' : 'transparent',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {/* Title row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{
                  fontSize: 15, fontWeight: 600,
                  color: active ? 'var(--accent)' : 'var(--text)',
                }}>
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
              {/* Description */}
              <div style={{ fontSize: 13, color: active ? 'rgba(215,255,63,0.75)' : 'var(--text-2)', marginBottom: 4, lineHeight: 1.35 }}>
                {opt.description}
              </div>
              {/* Example + Steps */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>{opt.example}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: active ? 'var(--text-3)' : 'var(--text-3)',
                  background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 5,
                  border: '1px solid var(--border)', whiteSpace: 'nowrap',
                }}>
                  {opt.steps}
                </span>
              </div>
            </button>
          );
        })}
      </GroupCard>

      {error && (
        <div style={{
          color: 'var(--danger)', fontSize: 13, marginBottom: 12,
          padding: '10px 14px', background: 'rgba(255,87,87,0.1)',
          borderRadius: 8, border: '1px solid rgba(255,87,87,0.2)',
        }}>
          {error}
        </div>
      )}

      <button className="btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Сохраняем...' : 'Сохранить'}
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

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '12px 18px 2px',
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 1, color: 'var(--text-3)',
    }}>
      {children}
    </div>
  );
}

function FieldRow({ label, children, isLast }: { label: string; children: React.ReactNode; isLast?: boolean }) {
  return (
    <div style={{
      padding: '10px 18px 14px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function PickerRow({ label, value, placeholder, isLast, onClick }: {
  label: string;
  value: string | null;
  placeholder: string;
  isLast?: boolean;
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
      <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: value ? 'var(--text)' : 'var(--text-3)' }}>
          {value ?? placeholder}
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-3)' }}>›</span>
      </div>
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border-2)',
  borderRadius: 8,
  fontSize: 15,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
};
