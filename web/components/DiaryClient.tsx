'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  webApi, ApiError,
  type WebMealEntry, type WebNutritionDayResponse, type WebAddMealPayload,
  type WebUpdateMealPayload, type WebCopyMealPayload, type WebCopyDayPayload,
  type WebProductSearchResult, type WebAiFoodAnalysis,
} from '@/lib/webApi';

const BarcodeScannerModal = dynamic(() => import('./BarcodeScannerModal'), { ssr: false });

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';
type AddMode = 'manual' | 'product' | 'ai' | 'photo';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;
type MealType = typeof MEAL_TYPES[number];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Завтрак',
  lunch:     'Обед',
  dinner:    'Ужин',
  snack:     'Перекус',
  other:     'Другое',
};

// 2 MB — matches backend PHOTO_MAX_BYTES
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  return d.toLocaleDateString('ru-RU', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '20px 22px', marginBottom: 12,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function MacroChip({
  label, value, target, unit = '', accent,
}: {
  label: string; value: number; target?: number | null; unit?: string; accent?: boolean;
}) {
  return (
    <div style={{
      flex: '1 1 40%', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10,
      border: `1px solid ${accent ? 'rgba(215,255,63,0.25)' : 'var(--border)'}`,
    }}>
      <div style={{
        fontSize: 10, color: 'var(--text-3)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text)' }}>
        {value}{unit}
        {target != null && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>
            / {target}{unit}
          </span>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 8,
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 14, minHeight: 44,
};

const CONFIDENCE_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: '#4caf50', medium: '#ff9800', low: '#ef5350',
};
const CONFIDENCE_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: 'Высокая точность', medium: 'Средняя точность', low: 'Низкая точность',
};

// ─── AI result card (shared between text and photo modes) ─────────────────────

function AiResultCard({
  result, canSave, adding, addError,
  onAdd, onRetry, onCancel,
}: {
  result: WebAiFoodAnalysis;
  canSave: boolean;
  adding: boolean;
  addError: string | null;
  onAdd: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <div style={{
        padding: '14px 16px', borderRadius: 12, marginBottom: 12,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{result.name}</div>
          <div style={{
            padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
            flexShrink: 0, whiteSpace: 'nowrap',
            background: `${CONFIDENCE_COLOR[result.confidence]}22`,
            color: CONFIDENCE_COLOR[result.confidence],
          }}>
            {CONFIDENCE_LABEL[result.confidence]}
          </div>
        </div>

        {result.items.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
            {result.items.join(' · ')}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: result.needsClarification ? 10 : 0 }}>
          {[
            { l: 'Ккал',   v: result.caloriesKcal },
            { l: 'Белки',  v: result.proteinG  !== null ? `${result.proteinG}г`  : null },
            { l: 'Жиры',   v: result.fatG      !== null ? `${result.fatG}г`      : null },
            { l: 'Углев.', v: result.carbsG    !== null ? `${result.carbsG}г`    : null },
            { l: 'Вес',    v: result.weightG   !== null ? `${result.weightG}г`   : null },
          ].filter(x => x.v !== null).map(({ l, v }) => (
            <div key={l} style={{
              padding: '5px 10px', borderRadius: 6,
              background: 'rgba(215,255,63,0.08)',
              fontSize: 12, color: 'var(--accent)', fontWeight: 600,
            }}>{l} {v}</div>
          ))}
        </div>

        {result.needsClarification && result.clarificationQuestion && (
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 8,
            background: 'rgba(255,152,0,0.10)', border: '1px solid rgba(255,152,0,0.25)',
            fontSize: 13, color: '#ff9800',
          }}>
            <span style={{ fontWeight: 700 }}>Уточнение: </span>
            {result.clarificationQuestion}
          </div>
        )}
      </div>

      {addError && (
        <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{addError}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {canSave && (
          <button
            onClick={onAdd}
            disabled={adding}
            style={{
              flex: 1, padding: 12, borderRadius: 10,
              background: 'var(--accent)', color: '#000',
              fontSize: 14, fontWeight: 700, opacity: adding ? 0.6 : 1,
            }}
          >{adding ? 'Сохраняем…' : 'Добавить в дневник'}</button>
        )}
        <button
          onClick={onRetry}
          style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontSize: 14,
            flex: canSave ? undefined : 1,
          }}
        >{canSave ? 'Изменить' : 'Повторить'}</button>
        <button
          onClick={onCancel}
          style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontSize: 14,
          }}
        >Отмена</button>
      </div>
    </div>
  );
}

// ─── Paywall block ────────────────────────────────────────────────────────────

