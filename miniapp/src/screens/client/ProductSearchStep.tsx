import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BootstrapData, Product } from '../../types';

// ─── Constants ──────────────────────────────────────────────────────────────

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Завтрак' },
  { key: 'lunch',     label: 'Обед'    },
  { key: 'dinner',    label: 'Ужин'    },
  { key: 'snack',     label: 'Перекус' },
];

function getDefaultMealType(tz?: string | null): string {
  const timezone = tz || 'Europe/Moscow';
  let hour: number;
  try {
    const fmt = new Intl.DateTimeFormat('en', { timeZone: timezone, hour: 'numeric', hour12: false });
    hour = parseInt(fmt.format(new Date()), 10);
    if (!isFinite(hour)) throw new Error('bad hour');
  } catch {
    hour = new Date().getHours();
  }
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 23) return 'dinner';
  return 'snack';
}

// ─── Confidence badge ────────────────────────────────────────────────────────

function ConfidenceLabel({ confidence }: { confidence: string }) {
  if (confidence === 'high') return null;
  const isLow = confidence === 'low';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
      background: isLow ? 'rgba(255,159,10,0.15)' : 'rgba(215,255,63,0.1)',
      color: isLow ? '#FF9F0A' : 'var(--text-3)',
      border: `1px solid ${isLow ? 'rgba(255,159,10,0.3)' : 'var(--border)'}`,
    }}>
      {isLow ? '⚠ Требует проверки' : '~ Средняя уверенность'}
    </span>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onDone: (mealType: string, mealDate: 'today' | 'yesterday') => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProductSearchStep({ onBack, onDone }: Props) {
  const qc = useQueryClient();
  const tz = (qc.getQueryData<BootstrapData>(['bootstrap']) as BootstrapData | undefined)?.profile?.timezone;

  // Search view
  const [tab, setTab] = useState<'search' | 'barcode'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  // Barcode view
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeSearching, setBarcodeSearching] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');

  // Selected product + add form
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [gramsInput, setGramsInput] = useState('100');
  const [mealType, setMealType] = useState(() => getDefaultMealType(tz));
  const [mealDate, setMealDate] = useState<'today' | 'yesterday'>('today');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // ─── Debounced name search ──────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.productsSearch(q);
        if (!cancelled) setSearchResults(res.items);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setGramsInput(p.packageWeightG != null ? String(Math.round(p.packageWeightG)) : '100');
    setAddError('');
  }

  async function handleBarcodeSearch() {
    const barcode = barcodeInput.replace(/\D/g, '').trim();
    if (!barcode) { setBarcodeError('Введите штрихкод'); return; }
    setBarcodeError('');
    setBarcodeSearching(true);
    try {
      const res = await api.productByBarcode(barcode);
      if (res.found && res.product) {
        selectProduct(res.product);
      } else {
        setBarcodeError('Продукт не найден. Попробуйте поиск по названию.');
      }
    } catch {
      setBarcodeError('Ошибка поиска. Попробуйте ещё раз.');
    } finally {
      setBarcodeSearching(false);
    }
  }

  async function handleAdd() {
    if (!selectedProduct) return;
    if (!gramsInput.trim()) { setAddError('Укажите вес продукта'); return; }
    const grams = parseFloat(gramsInput.replace(',', '.'));
    if (!isFinite(grams) || grams <= 0) { setAddError('Вес должен быть больше 0'); return; }
    if (grams > 5000) { setAddError('Укажите реальный вес продукта'); return; }
    setAddError('');
    setAdding(true);
    try {
      await api.nutritionAddProduct({ productId: selectedProduct.id, grams, mealType, mealDate });
      qc.invalidateQueries({ queryKey: ['diary'] });
      qc.invalidateQueries({ queryKey: ['nutrition-stats'] });
      onDone(mealType, mealDate);
    } catch {
      setAddError('Не удалось добавить продукт. Попробуйте ещё раз.');
    } finally {
      setAdding(false);
    }
  }

  // ─── КБЖУ preview ──────────────────────────────────────────────────────
  const g = parseFloat(gramsInput.replace(',', '.'));
  const previewValid = isFinite(g) && g > 0 && g <= 5000;
  const preview = previewValid && selectedProduct ? {
    cal:  Math.round(selectedProduct.caloriesPer100g * g / 100),
    pro:  Math.round(selectedProduct.proteinPer100g  * g / 100 * 10) / 10,
    fat:  Math.round(selectedProduct.fatPer100g      * g / 100 * 10) / 10,
    carb: Math.round(selectedProduct.carbsPer100g    * g / 100 * 10) / 10,
  } : null;

  const pkgG = selectedProduct?.packageWeightG != null
    ? Math.round(selectedProduct.packageWeightG)
    : null;

  // ─── SELECTED PRODUCT VIEW ────────────────────────────────────────────────
  if (selectedProduct) {
    return (
      <div className="screen">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setSelectedProduct(null)}
            style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
          >
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedProduct.name}
            </div>
            {selectedProduct.brand && (
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{selectedProduct.brand}</div>
            )}
          </div>
        </div>

        {/* Per 100g info */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', padding: '12px 16px', marginBottom: 18,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 6 }}>
            На 100 г
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 14 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{selectedProduct.caloriesPer100g}</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}> ккал</span>
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Б <span style={{ fontWeight: 600, color: '#7EB8F0' }}>{selectedProduct.proteinPer100g}</span>г</span>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Ж <span style={{ fontWeight: 600, color: '#F0A07A' }}>{selectedProduct.fatPer100g}</span>г</span>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>У <span style={{ fontWeight: 600, color: '#90C860' }}>{selectedProduct.carbsPer100g}</span>г</span>
          </div>
        </div>

        {/* Grams label */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 8 }}>
          Сколько граммов?
        </div>

        {/* Grams input */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            value={gramsInput}
            onChange={e => { setGramsInput(e.target.value); setAddError(''); }}
            placeholder="100"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface)', border: '1px solid var(--border-2)',
              borderRadius: 'var(--r-md)', padding: '16px 44px 16px 16px',
              fontSize: 22, fontWeight: 700, color: 'var(--text)', outline: 'none',
            }}
          />
          <span style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, fontWeight: 600, color: 'var(--text-3)', pointerEvents: 'none',
          }}>г</span>
        </div>

        {/* Quick gram chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[50, 100].map(v => (
            <button
              key={v}
              onClick={() => { setGramsInput(String(v)); setAddError(''); }}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)', cursor: 'pointer',
                border: `2px solid ${gramsInput === String(v) ? 'var(--accent)' : 'var(--border)'}`,
                background: gramsInput === String(v) ? 'var(--accent-soft)' : 'var(--surface)',
                color: gramsInput === String(v) ? 'var(--accent)' : 'var(--text-2)',
              }}
            >
              {v} г
            </button>
          ))}
          {pkgG != null && (
            <button
              onClick={() => { setGramsInput(String(pkgG)); setAddError(''); }}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)', cursor: 'pointer',
                border: `2px solid ${gramsInput === String(pkgG) ? 'var(--accent)' : 'var(--border)'}`,
                background: gramsInput === String(pkgG) ? 'var(--accent-soft)' : 'var(--surface)',
                color: gramsInput === String(pkgG) ? 'var(--accent)' : 'var(--text-2)',
              }}
            >
              {pkgG} г (упак.)
            </button>
          )}
        </div>

        {/* КБЖУ preview */}
        {preview && (
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border)', padding: '12px 16px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 6 }}>
              Итого на {g} г
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 14 }}>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{preview.cal}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}> ккал</span>
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Б <span style={{ fontWeight: 600, color: '#7EB8F0' }}>{preview.pro}</span>г</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Ж <span style={{ fontWeight: 600, color: '#F0A07A' }}>{preview.fat}</span>г</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>У <span style={{ fontWeight: 600, color: '#90C860' }}>{preview.carb}</span>г</span>
            </div>
          </div>
        )}

        {/* Meal type */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 8 }}>
          Тип приёма
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {MEAL_TYPES.map(mt => (
            <button
              key={mt.key}
              onClick={() => setMealType(mt.key)}
              style={{
                padding: '8px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--r-sm)',
                border: `2px solid ${mealType === mt.key ? 'var(--accent)' : 'var(--border)'}`,
                background: mealType === mt.key ? 'var(--accent-soft)' : 'var(--surface)',
                color: mealType === mt.key ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              {mt.label}
            </button>
          ))}
        </div>

        {/* Meal date */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 8 }}>
          Когда
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['today', 'yesterday'] as const).map(d => (
            <button
              key={d}
              onClick={() => setMealDate(d)}
              style={{
                flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)',
                border: `2px solid ${mealDate === d ? 'var(--accent)' : 'var(--border)'}`,
                background: mealDate === d ? 'var(--accent-soft)' : 'var(--surface)',
                color: mealDate === d ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              {d === 'today' ? 'Сегодня' : 'Вчера'}
            </button>
          ))}
        </div>

        {addError && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{addError}</div>
        )}

        <button
          className="btn"
          style={{ fontSize: 15 }}
          disabled={adding}
          onClick={handleAdd}
        >
          {adding ? 'Добавляем...' : '✓ Добавить в дневник'}
        </button>
      </div>
    );
  }

  // ─── SEARCH / BARCODE VIEW ────────────────────────────────────────────────
  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >
          ‹
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Продукт из базы
        </h1>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 3, marginBottom: 18 }}>
        {(['search', 'barcode'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setBarcodeError(''); }}
            style={{
              flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, borderRadius: 10,
              border: 'none', cursor: 'pointer',
              background: tab === t ? 'var(--accent-soft)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-3)',
            }}
          >
            {t === 'search' ? 'По названию' : 'По штрихкоду'}
          </button>
        ))}
      </div>

      {/* ── By-name search ── */}
      {tab === 'search' && (
        <>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Название продукта"
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface)', border: '1px solid var(--border-2)',
                borderRadius: 'var(--r-md)', padding: '14px 40px 14px 16px',
                fontSize: 16, color: 'var(--text)', outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-3)', fontSize: 18, lineHeight: 1, padding: 0,
                }}
              >✕</button>
            )}
          </div>

          {searching && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <div className="spinner" />
            </div>
          )}

          {!searching && searchQuery.trim().length < 2 && (
            <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '32px 0' }}>
              Введите не менее 2 символов
            </div>
          )}

          {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-xl)',
              border: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Ничего не найдено</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Попробуйте другой запрос или поиск по штрихкоду
              </div>
            </div>
          )}

          {!searching && searchResults.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10 }}>
                {searchResults.length === 1 ? '1 результат' : `${searchResults.length} результата`}
              </div>
              {searchResults.map(p => (
                <div key={p.id} style={{
                  background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                  border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 8,
                }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{p.name}</div>
                    {p.brand && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{p.brand}</div>}
                    {p.barcode && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Штрихкод: {p.barcode}</div>}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-3)', marginBottom: 5 }}>
                    На 100 г
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{p.caloriesPer100g}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}> ккал</span>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Б <span style={{ fontWeight: 600, color: '#7EB8F0' }}>{p.proteinPer100g}</span>г</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Ж <span style={{ fontWeight: 600, color: '#F0A07A' }}>{p.fatPer100g}</span>г</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>У <span style={{ fontWeight: 600, color: '#90C860' }}>{p.carbsPer100g}</span>г</span>
                  </div>

                  {(p.isHighSugar || p.confidence !== 'high' || p.packageWeightG != null) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10, alignItems: 'center' }}>
                      {p.packageWeightG != null && (
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Упак. {Math.round(p.packageWeightG)} г</span>
                      )}
                      {p.isHighSugar && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                          background: 'rgba(255,87,87,0.12)', color: 'var(--danger)',
                          border: '1px solid rgba(255,87,87,0.25)',
                        }}>Высокий сахар</span>
                      )}
                      <ConfidenceLabel confidence={p.confidence} />
                    </div>
                  )}

                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 13, width: '100%' }}
                    onClick={() => selectProduct(p)}
                  >
                    Выбрать
                  </button>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* ── Barcode search ── */}
      {tab === 'barcode' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              inputMode="numeric"
              value={barcodeInput}
              onChange={e => { setBarcodeInput(e.target.value.replace(/\D/g, '')); setBarcodeError(''); }}
              placeholder="Штрихкод (только цифры)"
              onKeyDown={e => { if (e.key === 'Enter') handleBarcodeSearch(); }}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface)', border: '1px solid var(--border-2)',
                borderRadius: 'var(--r-md)', padding: '14px 16px',
                fontSize: 17, color: 'var(--text)', outline: 'none', letterSpacing: 1,
              }}
            />
          </div>

          {barcodeError && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{barcodeError}</div>
          )}

          <button
            className="btn"
            style={{ fontSize: 14 }}
            disabled={barcodeSearching || !barcodeInput.trim()}
            onClick={handleBarcodeSearch}
          >
            {barcodeSearching ? 'Ищем...' : 'Найти'}
          </button>
        </>
      )}
    </div>
  );
}
