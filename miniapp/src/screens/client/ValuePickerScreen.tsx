import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { PageHeader } from '../../ui';
import WheelPicker from '../../components/WheelPicker';

// ── Item arrays (computed once at module level) ──────────────────────

const HEIGHT_ITEMS = Array.from({ length: 111 }, (_, i) => String(120 + i));
// 30.0 … 250.0, step 0.1 → 2201 items
const WEIGHT_ITEMS = Array.from({ length: 2201 }, (_, i) => ((300 + i) / 10).toFixed(1));

// ── Field configuration ──────────────────────────────────────────────

type Field = 'height' | 'weight' | 'desired-weight';

interface FieldConfig {
  title: string;
  unit: string;
  items: string[];
  defaultItem: string;
  /** Returns initial item string from profile data */
  getInitial: (profile: { heightCm: number | null; currentWeightKg: number | null; desiredWeightKg: number | null }) => string | null;
  /** Calls the appropriate API */
  save: (value: string, qc: ReturnType<typeof useQueryClient>) => Promise<void>;
}

const FIELD_CONFIG: Record<Field, FieldConfig> = {
  height: {
    title: 'Рост',
    unit: 'см',
    items: HEIGHT_ITEMS,
    defaultItem: '170',
    getInitial: p => {
      if (!p.heightCm) return null;
      const rounded = String(Math.round(p.heightCm));
      return HEIGHT_ITEMS.includes(rounded) ? rounded : null;
    },
    save: async (value) => {
      await api.patchProfileData({ heightCm: parseInt(value, 10) });
    },
  },
  weight: {
    title: 'Текущий вес',
    unit: 'кг',
    items: WEIGHT_ITEMS,
    defaultItem: '70.0',
    getInitial: p => {
      if (!p.currentWeightKg) return null;
      const formatted = (Math.round(p.currentWeightKg * 10) / 10).toFixed(1);
      return WEIGHT_ITEMS.includes(formatted) ? formatted : null;
    },
    save: async (value) => {
      await api.logWeight(parseFloat(value));
    },
  },
  'desired-weight': {
    title: 'Желаемый вес',
    unit: 'кг',
    items: WEIGHT_ITEMS,
    defaultItem: '65.0',
    getInitial: p => {
      if (!p.desiredWeightKg) return null;
      const formatted = (Math.round(p.desiredWeightKg * 10) / 10).toFixed(1);
      return WEIGHT_ITEMS.includes(formatted) ? formatted : null;
    },
    save: async (value) => {
      await api.patchProfileData({ desiredWeightKg: parseFloat(value) });
    },
  },
};

function isValidField(s: string | undefined): s is Field {
  return s === 'height' || s === 'weight' || s === 'desired-weight';
}

// ── Screen ───────────────────────────────────────────────────────────

export default function ValuePickerScreen() {
  const { field } = useParams<{ field: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const config = isValidField(field) ? FIELD_CONFIG[field] : null;

  const { data, isLoading } = useQuery({
    queryKey: ['profile-full'],
    queryFn: api.profile,
    enabled: !!config,
  });

  const initialItem = useMemo(() => {
    if (!config) return config;
    const p = data?.profile;
    if (!p) return config.defaultItem;
    return config.getInitial(p) ?? config.defaultItem;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.profile, field]);

  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use initialItem as the effective value (selected overrides once user interacts)
  const effectiveValue = selected ?? initialItem ?? config?.defaultItem ?? '';

  if (!config) {
    return (
      <div className="screen">
        <PageHeader title="Ошибка" onBack={() => navigate(-1)} />
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)' }}>
          Неизвестный параметр
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  async function handleSave() {
    if (!config || saving) return;
    setSaving(true);
    setError(null);
    try {
      await config.save(effectiveValue, qc);
      await qc.invalidateQueries({ queryKey: ['bootstrap'] });
      await qc.invalidateQueries({ queryKey: ['profile-full'] });
      navigate(-1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
      setSaving(false);
    }
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader title={config.title} onBack={() => navigate(-1)} />

      {/* Current selection display */}
      <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
        <span style={{ fontSize: 52, fontWeight: 700, letterSpacing: -2, color: 'var(--text)', lineHeight: 1 }}>
          {effectiveValue}
        </span>
        <span style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-3)', marginLeft: 6 }}>
          {config.unit}
        </span>
      </div>

      {/* Picker */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 0 24px' }}>
        <WheelPicker
          items={config.items}
          value={effectiveValue}
          onChange={setSelected}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          color: 'var(--danger)', fontSize: 13, marginBottom: 12,
          padding: '10px 14px', background: 'var(--danger-soft)',
          borderRadius: 10, border: '1px solid rgba(255,87,87,0.2)',
        }}>
          {error}
        </div>
      )}

      {/* Save */}
      <button
        className="btn"
        onClick={handleSave}
        disabled={saving}
        style={{ marginTop: 8 }}
      >
        {saving ? 'Сохраняем...' : 'Сохранить'}
      </button>
    </div>
  );
}