function PaywallBlock({ onCancel }: { onCancel: () => void }) {
  return (
    <div style={{
      padding: '18px 16px', borderRadius: 12,
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
        AI-анализ по фото доступен в подписке
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
        Оформите подписку Optimal или Pro, чтобы анализировать питание по фотографиям.
      </div>
      <Link
        href="/subscription"
        style={{
          display: 'inline-block', padding: '10px 24px', borderRadius: 10,
          background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 14,
        }}
      >Оформить подписку</Link>
      <div style={{ marginTop: 12 }}>
        <button onClick={onCancel} style={{ fontSize: 13, color: 'var(--text-3)' }}>Отмена</button>
      </div>
    </div>
  );
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface AddFormState {
  name: string; mealType: MealType;
  caloriesKcal: string; proteinG: string; fatG: string; carbsG: string;
}
const EMPTY_FORM: AddFormState = {
  name: '', mealType: 'breakfast',
  caloriesKcal: '', proteinG: '', fatG: '', carbsG: '',
};

function calcMacros(p: WebProductSearchResult, g: number) {
  return {
    cal:   Math.round(p.caloriesPer100g * g / 100),
    prot:  Math.round(p.proteinPer100g  * g / 100 * 10) / 10,
    fat:   Math.round(p.fatPer100g      * g / 100 * 10) / 10,
    carbs: Math.round(p.carbsPer100g    * g / 100 * 10) / 10,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiaryClient({ initialDate }: { initialDate?: string }) {
  const [authState, setAuthState]             = useState<AuthState>('loading');
  const [date, setDate]                       = useState(initialDate ?? todayStr());
  const [data, setData]                       = useState<WebNutritionDayResponse | null>(null);
  const [dataLoading, setDataLoading]         = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // edit
  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [editForm, setEditForm]           = useState({ name: '', mealType: 'other' as MealType, caloriesKcal: '', proteinG: '', fatG: '', carbsG: '' });
  const [editSaving, setEditSaving]       = useState(false);
  const [editError, setEditError]         = useState<string | null>(null);

  // copy single meal
  const [copyConfirmId, setCopyConfirmId] = useState<number | null>(null);
  const [copyTargetDate, setCopyTargetDate] = useState('');
  const [copyingId, setCopyingId]         = useState<number | null>(null);
  const [copyError, setCopyError]         = useState<string | null>(null);

  // copy whole day
  const [showDayCopy, setShowDayCopy]       = useState(false);
  const [dayCopyFromDate, setDayCopyFromDate] = useState('');
  const [dayCopying, setDayCopying]         = useState(false);
  const [dayCopyError, setDayCopyError]     = useState<string | null>(null);
  const [dayCopySuccess, setDayCopySuccess] = useState<number | null>(null);

  const [showAddForm, setShowAddForm]         = useState(false);
  const [addMode, setAddMode]                 = useState<AddMode>('manual');

  // manual form
  const [addForm, setAddForm]       = useState<AddFormState>(EMPTY_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError]     = useState<string | null>(null);

  // product search
  const [productQuery, setProductQuery]                 = useState('');
  const [productResults, setProductResults]             = useState<WebProductSearchResult[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [selectedProduct, setSelectedProduct]           = useState<WebProductSearchResult | null>(null);
  const [productGrams, setProductGrams]                 = useState('');
  const [productMealType, setProductMealType]           = useState<MealType>('breakfast');
  const [productSubmitting, setProductSubmitting]       = useState(false);
  const [productError, setProductError]                 = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // barcode search
  const [productSubMode, setProductSubMode]         = useState<'name' | 'barcode'>('name');
  const [barcodeQuery, setBarcodeQuery]             = useState('');
  const [barcodeLoading, setBarcodeLoading]         = useState(false);
  const [barcodeError, setBarcodeError]             = useState<string | null>(null);
  const [scannerOpen, setScannerOpen]               = useState(false);

  // AI text analysis
  const [aiText, setAiText]                       = useState('');
  const [aiResult, setAiResult]                   = useState<WebAiFoodAnalysis | null>(null);
  const [aiAnalyzing, setAiAnalyzing]             = useState(false);
  const [aiAnalyzeError, setAiAnalyzeError]       = useState<string | null>(null);
  const [aiAdding, setAiAdding]                   = useState(false);
  const [aiAddError, setAiAddError]               = useState<string | null>(null);

  // AI photo analysis
  const [photoDataUrl, setPhotoDataUrl]           = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl]     = useState<string | null>(null);
  const [photoAnalyzing, setPhotoAnalyzing]       = useState(false);
  const [photoAnalyzeError, setPhotoAnalyzeError] = useState<string | null>(null);
  const [photoResult, setPhotoResult]             = useState<WebAiFoodAnalysis | null>(null);
  const [photoAdding, setPhotoAdding]             = useState(false);
  const [photoAddError, setPhotoAddError]         = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  async function loadData(d: string) {
    setDataLoading(true);
    try {
      const res = await webApi.getNutritionDay(d);
      setData(res);
    } catch { /* keep existing data */ } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    webApi.getMe()
      .then(() => { setAuthState('authenticated'); loadData(todayStr()); })
      .catch(() => setAuthState('unauthenticated'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onDateChange(newDate: string) {
    setDate(newDate);
    setConfirmDeleteId(null);
    setEditingMealId(null);
    setCopyConfirmId(null);
    setShowDayCopy(false);
    setDayCopyError(null);
    setDayCopySuccess(null);
    loadData(newDate);
  }

  async function handleDelete(id: number) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    try {
      await webApi.deleteMeal(id);
      setConfirmDeleteId(null);
      await loadData(date);
    } catch { setConfirmDeleteId(null); }
  }

  function handleEditStart(meal: WebMealEntry) {
    setConfirmDeleteId(null);
    setEditingMealId(meal.id);
    setEditError(null);
    setEditForm({
      name:         meal.name,
      mealType:     meal.mealType as MealType,
      caloriesKcal: meal.caloriesKcal !== null ? String(meal.caloriesKcal) : '',
      proteinG:     meal.proteinG     !== null ? String(meal.proteinG)     : '',
      fatG:         meal.fatG         !== null ? String(meal.fatG)         : '',
      carbsG:       meal.carbsG       !== null ? String(meal.carbsG)       : '',
    });
  }

  function handleEditCancel() {
    setEditingMealId(null);
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editingMealId) return;
    setEditError(null);
    const name = editForm.name.trim();
    if (!name) { setEditError('Введите название'); return; }
    const payload: WebUpdateMealPayload = {
      name,
      mealType: editForm.mealType,
      caloriesKcal: editForm.caloriesKcal !== '' ? Number(editForm.caloriesKcal) : null,
      proteinG:     editForm.proteinG     !== '' ? Number(editForm.proteinG)     : null,
      fatG:         editForm.fatG         !== '' ? Number(editForm.fatG)         : null,
      carbsG:       editForm.carbsG       !== '' ? Number(editForm.carbsG)       : null,
    };
    setEditSaving(true);
    try {
      await webApi.updateMeal(editingMealId, payload);
      setEditingMealId(null);
      await loadData(date);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.code : 'Ошибка при сохранении');
    } finally {
      setEditSaving(false);
    }
  }

  function handleCopyStart(meal: WebMealEntry) {
    setConfirmDeleteId(null);
    setEditingMealId(null);
    setCopyError(null);
    setCopyTargetDate(date);
    setCopyConfirmId(meal.id);
  }

  function handleCopyCancel() {
    setCopyConfirmId(null);
    setCopyError(null);
  }

  async function handleCopyConfirm() {
    if (!copyConfirmId) return;
    setCopyError(null);
    setCopyingId(copyConfirmId);
    const payload: WebCopyMealPayload = copyTargetDate ? { date: copyTargetDate } : {};
    try {
      await webApi.copyMeal(copyConfirmId, payload);
      setCopyConfirmId(null);
      await loadData(date);
    } catch (err) {
      setCopyError(err instanceof ApiError ? err.code : 'Ошибка при копировании');
    } finally {
      setCopyingId(null);
    }
  }

  async function handleCopyDay() {
    if (!dayCopyFromDate) { setDayCopyError('Выберите дату'); return; }
    if (dayCopyFromDate === date) { setDayCopyError('Выберите другую дату — не текущий день'); return; }
    setDayCopyError(null);
    setDayCopySuccess(null);
    setDayCopying(true);
    const payload: WebCopyDayPayload = { fromDate: dayCopyFromDate, toDate: date };
    try {
      const res = await webApi.copyNutritionDay(payload);
      setDayCopySuccess(res.copied);
      setShowDayCopy(false);
      await loadData(date);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'source_day_empty') {
        setDayCopyError('В выбранный день нет записей.');
      } else {
        setDayCopyError(err instanceof ApiError ? err.code : 'Ошибка при копировании');
      }
    } finally {
      setDayCopying(false);
    }
  }

  async function handleAddMeal(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const payload: WebAddMealPayload = {
      name:         addForm.name.trim(),
      mealType:     addForm.mealType,
      caloriesKcal: addForm.caloriesKcal ? Number(addForm.caloriesKcal) : undefined,
      proteinG:     addForm.proteinG     ? Number(addForm.proteinG)     : undefined,
      fatG:         addForm.fatG         ? Number(addForm.fatG)         : undefined,
      carbsG:       addForm.carbsG       ? Number(addForm.carbsG)       : undefined,
    };
    setAddLoading(true);
    try {
      await webApi.addMeal(payload);
      handleCloseAddForm();
      await loadData(date);
    } catch (err) {
      setAddError(err instanceof ApiError ? err.code : 'Ошибка при добавлении');
    } finally { setAddLoading(false); }
  }

  function onProductQueryChange(q: string) {
    setProductQuery(q);
    setSelectedProduct(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.trim().length < 2) { setProductResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setProductSearchLoading(true);
      try {
        const res = await webApi.searchWebProducts(q.trim());
        setProductResults(res.items);
      } catch { setProductResults([]); } finally { setProductSearchLoading(false); }
    }, 400);
  }

  async function handleBarcodeSearch(barcodeOverride?: string) {
    setBarcodeError(null);
    const raw = (barcodeOverride ?? barcodeQuery).replace(/[\s\-]/g, '');
    if (!/^\d{6,32}$/.test(raw)) {
      setBarcodeError('Введите числовой штрихкод (6–32 цифры)');
      return;
    }
    setBarcodeLoading(true);
    try {
      const res = await webApi.getProductByBarcode(raw);
      setSelectedProduct(res.product);
      setProductGrams(res.product.packageWeightG != null ? String(res.product.packageWeightG) : '100');
      setProductError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setBarcodeError('Продукт не найден в базе. Попробуйте поиск по названию.');
      } else {
        setBarcodeError('Ошибка при поиске. Попробуйте ещё раз.');
      }
    } finally {
      setBarcodeLoading(false);
    }
  }

  async function handleAddProduct() {
    setProductError(null);
    if (!selectedProduct) return;
    const g = Number(productGrams);
    if (!productGrams || !Number.isFinite(g) || g < 1 || g > 5000) {
      setProductError('Введите граммовку от 1 до 5000'); return;
    }
    setProductSubmitting(true);
    try {
      await webApi.addProductMeal({ productId: selectedProduct.id, grams: g, mealType: productMealType, date });
      handleCloseAddForm();
      await loadData(date);
    } catch (err) {
      setProductError(err instanceof ApiError ? err.code : 'Ошибка при добавлении');
    } finally { setProductSubmitting(false); }
  }

  async function handleAnalyzeText() {
    setAiAnalyzeError(null);
    setAiResult(null);
    const text = aiText.trim();
    if (text.length < 2) { setAiAnalyzeError('Опишите блюдо подробнее (минимум 2 символа)'); return; }
    setAiAnalyzing(true);
    try {
      const res = await webApi.analyzeFoodText({ text });
      setAiResult(res.analysis);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'subscription_required' || err.status === 402)) {
        setAiAnalyzeError('__paywall__');
      } else if (err instanceof ApiError && err.status === 429) {
        setAiAnalyzeError('Слишком много AI-запросов подряд. Попробуйте чуть позже.');
      } else {
        setAiAnalyzeError('Не удалось проанализировать еду. Попробуйте описать подробнее.');
      }
    } finally { setAiAnalyzing(false); }
  }

  async function handleAddAiMeal() {
    if (!aiResult) return;
    setAiAddError(null);
    setAiAdding(true);
    try {
      await webApi.addAiAnalysisMeal({
        date,
        sourceType: 'web_ai_text',
        analysis: {
          name: aiResult.name, mealType: aiResult.mealType,
          caloriesKcal: aiResult.caloriesKcal, proteinG: aiResult.proteinG,
          fatG: aiResult.fatG, carbsG: aiResult.carbsG,
          fiberG: aiResult.fiberG, weightG: aiResult.weightG,
          items: aiResult.items, confidence: aiResult.confidence,
          needsClarification: aiResult.needsClarification,
        },
      });
      handleCloseAddForm();
      await loadData(date);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'needs_clarification') {
        setAiAddError('Уточните описание еды и повторите анализ');
      } else {
        setAiAddError(err instanceof ApiError ? err.code : 'Ошибка при сохранении');
      }
    } finally { setAiAdding(false); }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > PHOTO_MAX_BYTES) {
      setPhotoAnalyzeError(`Файл слишком большой. Максимум ${Math.round(PHOTO_MAX_BYTES / 1024 / 1024)} МБ.`);
      e.target.value = '';
      return;
    }

    setPhotoAnalyzeError(null);
    setPhotoResult(null);
    setPhotoAddError(null);

    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setPhotoDataUrl(result);
      setPhotoPreviewUrl(result);
    };
    reader.onerror = () => {
      setPhotoAnalyzeError('Не удалось прочитать фото. Попробуйте другое изображение.');
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyzePhoto() {
    if (!photoDataUrl) return;
    setPhotoAnalyzeError(null);
    setPhotoResult(null);
    setPhotoAnalyzing(true);
    try {
      const res = await webApi.analyzeFoodPhoto({ imageDataUrl: photoDataUrl });
      setPhotoResult(res.analysis);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'subscription_required' || err.status === 402)) {
        setPhotoAnalyzeError('__paywall__');
      } else if (err instanceof ApiError && err.status === 429) {
        setPhotoAnalyzeError('Слишком много AI-запросов подряд. Попробуйте чуть позже.');
      } else if (err instanceof ApiError && err.code === 'invalid_image') {
        setPhotoAnalyzeError('Не удалось прочитать фото. Попробуйте другое изображение.');
      } else {
        setPhotoAnalyzeError('Не удалось проанализировать фото. Попробуйте сделать снимок ближе и при хорошем освещении.');
      }
    } finally { setPhotoAnalyzing(false); }
  }

  async function handleAddPhotoMeal() {
    if (!photoResult) return;
    setPhotoAddError(null);
    setPhotoAdding(true);
    try {
      await webApi.addAiAnalysisMeal({
        date,
        sourceType: 'web_ai_photo',
        analysis: {
          name: photoResult.name, mealType: photoResult.mealType,
          caloriesKcal: photoResult.caloriesKcal, proteinG: photoResult.proteinG,
          fatG: photoResult.fatG, carbsG: photoResult.carbsG,
          fiberG: photoResult.fiberG, weightG: photoResult.weightG,
          items: photoResult.items, confidence: photoResult.confidence,
          needsClarification: photoResult.needsClarification,
        },
      });
      handleCloseAddForm();
      await loadData(date);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'needs_clarification') {
        setPhotoAddError('Сделайте более чёткое фото и повторите анализ');
      } else {
        setPhotoAddError(err instanceof ApiError ? err.code : 'Ошибка при сохранении');
      }
    } finally { setPhotoAdding(false); }
  }

  function handleCloseAddForm() {
    setShowAddForm(false);
    setAddMode('manual');
    setAddForm(EMPTY_FORM);
    setAddError(null);
    setProductQuery('');
    setProductResults([]);
    setSelectedProduct(null);
    setProductGrams('');
    setProductMealType('breakfast');
    setProductError(null);
    setProductSubMode('name');
    setBarcodeQuery('');
    setBarcodeError(null);
    setScannerOpen(false);
    setAiText('');
    setAiResult(null);
    setAiAnalyzeError(null);
    setAiAddError(null);
    setPhotoDataUrl(null);
    setPhotoPreviewUrl(null);
    setPhotoResult(null);
    setPhotoAnalyzeError(null);
    setPhotoAddError(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  // ── Loading / Unauthenticated ─────────────────────────────────────────────

  if (authState === 'loading') {
    return <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 48 }}>Загрузка…</div>;
  }

  if (authState === 'unauthenticated') {
    return (
      <Card>
        <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 20 }}>
          Войдите в аккаунт, чтобы вести дневник питания.
        </p>
        <Link href="/client" style={{
          display: 'inline-block', padding: '12px 24px',
          background: 'var(--accent)', color: '#000', borderRadius: 10, fontWeight: 700, fontSize: 14,
        }}>Войти</Link>
      </Card>
    );
  }

  // ── Authenticated ─────────────────────────────────────────────────────────

  const mealsByType: Partial<Record<MealType, WebMealEntry[]>> = {};
  for (const meal of (data?.meals ?? [])) {
    const t = meal.mealType as MealType;
    if (!mealsByType[t]) mealsByType[t] = [];
    mealsByType[t]!.push(meal);
  }

  const totals = data?.totals;
  const target = data?.target;
  const today  = todayStr();

  const previewGrams = Number(productGrams);
  const macroPreview = selectedProduct && Number.isFinite(previewGrams) && previewGrams > 0
    ? calcMacros(selectedProduct, previewGrams)
    : null;

  const aiCanSave    = aiResult    !== null && (!aiResult.needsClarification    || aiResult.caloriesKcal    !== null);
  const photoCanSave = photoResult !== null && (!photoResult.needsClarification || photoResult.caloriesKcal !== null);

  const MODE_LABELS: Record<AddMode, string> = {
    manual: 'Вручную', product: 'По продукту', ai: 'AI текст', photo: 'AI фото',
  };

  return (
    <div>
      {/* Back link */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/client" style={{ fontSize: 13, color: 'var(--text-3)' }}>&#8592; Мой кабинет</Link>
      </div>

      {/* Date navigation */}
      <Card style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => onDateChange(shiftDate(date, -1))}
            style={{ color: 'var(--text-2)', fontSize: 20, lineHeight: 1, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)' }}
          >&#8249;</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{fmtDate(date)}</div>
          </div>
          <button
            onClick={() => onDateChange(shiftDate(date, 1))}
            style={{ color: 'var(--text-2)', fontSize: 20, lineHeight: 1, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)' }}
          >&#8250;</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date" value={date}
            onChange={e => e.target.value && onDateChange(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          {date !== today && (
            <button
              onClick={() => onDateChange(today)}
              style={{ padding: '10px 14px', borderRadius: 8, whiteSpace: 'nowrap', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}
            >Сегодня</button>
          )}
        </div>

        {/* Copy day button / form */}
        {!showDayCopy ? (
          <div style={{ marginTop: 10 }}>
            {dayCopySuccess !== null && (
              <div style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 6 }}>
                Скопировано записей: {dayCopySuccess}
              </div>
            )}
            <button
              onClick={() => {
                setDayCopySuccess(null);
                setDayCopyError(null);
                setDayCopyFromDate(shiftDate(date, -1));
                setShowDayCopy(true);
              }}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                color: 'var(--text-2)', fontSize: 13, fontWeight: 600, textAlign: 'left',
              }}
            >+ Скопировать записи из другого дня</button>
          </div>
        ) : (
          <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>
              Откуда скопировать записи:
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
              Записи будут добавлены к текущему дню. Существующие записи не удалятся.
            </div>
            <div style={{ marginBottom: 10 }}>
              <input
                type="date" value={dayCopyFromDate}
                onChange={e => e.target.value && setDayCopyFromDate(e.target.value)}
                style={{ ...inputStyle, fontSize: 16 }}
              />
            </div>
            {dayCopyError && (
              <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{dayCopyError}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => void handleCopyDay()}
                disabled={dayCopying}
                style={{ flex: 1, padding: '11px 0', borderRadius: 8, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, minHeight: 44, opacity: dayCopying ? 0.6 : 1 }}
              >{dayCopying ? 'Копируем…' : 'Скопировать'}</button>
              <button
                onClick={() => { setShowDayCopy(false); setDayCopyError(null); }}
                style={{ padding: '11px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontSize: 14, minHeight: 44 }}
              >Отмена</button>
            </div>
          </div>
        )}
      </Card>

      {/* Totals */}
      <Card>
        <SLabel>Итого за день</SLabel>
        {dataLoading ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Загрузка…</div>
        ) : totals ? (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <MacroChip label="Ккал"   value={totals.calories} target={target?.calories} accent />
              <MacroChip label="Белки"  value={totals.protein}  target={target?.protein}  unit="г" />
              <MacroChip label="Жиры"   value={totals.fat}      target={target?.fat}       unit="г" />
              <MacroChip label="Углев." value={totals.carbs}    target={target?.carbs}     unit="г" />
            </div>
            {(data?.meals.length ?? 0) === 0 && (
              <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-3)' }}>За этот день записей нет.</p>
            )}
          </>
        ) : null}
      </Card>

      {/* Meal groups */}
      {!dataLoading && MEAL_TYPES.map(type => {
        const meals = mealsByType[type];
        if (!meals?.length) return null;
        return (
          <Card key={type}>
            <SLabel>{MEAL_LABELS[type]}</SLabel>
            {meals.map((meal, i) => (
              <div key={meal.id} style={{
                paddingBottom: i < meals.length - 1 ? 12 : 0,
                marginBottom: i < meals.length - 1 ? 12 : 0,
                borderBottom: i < meals.length - 1 ? '1px solid var(--border)' : undefined,
              }}>
                {/* Row: name + macro + action buttons */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{meal.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {[
                        meal.caloriesKcal !== null && `${meal.caloriesKcal} ккал`,
                        meal.proteinG     !== null && `Б ${meal.proteinG}г`,
                        meal.fatG         !== null && `Ж ${meal.fatG}г`,
                        meal.carbsG       !== null && `У ${meal.carbsG}г`,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {confirmDeleteId === meal.id ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => handleDelete(meal.id)}
                        style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, background: '#ef5350', color: '#fff', fontWeight: 700 }}
                      >Удалить</button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', color: 'var(--text-2)' }}
                      >Отмена</button>
                    </div>
                  ) : editingMealId === meal.id || copyConfirmId === meal.id ? null : (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => handleEditStart(meal)}
                        aria-label="Редактировать запись"
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontWeight: 600 }}
                      >Ред.</button>
                      <button
                        onClick={() => handleCopyStart(meal)}
                        aria-label="Повторить запись"
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontWeight: 600 }}
                      >Повт.</button>
                      <button
                        onClick={() => setConfirmDeleteId(meal.id)}
                        aria-label="Удалить запись"
                        style={{ fontSize: 18, color: 'var(--text-3)', lineHeight: 1, padding: '0 4px' }}
                      >&#215;</button>
                    </div>
                  )}
                </div>

                {/* Inline edit form */}
                {editingMealId === meal.id && (
                  <div style={{
                    marginTop: 10,
                    padding: '14px 14px 10px',
                    borderRadius: 10,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ marginBottom: 8 }}>
                      <input
                        type="text"
                        placeholder="Название *"
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        style={{ ...inputStyle, fontSize: 16 }}
                        autoFocus
                      />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <select
                        value={editForm.mealType}
                        onChange={e => setEditForm(f => ({ ...f, mealType: e.target.value as MealType }))}
                        style={{ ...inputStyle, fontSize: 16 }}
                      >
                        {MEAL_TYPES.map(t => <option key={t} value={t}>{MEAL_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                      {([
                        { key: 'caloriesKcal', label: 'Ккал' },
                        { key: 'proteinG',     label: 'Белки, г' },
                        { key: 'fatG',         label: 'Жиры, г' },
                        { key: 'carbsG',       label: 'Углев., г' },
                      ] as const).map(({ key, label }) => (
                        <input
                          key={key}
                          type="number" min="0" placeholder={label}
                          value={editForm[key]}
                          onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                          style={{ ...inputStyle, fontSize: 16 }}
                        />
                      ))}
                    </div>
                    {editError && (
                      <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{editError}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => void handleEditSave()}
                        disabled={editSaving}
                        style={{ flex: 1, padding: '11px 0', borderRadius: 8, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, minHeight: 44, opacity: editSaving ? 0.6 : 1 }}
                      >{editSaving ? 'Сохраняем…' : 'Сохранить'}</button>
                      <button
                        onClick={handleEditCancel}
                        style={{ padding: '11px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontSize: 14, minHeight: 44 }}
                      >Отмена</button>
                    </div>
                  </div>
                )}

                {/* Inline copy confirm */}
                {copyConfirmId === meal.id && (
                  <div style={{
                    marginTop: 10,
                    padding: '14px 14px 10px',
                    borderRadius: 10,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                      Повторить приём пищи на дату:
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <input
                        type="date"
                        value={copyTargetDate}
                        onChange={e => e.target.value && setCopyTargetDate(e.target.value)}
                        style={{ ...inputStyle, fontSize: 16 }}
                      />
                    </div>
                    {copyError && (
                      <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{copyError}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => void handleCopyConfirm()}
                        disabled={copyingId === meal.id}
                        style={{ flex: 1, padding: '11px 0', borderRadius: 8, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, minHeight: 44, opacity: copyingId === meal.id ? 0.6 : 1 }}
                      >{copyingId === meal.id ? 'Копируем…' : 'Повторить'}</button>
                      <button
                        onClick={handleCopyCancel}
                        style={{ padding: '11px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontSize: 14, minHeight: 44 }}
                      >Отмена</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </Card>
        );
      })}

      {/* Add meal */}
      <Card>
        <SLabel>Добавить запись</SLabel>
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              width: '100%', padding: 14, borderRadius: 10,
              background: 'var(--accent-dim)', border: '1px dashed rgba(215,255,63,0.3)',
              color: 'var(--accent)', fontSize: 14, fontWeight: 600,
            }}
          >+ Добавить приём пищи</button>
        ) : (
          <div>
            {/* Mode tabs — 2×2 grid on small screens */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 14 }}>
              {(['manual', 'product', 'ai', 'photo'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => {
                    setAddMode(mode);
                    setAiResult(null); setAiAnalyzeError(null); setAiAddError(null);
                    setPhotoResult(null); setPhotoAnalyzeError(null); setPhotoAddError(null);
                  }}
                  style={{
                    padding: '10px 0', borderRadius: 6, fontSize: 13, fontWeight: 600,
                    minHeight: 44,
                    background: addMode === mode ? 'var(--surface)' : 'var(--surface-2)',
                    color: addMode === mode ? 'var(--text)' : 'var(--text-3)',
                    border: addMode === mode ? '1px solid var(--border)' : '1px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {MODE_LABELS[mode]}
                </button>
              ))}
            </div>

            {/* ── Manual ──────────────────────────────────────────────────── */}
            {addMode === 'manual' && (
              <form onSubmit={handleAddMeal}>
                <div style={{ marginBottom: 8 }}>
                  <input
                    type="text" placeholder="Название блюда *"
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    required style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <select
                    value={addForm.mealType}
                    onChange={e => setAddForm(f => ({ ...f, mealType: e.target.value as MealType }))}
                    style={inputStyle}
                  >
                    {MEAL_TYPES.map(t => <option key={t} value={t}>{MEAL_LABELS[t]}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <input type="number" min="0" placeholder="Ккал" value={addForm.caloriesKcal} onChange={e => setAddForm(f => ({ ...f, caloriesKcal: e.target.value }))} style={inputStyle} />
                  <input type="number" min="0" step="0.1" placeholder="Белки, г" value={addForm.proteinG} onChange={e => setAddForm(f => ({ ...f, proteinG: e.target.value }))} style={inputStyle} />
                  <input type="number" min="0" step="0.1" placeholder="Жиры, г" value={addForm.fatG} onChange={e => setAddForm(f => ({ ...f, fatG: e.target.value }))} style={inputStyle} />
                  <input type="number" min="0" step="0.1" placeholder="Углев., г" value={addForm.carbsG} onChange={e => setAddForm(f => ({ ...f, carbsG: e.target.value }))} style={inputStyle} />
                </div>
                {addError && <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{addError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={addLoading} style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, opacity: addLoading ? 0.6 : 1 }}>
                    {addLoading ? 'Сохраняем…' : 'Добавить'}
                  </button>
                  <button type="button" onClick={handleCloseAddForm} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontSize: 14 }}>Отмена</button>
                </div>
              </form>
            )}

            {/* ── Product search ───────────────────────────────────────────── */}
            {addMode === 'product' && (
              <div>
                {!selectedProduct ? (
                  <>
                    {/* Sub-mode: name search vs barcode */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                      {(['name', 'barcode'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => { setProductSubMode(m); setBarcodeError(null); }}
                          style={{
                            flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            background: productSubMode === m ? 'var(--surface)' : 'var(--surface-2)',
                            color: productSubMode === m ? 'var(--text)' : 'var(--text-3)',
                            border: productSubMode === m ? '1px solid var(--border)' : '1px solid transparent',
                          }}
                        >{m === 'name' ? 'По названию' : 'По штрихкоду'}</button>
                      ))}
                    </div>

                    {productSubMode === 'name' ? (
                      <>
                        <div style={{ marginBottom: 8 }}>
                          <input
                            type="text" placeholder="Название продукта или бренд…"
                            value={productQuery} onChange={e => onProductQueryChange(e.target.value)}
                            autoFocus style={inputStyle}
                          />
                        </div>
                        {productSearchLoading && <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>Поиск…</div>}
                        {!productSearchLoading && productResults.length > 0 && (
                          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                            {productResults.map((p, i) => (
                              <button key={p.id}
                                onClick={() => { setSelectedProduct(p); setProductGrams(''); setProductError(null); }}
                                style={{ width: '100%', textAlign: 'left', padding: '10px 14px', display: 'block', borderBottom: i < productResults.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--surface-2)' }}
                              >
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                                  {[p.brand, `${p.caloriesPer100g} ккал/100г`, `Б ${p.proteinPer100g}г  Ж ${p.fatPer100g}г  У ${p.carbsPer100g}г`].filter(Boolean).join(' · ')}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {!productSearchLoading && productQuery.trim().length >= 2 && productResults.length === 0 && (
                          <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>Ничего не найдено</div>
                        )}
                      </>
                    ) : (
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          <input
                            type="text" inputMode="numeric" placeholder="Введите штрихкод…"
                            value={barcodeQuery}
                            onChange={e => setBarcodeQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') void handleBarcodeSearch(); }}
                            autoFocus style={{ ...inputStyle, flex: 1 }}
                          />
                          <button
                            onClick={() => void handleBarcodeSearch()}
                            disabled={barcodeLoading}
                            style={{
                              padding: '10px 14px', borderRadius: 8,
                              background: 'var(--accent)', color: '#000',
                              fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                              flexShrink: 0, opacity: barcodeLoading ? 0.6 : 1,
                            }}
                          >{barcodeLoading ? '…' : 'Найти'}</button>
                        </div>
                        <button
                          onClick={() => setScannerOpen(true)}
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: 8,
                            background: 'var(--surface-2)', border: '1px solid var(--border)',
                            color: 'var(--text-2)', fontSize: 13, fontWeight: 600,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            marginBottom: 8,
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <rect x="1" y="1" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/>
                            <rect x="11" y="1" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/>
                            <rect x="1" y="11" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/>
                            <path d="M11 11h4M11 15h4M15 11v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                          Сканировать камерой
                        </button>
                        {barcodeError && (
                          <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{barcodeError}</div>
                        )}
                      </div>
                    )}

                    <button onClick={handleCloseAddForm} style={{ marginTop: 4, padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontSize: 13 }}>Отмена</button>
                  </>
                ) : (
                  <>
                    <div style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedProduct.name}</div>
                      {selectedProduct.brand && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{selectedProduct.brand}</div>}
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                        {`${selectedProduct.caloriesPer100g} ккал · Б ${selectedProduct.proteinPer100g}г · Ж ${selectedProduct.fatPer100g}г · У ${selectedProduct.carbsPer100g}г`} на 100 г
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <input type="number" min="1" max="5000" step="1" placeholder="Граммовка *" value={productGrams} onChange={e => setProductGrams(e.target.value)} autoFocus style={inputStyle} />
                    </div>
                    {macroPreview && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                        {[{ l: 'Ккал', v: String(macroPreview.cal) }, { l: 'Б', v: `${macroPreview.prot}г` }, { l: 'Ж', v: `${macroPreview.fat}г` }, { l: 'У', v: `${macroPreview.carbs}г` }].map(({ l, v }) => (
                          <div key={l} style={{ padding: '5px 10px', borderRadius: 6, background: 'var(--accent-dim)', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{l} {v}</div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginBottom: 12 }}>
                      <select value={productMealType} onChange={e => setProductMealType(e.target.value as MealType)} style={inputStyle}>
                        {MEAL_TYPES.map(t => <option key={t} value={t}>{MEAL_LABELS[t]}</option>)}
                      </select>
                    </div>
                    {productError && <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{productError}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleAddProduct} disabled={productSubmitting} style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, opacity: productSubmitting ? 0.6 : 1 }}>
                        {productSubmitting ? 'Сохраняем…' : 'Добавить'}
                      </button>
                      <button onClick={() => { setSelectedProduct(null); setProductGrams(''); setProductError(null); }} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontSize: 14 }}>Назад</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── AI text ──────────────────────────────────────────────────── */}
            {addMode === 'ai' && (
              <div>
                {aiAnalyzeError === '__paywall__' ? (
                  <PaywallBlock onCancel={handleCloseAddForm} />
                ) : !aiResult ? (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <textarea
                        rows={3} placeholder="Опишите что вы ели, например: овсянка на молоке 300 г, банан, кофе с молоком"
                        value={aiText} onChange={e => setAiText(e.target.value)}
                        style={{ ...inputStyle, resize: 'vertical', minHeight: 80, fontFamily: 'inherit', lineHeight: 1.5 }}
                      />
                    </div>
                    {aiAnalyzeError && <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{aiAnalyzeError}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleAnalyzeText} disabled={aiAnalyzing || aiText.trim().length < 2}
                        style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, opacity: (aiAnalyzing || aiText.trim().length < 2) ? 0.6 : 1 }}
                      >{aiAnalyzing ? 'Анализируем…' : 'Проанализировать'}</button>
                      <button onClick={handleCloseAddForm} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontSize: 14 }}>Отмена</button>
                    </div>
                  </>
                ) : (
                  <AiResultCard
                    result={aiResult} canSave={aiCanSave} adding={aiAdding} addError={aiAddError}
                    onAdd={handleAddAiMeal}
                    onRetry={() => { setAiResult(null); setAiAddError(null); }}
                    onCancel={handleCloseAddForm}
                  />
                )}
              </div>
            )}

            {/* ── AI photo ─────────────────────────────────────────────────── */}
            {addMode === 'photo' && (
              <div>
                {photoAnalyzeError === '__paywall__' ? (
                  <PaywallBlock onCancel={handleCloseAddForm} />
                ) : !photoResult ? (
                  <>
                    {/* Hidden file input */}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      style={{ display: 'none' }}
                    />

                    {/* Photo preview or pick button */}
                    {photoPreviewUrl ? (
                      <div style={{ marginBottom: 10 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoPreviewUrl}
                          alt="Предпросмотр"
                          style={{
                            width: '100%', maxHeight: 220, objectFit: 'cover',
                            borderRadius: 10, border: '1px solid var(--border)',
                            display: 'block',
                          }}
                        />
                        <button
                          onClick={() => {
                            setPhotoDataUrl(null);
                            setPhotoPreviewUrl(null);
                            setPhotoAnalyzeError(null);
                            if (photoInputRef.current) photoInputRef.current.value = '';
                          }}
                          style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}
                        >Выбрать другое фото</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        style={{
                          width: '100%', padding: 18, borderRadius: 10, marginBottom: 10,
                          background: 'var(--surface-2)', border: '1px dashed var(--border)',
                          color: 'var(--text-3)', fontSize: 14, fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 22 }}>&#128247;</span>
                        Выбрать фото
                      </button>
                    )}

                    {photoAnalyzeError && photoAnalyzeError !== '__paywall__' && (
                      <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{photoAnalyzeError}</div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleAnalyzePhoto}
                        disabled={!photoDataUrl || photoAnalyzing}
                        style={{
                          flex: 1, padding: 12, borderRadius: 10,
                          background: 'var(--accent)', color: '#000',
                          fontSize: 14, fontWeight: 700,
                          opacity: (!photoDataUrl || photoAnalyzing) ? 0.6 : 1,
                        }}
                      >{photoAnalyzing ? 'Анализируем…' : 'Проанализировать фото'}</button>
                      <button
                        onClick={handleCloseAddForm}
                        style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: 'var(--text-2)', fontSize: 14 }}
                      >Отмена</button>
                    </div>
                  </>
                ) : (
                  <AiResultCard
                    result={photoResult} canSave={photoCanSave} adding={photoAdding} addError={photoAddError}
                    onAdd={handleAddPhotoMeal}
                    onRetry={() => { setPhotoResult(null); setPhotoAddError(null); }}
                    onCancel={handleCloseAddForm}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {scannerOpen && (
        <BarcodeScannerModal
          onDetected={(barcode) => {
            setScannerOpen(false);
            setBarcodeQuery(barcode);
            void handleBarcodeSearch(barcode);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
