import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BootstrapData, FoodAnalysis, SubscriptionInfo } from '../../types';

function isPremiumTier(sub: SubscriptionInfo | null | undefined): boolean {
  if (!sub) return false;
  return sub.status === 'active' || sub.status === 'trial';
}

// ─── Constants ─────────────────────────────────────────────────────────────

type Step = 'select' | 'text' | 'photo' | 'result' | 'done';

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Завтрак' },
  { key: 'lunch',     label: 'Обед'    },
  { key: 'dinner',    label: 'Ужин'    },
  { key: 'snack',     label: 'Перекус' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

async function resizeToDataUrl(file: File, maxSide = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('image load failed')); };
    img.src = objectUrl;
  });
}

function parsePositiveFloat(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'));
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 10) / 10;
}

// ─── Nutrition row ──────────────────────────────────────────────────────────

function NutritionRow({ result }: { result: FoodAnalysis }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
      {result.caloriesKcal != null && (
        <span style={{ fontSize: 14 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{result.caloriesKcal}</span>{' '}
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>ккал</span>
        </span>
      )}
      {result.proteinG != null && (
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          Б <span style={{ fontWeight: 600, color: '#7EB8F0' }}>{result.proteinG}</span>г
        </span>
      )}
      {result.fatG != null && (
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          Ж <span style={{ fontWeight: 600, color: '#F0A07A' }}>{result.fatG}</span>г
        </span>
      )}
      {result.carbsG != null && (
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          У <span style={{ fontWeight: 600, color: '#90C860' }}>{result.carbsG}</span>г
        </span>
      )}
      {result.weightG != null && (
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{result.weightG} г</span>
      )}
      {result.fiberG != null && (
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Клетч. <span style={{ fontWeight: 600 }}>{result.fiberG}</span>г
        </span>
      )}
    </div>
  );
}

// ─── Edit Nutrition Sheet ───────────────────────────────────────────────────

interface EditSheetProps {
  result: FoodAnalysis;
  onClose: () => void;
  onSave: (updated: Partial<FoodAnalysis>) => void;
}

function EditNutritionSheet({ result, onClose, onSave }: EditSheetProps) {
  const [weight,   setWeight]   = useState(result.weightG     != null ? String(result.weightG)     : '');
  const [kcal,     setKcal]     = useState(result.caloriesKcal != null ? String(result.caloriesKcal) : '');
  const [protein,  setProtein]  = useState(result.proteinG    != null ? String(result.proteinG)    : '');
  const [fat,      setFat]      = useState(result.fatG        != null ? String(result.fatG)        : '');
  const [carbs,    setCarbs]    = useState(result.carbsG      != null ? String(result.carbsG)      : '');
  const [fiber,    setFiber]    = useState(result.fiberG      != null ? String(result.fiberG)      : '');
  const [fieldErr, setFieldErr] = useState('');

  function handleSave() {
    const fields: { label: string; raw: string; key: keyof FoodAnalysis }[] = [
      { label: 'Вес',       raw: weight,  key: 'weightG'      },
      { label: 'Ккал',      raw: kcal,    key: 'caloriesKcal' },
      { label: 'Белки',     raw: protein, key: 'proteinG'     },
      { label: 'Жиры',      raw: fat,     key: 'fatG'         },
      { label: 'Углеводы',  raw: carbs,   key: 'carbsG'       },
      { label: 'Клетчатка', raw: fiber,   key: 'fiberG'       },
    ];

    const updated: Partial<FoodAnalysis> = {};
    for (const f of fields) {
      if (f.raw.trim() === '') {
        (updated as Record<string, number | null>)[f.key] = null;
        continue;
      }
      const val = parsePositiveFloat(f.raw);
      if (val === null) {
        setFieldErr(`${f.label}: введи корректное неотрицательное число`);
        return;
      }
      (updated as Record<string, number | null>)[f.key] = val;
    }
    setFieldErr('');
    onSave(updated);
  }

  const FIELDS: { label: string; unit: string; val: string; set: (v: string) => void }[] = [
    { label: 'Вес',        unit: 'г',    val: weight,  set: setWeight  },
    { label: 'Ккал',       unit: 'ккал', val: kcal,    set: setKcal    },
    { label: 'Белки',      unit: 'г',    val: protein, set: setProtein },
    { label: 'Жиры',       unit: 'г',    val: fat,     set: setFat     },
    { label: 'Углеводы',   unit: 'г',    val: carbs,   set: setCarbs   },
    { label: 'Клетчатка',  unit: 'г',    val: fiber,   set: setFiber   },
  ];

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--surface)',
          borderRadius: '22px 22px 0 0',
          padding: '20px 20px 32px',
          border: '1px solid var(--border)',
          borderBottom: 'none',
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '0 auto 18px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Исправить значения</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-3)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
        </div>

        {/* 2-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px', marginBottom: 14 }}>
          {FIELDS.map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
                {f.label}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  placeholder="—"
                  style={{
                    width: '100%',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-2)',
                    borderRadius: 10,
                    padding: '10px 36px 10px 12px',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
                <span style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 11, color: 'var(--text-3)', pointerEvents: 'none',
                }}>
                  {f.unit}
                </span>
              </div>
            </div>
          ))}
        </div>

        {fieldErr && (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12, lineHeight: 1.4 }}>
            {fieldErr}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: 14 }} onClick={onClose}>
            Отмена
          </button>
          <button className="btn" style={{ flex: 1, fontSize: 14 }} onClick={handleSave}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Analyzing button ───────────────────────────────────────────────────────

function AnalyzingButton() {
  return (
    <button
      className="btn btn-analyzing"
      disabled
      data-label="Анализирую..."
      style={{ fontSize: 15, color: 'transparent' /* text hidden — shown via ::after */ }}
    >
      Анализирую...
    </button>
  );
}

