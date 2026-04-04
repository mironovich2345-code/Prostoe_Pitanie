import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { FoodAnalysis } from '../../types';

// ─── Constants ─────────────────────────────────────────────────────────────

type Step = 'select' | 'text' | 'photo' | 'result' | 'done';

const MEAL_TYPES = [
  { key: 'breakfast', label: '🍳 Завтрак' },
  { key: 'lunch',     label: '🍲 Обед'    },
  { key: 'dinner',    label: '🍽 Ужин'    },
  { key: 'snack',     label: '🍎 Перекус' },
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
      setError((e instanceof Error ? e.message : null) || 'Ошибка анализа. Попробуйте ещё раз.');
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
    // Reset input so same file can be re-selected
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
      if (msg === 'NOT_FOOD') {
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

  // ── Render ────────────────────────────────────────────────────────────

  // ── DONE ──────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="screen" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', textAlign: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 64 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Приём сохранён!</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {MEAL_TYPES.find(t => t.key === mealType)?.label ?? 'Приём'} добавлен в дневник
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, width: '100%', maxWidth: 320 }}>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: 14 }} onClick={resetAndSelect}>
            + Ещё
          </button>
          <button className="btn" style={{ flex: 1, fontSize: 14 }} onClick={() => navigate('/diary')}>
            📖 Дневник
          </button>
        </div>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────
  if (step === 'result' && result) {
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
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {result.name}
          </div>
          {result.composition && (
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.4 }}>
              {result.composition}
            </div>
          )}
          <NutritionRow result={result} />
        </div>

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

        <button className="btn" disabled={saving} onClick={handleSave} style={{ fontSize: 15 }}>
          {saving ? 'Сохраняем...' : '✓ Сохранить приём'}
        </button>
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

        <button
          className="btn"
          disabled={!textInput.trim() || analyzing}
          onClick={handleTextAnalyze}
          style={{ fontSize: 15 }}
        >
          {analyzing ? 'Анализирую...' : 'Проанализировать →'}
        </button>
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

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {!photoPreview ? (
          /* Photo picker tap zone */
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
            <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Выбрать фото
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Камера или галерея
            </div>
          </div>
        ) : (
          /* Photo preview */
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

        <button
          className="btn"
          disabled={!photoPreview || analyzing}
          onClick={handlePhotoAnalyze}
          style={{ fontSize: 15 }}
        >
          {analyzing ? 'Анализирую...' : 'Проанализировать →'}
        </button>
      </div>
    );
  }

  // ── SELECT (default) ──────────────────────────────────────────────────
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
          fontSize: 22, flexShrink: 0,
        }}>
          📝
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Текстом</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Напиши, что съел — AI посчитает калории</div>
        </div>
        <span style={{ color: 'var(--accent)', fontSize: 20, flexShrink: 0 }}>›</span>
      </div>

      {/* Photo */}
      <div
        onClick={() => { setSourceType('photo'); setStep('photo'); }}
        className="method-card active"
        style={{ marginBottom: 8, cursor: 'pointer' }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'rgba(126,184,240,0.14)', border: '1px solid rgba(126,184,240,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>
          📷
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Фото</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Сфотографируй блюдо — AI определит состав</div>
        </div>
        <span style={{ color: 'var(--accent)', fontSize: 20, flexShrink: 0 }}>›</span>
      </div>

      {/* Voice — fallback */}
      <div className="method-card soon" style={{ marginBottom: 8, opacity: 0.7 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>
          🎤
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
