import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';

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

  const [heightCm, setHeightCm] = useState('');
  const [currentWeightKg, setCurrentWeightKg] = useState('');
  const [desiredWeightKg, setDesiredWeightKg] = useState('');
  const [sex, setSex] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [city, setCity] = useState('');

  // Pre-fill once data loads (only if state is still empty)
  if (p && heightCm === '' && currentWeightKg === '' && birthDate === '') {
    if (p.heightCm) setHeightCm(String(p.heightCm));
    if (p.currentWeightKg) setCurrentWeightKg(String(p.currentWeightKg));
    if (p.desiredWeightKg) setDesiredWeightKg(String(p.desiredWeightKg));
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
      const h = parseFloat(heightCm);
      const w = parseFloat(currentWeightKg);
      const dw = parseFloat(desiredWeightKg);
      const al = parseFloat(activityLevel);
      if (!isNaN(h) && h > 0) body.heightCm = h;
      if (!isNaN(w) && w > 0) body.currentWeightKg = w;
      if (!isNaN(dw) && dw > 0) body.desiredWeightKg = dw;
      if (sex) body.sex = sex;
      if (birthDate) body.birthDate = birthDate;
      if (!isNaN(al) && al > 0) body.activityLevel = al;
      if (city.trim()) body.city = city.trim();

      await api.patchProfileData(body);
      await qc.invalidateQueries({ queryKey: ['bootstrap'] });
      await qc.invalidateQueries({ queryKey: ['profile-full'] });
      navigate('/diary');
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/diary')}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--tg-theme-button-color, #007aff)' }}
        >
          ‹
        </button>
        <h1 style={{ margin: 0, fontSize: 20 }}>Мои данные</h1>
      </div>

      <div className="card">
        <div className="card-title">Физические данные</div>
        <FieldRow label="Рост (см)">
          <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="170" style={inputStyle} />
        </FieldRow>
        <FieldRow label="Вес (кг)">
          <input type="number" value={currentWeightKg} onChange={e => setCurrentWeightKg(e.target.value)} placeholder="70" style={inputStyle} />
        </FieldRow>
        <FieldRow label="Желаемый вес (кг)">
          <input type="number" value={desiredWeightKg} onChange={e => setDesiredWeightKg(e.target.value)} placeholder="65" style={inputStyle} />
        </FieldRow>
      </div>

      <div className="card">
        <div className="card-title">О себе</div>
        <FieldRow label="Пол">
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'male', l: '👨 Мужской' }, { v: 'female', l: '👩 Женский' }].map(opt => (
              <button
                key={opt.v}
                onClick={() => setSex(opt.v)}
                className={`btn ${sex === opt.v ? '' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '7px 4px', fontSize: 13 }}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </FieldRow>
        <FieldRow label="Дата рождения">
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={inputStyle} />
        </FieldRow>
        <FieldRow label="Город">
          <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Москва" style={inputStyle} />
        </FieldRow>
      </div>

      <div className="card">
        <div className="card-title">Уровень активности</div>
        {ACTIVITY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setActivityLevel(String(opt.value))}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
              background: String(activityLevel) === String(opt.value) ? 'var(--tg-theme-button-color, #007aff)' : 'none',
              color: String(activityLevel) === String(opt.value) ? '#fff' : 'var(--tg-theme-text-color, #000)',
              border: 'none', borderRadius: 8, fontSize: 14, marginBottom: 4,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ color: '#dc3545', fontSize: 14, marginBottom: 12, padding: '8px 12px', background: '#f8d7da', borderRadius: 8 }}>
          {error}
        </div>
      )}

      <button className="btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Сохраняем...' : 'Сохранить'}
      </button>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #888)', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 8,
  fontSize: 15,
  background: 'var(--tg-theme-bg-color, #f0f0f0)',
  color: 'var(--tg-theme-text-color, #000)',
  outline: 'none',
};
