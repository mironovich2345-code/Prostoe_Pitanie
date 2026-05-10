import { useState, useRef, useEffect } from 'react';
import { api } from '../../api/client';

interface Props {
  onBack: () => void;
  onGoManual: () => void;
  initialBarcode?: string;
  initialName?: string;
  source?: 'barcode_not_found' | 'search_not_found' | 'manual';
}

type Field = 'name' | 'brand' | 'barcode' | 'packageWeightG' | 'calories' | 'protein' | 'fat' | 'carbs';

function NumInput({ label, value, onChange, required, suffix = 'на 100 г', placeholder = '0' }: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; suffix?: string; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 5 }}>
        {label}{required && <span style={{ color: 'var(--accent)' }}> *</span>}
        {suffix && <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 4, textTransform: 'none', letterSpacing: 0 }}>({suffix})</span>}
      </div>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--surface)', border: '1px solid var(--border-2)',
          borderRadius: 'var(--r-md)', padding: '12px 14px',
          fontSize: 16, color: 'var(--text)', outline: 'none',
        }}
      />
    </div>
  );
}

export default function SubmitProductStep({ onBack, onGoManual, initialBarcode = '', initialName = '', source }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.trackEvent('product_submission_opened', { source: source ?? 'manual', hasBarcode: !!initialBarcode }).catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [name, setName]             = useState(initialName);
  const [brand, setBrand]           = useState('');
  const [barcode, setBarcode]       = useState(initialBarcode);
  const [pkgWeight, setPkgWeight]   = useState('');
  const [calories, setCalories]     = useState('');
  const [protein, setProtein]       = useState('');
  const [fat, setFat]               = useState('');
  const [carbs, setCarbs]           = useState('');
  const [isHighSugar, setHighSugar] = useState(false);
  const [photoPreview, setPhoto]    = useState<string | null>(null);
  const [photoData, setPhotoData]   = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [done, setDone]             = useState(false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Фото не более 5 МБ'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result as string;
      setPhotoData(data);
      setPhoto(data);
      setError('');
    };
    reader.readAsDataURL(file);
  }

  function validate(): string | null {
    if (!name.trim()) return 'Введите название продукта';
    const cal  = parseFloat(calories.replace(',', '.'));
    const pro  = parseFloat(protein.replace(',', '.'));
    const fatV = parseFloat(fat.replace(',', '.'));
    const carb = parseFloat(carbs.replace(',', '.'));
    if (!isFinite(cal)  || cal  < 0 || cal  > 1000) return 'Калории: введите число 0–1000';
    if (!isFinite(pro)  || pro  < 0 || pro  > 100)  return 'Белки: введите число 0–100';
    if (!isFinite(fatV) || fatV < 0 || fatV > 100)  return 'Жиры: введите число 0–100';
    if (!isFinite(carb) || carb < 0 || carb > 100)  return 'Углеводы: введите число 0–100';
    if (pkgWeight.trim()) {
      const pkg = parseFloat(pkgWeight.replace(',', '.'));
      if (!isFinite(pkg) || pkg <= 0 || pkg > 10000) return 'Вес упаковки: введите число 1–10000';
    }
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSubmitting(true);
    try {
      const cal  = parseFloat(calories.replace(',', '.'));
      const pro  = parseFloat(protein.replace(',', '.'));
      const fatV = parseFloat(fat.replace(',', '.'));
      const carb = parseFloat(carbs.replace(',', '.'));
      const pkg  = pkgWeight.trim() ? parseFloat(pkgWeight.replace(',', '.')) : undefined;
      const bc   = barcode.replace(/\D/g, '') || undefined;

      await api.productsSubmit({
        name: name.trim(),
        brand: brand.trim() || undefined,
        barcode: bc,
        packageWeightG: pkg,
        caloriesPer100g: cal,
        proteinPer100g: pro,
        fatPer100g: fatV,
        carbsPer100g: carb,
        isHighSugar,
        imageData: photoData ?? undefined,
      });
      api.trackEvent('product_submission_created', { source: source ?? 'manual', hasBarcode: !!bc, hasPhoto: !!photoData }).catch(() => null);
      setDone(true);
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      api.trackEvent('product_submission_failed', { source: source ?? 'manual', reason: msg || 'unknown' }).catch(() => null);
      if (msg === 'PRODUCT_ALREADY_EXISTS' || msg.includes('уже есть')) {
        setError('Этот продукт уже есть в базе. Попробуйте поиск.');
      } else {
        setError('Не удалось отправить. Попробуйте ещё раз.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Заявка отправлена!</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 32 }}>
            Продукт появится в базе после проверки администратором.
          </div>

          <button
            className="btn"
            style={{ width: '100%', fontSize: 14, marginBottom: 12 }}
            onClick={onGoManual}
          >
            Добавить сейчас описанием
          </button>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: 14 }}
            onClick={onBack}
          >
            Вернуться к поиску
          </button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
        >
          ‹
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Добавить продукт в базу
        </h1>
      </div>

      {/* Name */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 5 }}>
          Название <span style={{ color: 'var(--accent)' }}>*</span>
        </div>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          placeholder="Например: Гречка, Молоко 3.2%"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--surface)', border: '1px solid var(--border-2)',
            borderRadius: 'var(--r-md)', padding: '12px 14px',
            fontSize: 16, color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      {/* Brand */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 5 }}>Бренд</div>
        <input
          type="text"
          value={brand}
          onChange={e => setBrand(e.target.value)}
          placeholder="Например: Мистраль, Простоквашино"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--surface)', border: '1px solid var(--border-2)',
            borderRadius: 'var(--r-md)', padding: '12px 14px',
            fontSize: 16, color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      {/* Barcode */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 5 }}>Штрихкод</div>
        <input
          type="text"
          inputMode="numeric"
          value={barcode}
          onChange={e => setBarcode(e.target.value.replace(/\D/g, ''))}
          placeholder="4600936001313"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--surface)', border: '1px solid var(--border-2)',
            borderRadius: 'var(--r-md)', padding: '12px 14px',
            fontSize: 16, color: 'var(--text)', outline: 'none', letterSpacing: 1,
          }}
        />
      </div>

      {/* Package weight */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 5 }}>Вес упаковки, г</div>
        <input
          type="number"
          inputMode="decimal"
          min="1"
          value={pkgWeight}
          onChange={e => setPkgWeight(e.target.value)}
          placeholder="500"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--surface)', border: '1px solid var(--border-2)',
            borderRadius: 'var(--r-md)', padding: '12px 14px',
            fontSize: 16, color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      {/* КБЖУ */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 10, marginTop: 4 }}>
        КБЖУ на 100 г <span style={{ color: 'var(--accent)' }}>*</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {([
          { label: 'Ккал', value: calories, set: setCalories, max: 1000 },
          { label: 'Белки, г', value: protein, set: setProtein, max: 100 },
          { label: 'Жиры, г', value: fat, set: setFat, max: 100 },
          { label: 'Углеводы, г', value: carbs, set: setCarbs, max: 100 },
        ] as const).map(({ label, value, set }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={value}
              onChange={e => { (set as (v: string) => void)(e.target.value); setError(''); }}
              placeholder="0"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface)', border: '1px solid var(--border-2)',
                borderRadius: 'var(--r-md)', padding: '10px 12px',
                fontSize: 16, color: 'var(--text)', outline: 'none',
              }}
            />
          </div>
        ))}
      </div>

      {/* High sugar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 16,
      }}>
        <span style={{ fontSize: 14, color: 'var(--text)' }}>Высокий сахар</span>
        <button
          onClick={() => setHighSugar(v => !v)}
          style={{
            width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
            background: isHighSugar ? 'var(--accent)' : 'var(--border-2)',
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: isHighSugar ? 21 : 3,
            width: 20, height: 20, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {/* Photo */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 8 }}>
          Фото упаковки / этикетки
        </div>
        {photoPreview ? (
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <img
              src={photoPreview}
              alt="preview"
              style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}
            />
            <button
              onClick={() => { setPhoto(null); setPhotoData(null); }}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
                width: 28, height: 28, color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}
            >✕</button>
          </div>
        ) : (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 13, width: '100%' }}
            onClick={() => fileInputRef.current?.click()}
          >
            Загрузить фото
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handlePhotoChange}
        />
      </div>

      {/* Moderation note */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 20,
        fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5,
      }}>
        Продукт появится в базе после проверки администратором.
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}

      <button
        className="btn"
        style={{ fontSize: 15, width: '100%', marginBottom: 10 }}
        disabled={submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Отправляем...' : 'Отправить на проверку'}
      </button>

      <button
        className="btn btn-secondary"
        style={{ fontSize: 13, width: '100%' }}
        onClick={onGoManual}
      >
        Добавить сейчас описанием
      </button>
    </div>
  );
}
