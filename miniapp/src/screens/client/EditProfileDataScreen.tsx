import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { PageHeader } from '../../ui';

const ACTIVITY_OPTIONS = [
  { value: 1.2,   label: '🛋 Почти нет активности' },
  { value: 1.375, label: '🚶 Лёгкая (1–2 раза/нед)' },
  { value: 1.55,  label: '🚴 Средняя (3–5 раз/нед)' },
  { value: 1.725, label: '🏋 Высокая (6–7 раз/нед)' },
  { value: 1.9,   label: '⚡ Очень высокая' },
];

export default function EditProfileDataScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['profile-full'],
    queryFn: api.profile,
  });

  const p = data?.profile;

  const [sex, setSex] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [city, setCity] = useState('');

  // Pre-fill once data loads (only if state is still empty)
  if (p && sex === '' && birthDate === '') {
    if (p.sex) setSex(p.sex);
    if (p.birthDate) setBirthDate(p.birthDate.split('T')[0]);
    if (p.activityLevel) setActivityLevel(String(p.activityLevel));
    if (p.city) setCity(p.city);
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body: Parameters<typeof api.patchProfileData>[0] = {};
      const al = parseFloat(activityLevel);
      if (sex) body.sex = sex;
      if (birthDate) body.birthDate = birthDate;
      if (!isNaN(al) && al > 0) body.activityLevel = al;
      if (city.trim()) body.city = city.trim();

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
        <FieldRow label="Пол">
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'male', l: '👨 Мужской' }, { v: 'female', l: '👩 Женский' }].map(opt => (
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
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={inputStyle} />
        </FieldRow>
        <FieldRow label="Город" isLast>
          <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Москва" style={inputStyle} />
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
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', textAlign: 'left', padding: '13px 18px',
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text)',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                fontSize: 14, fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <span>{opt.label}</span>
              {active && <span style={{ fontSize: 15, color: 'var(--accent)' }}>✓</span>}
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