// ─── Confidence badge ───────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence?: 'high' | 'medium' | 'low' }) {
  if (!confidence || confidence === 'high') return null;
  const isLow = confidence === 'low';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700,
      padding: '3px 8px', borderRadius: 6,
      background: isLow ? 'rgba(255,159,10,0.15)' : 'rgba(215,255,63,0.1)',
      color: isLow ? '#FF9F0A' : 'var(--text-3)',
      border: `1px solid ${isLow ? 'rgba(255,159,10,0.3)' : 'var(--border)'}`,
    }}>
      {isLow ? '⚠ Низкая уверенность' : '~ Примерная оценка'}
    </span>
  );
}

// ─── Ingredients list ───────────────────────────────────────────────────────

function IngredientsList({ ingredients }: { ingredients?: string[] }) {
  const [open, setOpen] = useState(false);
  if (!ingredients || ingredients.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 12, fontWeight: 600, color: 'var(--text-3)',
        }}
      >
        <span style={{ fontSize: 10, display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>›</span>
        По ингредиентам ({ingredients.length})
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ingredients.map((ing, i) => (
            <div key={i} style={{
              fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4,
              padding: '4px 8px', background: 'var(--surface-2)',
              borderRadius: 6, borderLeft: '2px solid var(--accent)',
            }}>
              {ing}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Clarification banner ────────────────────────────────────────────────────

function ClarificationBanner({ question, onClarify }: { question: string; onClarify: () => void }) {
  return (
    <div style={{
      background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.3)',
      borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🤔</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FF9F0A', marginBottom: 4 }}>
            Уточните для точности
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
            {question}
          </div>
        </div>
      </div>
      <button
        onClick={onClarify}
        style={{
          background: 'rgba(255,159,10,0.2)', border: '1px solid rgba(255,159,10,0.4)',
          borderRadius: 8, padding: '8px 14px',
          fontSize: 13, fontWeight: 600, color: '#FF9F0A',
          cursor: 'pointer', width: '100%',
        }}
      >
        Уточнить описание
      </button>
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function AddMealScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('select');
  const [sourceType, setSourceType] = useState<'text' | 'photo'>('text');
  const [textInput, setTextInput] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [result, setResult] = useState<FoodAnalysis | null>(null);
  const [mealType, setMealType] = useState('breakfast');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showEditSheet, setShowEditSheet] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────

  async function handleTextAnalyze() {
    if (!textInput.trim()) return;
    setError('');
    setAnalyzing(true);
    try {
      const r = await api.nutritionAnalyze(textInput.trim());
      setResult(r);
      setStep('result');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'subscription_required') {
        setError('Для AI-анализа нужна активная подписка. Перейди в раздел Подписка.');
      } else {
        setError(msg || 'Ошибка анализа. Попробуйте ещё раз.');
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const dataUrl = await resizeToDataUrl(file);
      setPhotoPreview(dataUrl);
    } catch {
      setError('Не удалось загрузить фото. Попробуйте другое.');
    }
    e.target.value = '';
  }

  async function handlePhotoAnalyze() {
    if (!photoPreview) return;
    setError('');
    setAnalyzing(true);
    try {
      const r = await api.nutritionAnalyzePhoto(photoPreview);
      setResult(r);
      setStep('result');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'subscription_required') {
        setError('Для анализа фото нужна подписка Optimal или Pro. Перейди в раздел Подписка.');
      } else if (msg === 'NOT_FOOD') {
        setError('На фото не обнаружена еда. Попробуйте другое фото.');
      } else {
        setError('Ошибка анализа. Попробуйте ещё раз.');
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError('');
    try {
      const text = result.name + (result.composition ? ` (${result.composition})` : '')
        + (sourceType === 'text' && textInput ? ` — ${textInput}` : '');
      await api.nutritionAdd({
        text,
        mealType,
        sourceType,
        caloriesKcal: result.caloriesKcal,
        proteinG: result.proteinG,
        fatG: result.fatG,
        carbsG: result.carbsG,
        fiberG: result.fiberG,
        imageData: sourceType === 'photo' && photoPreview ? photoPreview : undefined,
      });
      qc.invalidateQueries({ queryKey: ['diary'] });
      qc.invalidateQueries({ queryKey: ['nutrition-stats'] });
      setStep('done');
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  function resetAndSelect() {
    setStep('select');
    setTextInput('');
    setPhotoPreview(null);
    setResult(null);
    setError('');
    setMealType('breakfast');
    setShowEditSheet(false);
  }

  function handleEditSave(updated: Partial<FoodAnalysis>) {
    setResult(prev => prev ? { ...prev, ...updated } : prev);
    setShowEditSheet(false);
  }

  // ── Shared back-button ────────────────────────────────────────────────

  function BackBtn({ to }: { to: Step | 'navigate-back' }) {
    return (
      <button
        onClick={() => to === 'navigate-back' ? navigate(-1) : setStep(to as Step)}
        style={{ background: 'none', border: 'none', fontSize: 22, padding: 0,
                 color: 'var(--accent)', cursor: 'pointer', marginBottom: 20 }}
      >
        ‹
      </button>
    );
  }

  // ── DONE ──────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="screen" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', textAlign: 'center', gap: 16,
      }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Приём сохранён!</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {MEAL_TYPES.find(t => t.key === mealType)?.label ?? 'Приём'} добавлен в дневник
        </div>
        <div style={{ marginTop: 8, width: '100%', maxWidth: 320 }}>
          <button className="btn" style={{ fontSize: 14 }} onClick={resetAndSelect}>
            + Ещё
          </button>
        </div>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────
  if (step === 'result' && result) {
    const hasClarification = result.needsClarification && result.clarificationQuestion;

    function handleClarify() {
      // Go back to text input so user can add clarification
      setResult(null);
      setStep('text');
    }

    return (
      <div className="screen">
        <BackBtn to={sourceType === 'text' ? 'text' : 'photo'} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
          Анализ готов ✓
        </h1>

        {/* Result card */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-xl)',
          padding: 20, border: '1px solid var(--border)', marginBottom: 16,
        }}>
          {sourceType === 'photo' && photoPreview && (
            <img
              src={photoPreview}
              alt="Фото блюда"
              style={{ width: '100%', borderRadius: 12, marginBottom: 14,
                       maxHeight: 200, objectFit: 'cover', display: 'block' }}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                {result.name}
              </div>
              {result.composition && (
                <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.4 }}>
                  {result.composition}
                </div>
              )}
              {result.confidence && result.confidence !== 'high' && (
                <div style={{ marginTop: 8 }}>
                  <ConfidenceBadge confidence={result.confidence} />
                </div>
              )}
            </div>
            {/* Исправить button — compact, secondary, right-aligned */}
            <button
              onClick={() => setShowEditSheet(true)}
              style={{
                flexShrink: 0, alignSelf: 'flex-start',
                padding: '6px 12px', borderRadius: 8,
                background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
                cursor: 'pointer', lineHeight: 1.3,
              }}
            >
              Исправить
            </button>
          </div>
          <NutritionRow result={result} />
          <IngredientsList ingredients={result.ingredients} />
        </div>

        {/* Clarification banner */}
        {hasClarification && (
          <ClarificationBanner
            question={result.clarificationQuestion!}
            onClarify={handleClarify}
          />
        )}

        {/* Meal type picker */}
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: 1, color: 'var(--text-3)', marginBottom: 10,
        }}>
          Тип приёма пищи
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {MEAL_TYPES.map(mt => (
            <button
              key={mt.key}
              onClick={() => setMealType(mt.key)}
              style={{
                padding: '10px 14px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)',
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

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {sourceType === 'photo' && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 14, marginBottom: 8 }}
            disabled={saving}
            onClick={() => { setResult(null); setPhotoPreview(null); setError(''); setStep('photo'); }}
          >
            Выбрать другое фото
          </button>
        )}

        <button className="btn" disabled={saving} onClick={handleSave} style={{ fontSize: 15 }}>
          {saving ? 'Сохраняем...' : '✓ Сохранить приём'}
        </button>

        {/* Edit sheet overlay */}
        {showEditSheet && (
          <EditNutritionSheet
            result={result}
            onClose={() => setShowEditSheet(false)}
            onSave={handleEditSave}
          />
        )}
      </div>
    );
  }

  // ── TEXT ──────────────────────────────────────────────────────────────
  if (step === 'text') {
    return (
      <div className="screen">
        <BackBtn to="select" />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          Что ты съел?
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
          Опиши приём пищи — AI рассчитает калории и БЖУ
        </div>

        <textarea
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          placeholder={'Например:\nборщ 300г\nхлеб 2 кусочка\nстакан чая без сахара'}
          rows={5}
          disabled={analyzing}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--surface)', border: '1px solid var(--border-2)',
            borderRadius: 'var(--r-md)', padding: '14px 16px',
            fontSize: 16, color: 'var(--text)', lineHeight: 1.5,
            resize: 'none', outline: 'none', marginBottom: 12,
          }}
        />

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {analyzing ? (
          <AnalyzingButton />
        ) : (
          <button
            className="btn"
            disabled={!textInput.trim()}
            onClick={handleTextAnalyze}
            style={{ fontSize: 15 }}
          >
            Проанализировать →
          </button>
        )}
      </div>
    );
  }

  // ── PHOTO ─────────────────────────────────────────────────────────────
  if (step === 'photo') {
    return (
      <div className="screen">
        <BackBtn to="select" />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          Фото блюда
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
          Сфотографируй или выбери фото из галереи
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {!photoPreview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border-2)',
              borderRadius: 'var(--r-xl)',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: 16,
              background: 'var(--surface)',
            }}
          >
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', opacity: 0.6 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Выбрать фото
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Камера или галерея
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <img
              src={photoPreview}
              alt="Предпросмотр"
              style={{
                width: '100%', borderRadius: 'var(--r-xl)',
                maxHeight: 280, objectFit: 'cover', display: 'block',
                marginBottom: 10,
              }}
            />
            <button
              className="btn btn-secondary"
              style={{ fontSize: 13 }}
              onClick={() => { setPhotoPreview(null); setError(''); }}
            >
              Изменить фото
            </button>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {analyzing ? (
          <AnalyzingButton />
        ) : (
          <button
            className="btn"
            disabled={!photoPreview}
            onClick={handlePhotoAnalyze}
            style={{ fontSize: 15 }}
          >
            Проанализировать →
          </button>
        )}
      </div>
    );
  }

  // ── SELECT (default) ──────────────────────────────────────────────────
  const bsData = qc.getQueryData<BootstrapData>(['bootstrap']);
  const isPremium = isPremiumTier(bsData?.subscription);

  return (
    <div className="screen">
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)', marginBottom: 5 }}>
        Добавить приём
      </h1>
      <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24 }}>
        Выбери способ добавления
      </div>

      {/* Text */}
      <div
        onClick={() => { setSourceType('text'); setStep('text'); }}
        className="method-card active"
        style={{ marginBottom: 8, cursor: 'pointer' }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'var(--accent-soft)', border: '1px solid rgba(215,255,63,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: 'var(--accent)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Текстом</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Напиши, что съел — AI посчитает калории</div>
        </div>
        <span style={{ color: 'var(--accent)', fontSize: 20, flexShrink: 0 }}>›</span>
      </div>

      {/* Photo */}
      <div
        onClick={() => {
          if (!isPremium) { navigate('/subscription'); return; }
          setSourceType('photo'); setStep('photo');
        }}
        className="method-card active"
        style={{ marginBottom: 8, cursor: 'pointer', opacity: isPremium ? 1 : 0.75 }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: isPremium ? 'rgba(126,184,240,0.14)' : 'var(--surface-2)',
          border: isPremium ? '1px solid rgba(126,184,240,0.2)' : '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: isPremium ? '#7EB8F0' : 'var(--text-3)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Фото</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {isPremium ? 'Сфотографируй блюдо — AI определит состав' : 'Доступно в Optimal и Pro'}
          </div>
        </div>
        {isPremium
          ? <span style={{ color: 'var(--accent)', fontSize: 20, flexShrink: 0 }}>›</span>
          : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 8px', flexShrink: 0 }}>🔒 Optimal+</span>
        }
      </div>

      {/* Voice — fallback */}
      <div className="method-card soon" style={{ marginBottom: 8, opacity: 0.7 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: 'var(--text-3)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>Голосом</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Доступно через Telegram-бот</div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
          background: 'var(--surface-3)', borderRadius: 6, padding: '3px 7px',
          flexShrink: 0,
        }}>
          В боте
        </span>
      </div>
    </div>
  );
}
