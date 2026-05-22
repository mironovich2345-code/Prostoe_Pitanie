'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  webApi, ApiError,
  type WebMealEntry, type WebNutritionDayResponse, type WebAddMealPayload,
} from '@/lib/webApi';

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;
type MealType = typeof MEAL_TYPES[number];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Завтрак',
  lunch:     'Обед',
  dinner:    'Ужин',
  snack:     'Перекус',
  other:     'Другое',
};

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

// ─── Primitive UI helpers ─────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)',
      padding: '20px 22px',
      marginBottom: 12,
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
      flex: '1 1 40%',
      padding: '10px 12px',
      background: 'var(--surface-2)',
      borderRadius: 10,
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
  width: '100%', padding: '10px 14px', borderRadius: 8,
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 13,
};

// ─── Main component ───────────────────────────────────────────────────────────

interface AddFormState {
  name: string;
  mealType: MealType;
  caloriesKcal: string;
  proteinG: string;
  fatG: string;
  carbsG: string;
}

const EMPTY_FORM: AddFormState = {
  name: '', mealType: 'breakfast',
  caloriesKcal: '', proteinG: '', fatG: '', carbsG: '',
};

export default function DiaryClient() {
  const [authState, setAuthState]           = useState<AuthState>('loading');
  const [date, setDate]                     = useState(todayStr());
  const [data, setData]                     = useState<WebNutritionDayResponse | null>(null);
  const [dataLoading, setDataLoading]       = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm]       = useState(false);
  const [addForm, setAddForm]               = useState<AddFormState>(EMPTY_FORM);
  const [addLoading, setAddLoading]         = useState(false);
  const [addError, setAddError]             = useState<string | null>(null);

  async function loadData(d: string) {
    setDataLoading(true);
    try {
      const res = await webApi.getNutritionDay(d);
      setData(res);
    } catch {
      // keep existing data
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    webApi.getMe()
      .then(() => {
        setAuthState('authenticated');
        loadData(todayStr());
      })
      .catch(() => setAuthState('unauthenticated'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onDateChange(newDate: string) {
    setDate(newDate);
    setConfirmDeleteId(null);
    loadData(newDate);
  }

  async function handleDelete(id: number) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    try {
      await webApi.deleteMeal(id);
      setConfirmDeleteId(null);
      await loadData(date);
    } catch {
      setConfirmDeleteId(null);
    }
  }

  async function handleAddMeal(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const payload: WebAddMealPayload = {
      name:     addForm.name.trim(),
      mealType: addForm.mealType,
      caloriesKcal: addForm.caloriesKcal ? Number(addForm.caloriesKcal) : undefined,
      proteinG:     addForm.proteinG     ? Number(addForm.proteinG)     : undefined,
      fatG:         addForm.fatG         ? Number(addForm.fatG)         : undefined,
      carbsG:       addForm.carbsG       ? Number(addForm.carbsG)       : undefined,
    };
    setAddLoading(true);
    try {
      await webApi.addMeal(payload);
      setAddForm(EMPTY_FORM);
      setShowAddForm(false);
      await loadData(date);
    } catch (err) {
      setAddError(err instanceof ApiError ? err.code : 'Ошибка при добавлении');
    } finally {
      setAddLoading(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (authState === 'loading') {
    return (
      <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 48 }}>
        Загрузка…
      </div>
    );
  }

  // ── Unauthenticated ───────────────────────────────────────────────────────────

  if (authState === 'unauthenticated') {
    return (
      <Card>
        <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 20 }}>
          Войдите в аккаунт, чтобы вести дневник питания.
        </p>
        <Link href="/client" style={{
          display: 'inline-block', padding: '12px 24px',
          background: 'var(--accent)', color: '#000',
          borderRadius: 10, fontWeight: 700, fontSize: 14,
        }}>
          Войти
        </Link>
      </Card>
    );
  }

  // ── Authenticated ─────────────────────────────────────────────────────────────

  const mealsByType: Partial<Record<MealType, WebMealEntry[]>> = {};
  for (const meal of (data?.meals ?? [])) {
    const t = meal.mealType as MealType;
    if (!mealsByType[t]) mealsByType[t] = [];
    mealsByType[t]!.push(meal);
  }

  const totals = data?.totals;
  const target = data?.target;
  const today  = todayStr();

  return (
    <div>
      {/* Back link */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/client" style={{ fontSize: 13, color: 'var(--text-3)' }}>
          ← Мой кабинет
        </Link>
      </div>

      {/* Date navigation */}
      <Card style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => onDateChange(shiftDate(date, -1))}
            style={{
              color: 'var(--text-2)', fontSize: 20, lineHeight: 1,
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
            }}
          >‹</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{fmtDate(date)}</div>
          </div>
          <button
            onClick={() => onDateChange(shiftDate(date, 1))}
            style={{
              color: 'var(--text-2)', fontSize: 20, lineHeight: 1,
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
            }}
          >›</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            value={date}
            onChange={e => e.target.value && onDateChange(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          {date !== today && (
            <button
              onClick={() => onDateChange(today)}
              style={{
                padding: '10px 14px', borderRadius: 8, whiteSpace: 'nowrap',
                background: 'var(--accent-dim)', color: 'var(--accent)',
                fontSize: 13, fontWeight: 600,
              }}
            >Сегодня</button>
          )}
        </div>
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
              <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-3)' }}>
                За этот день записей нет.
              </p>
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
              <div
                key={meal.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  paddingBottom: i < meals.length - 1 ? 12 : 0,
                  marginBottom: i < meals.length - 1 ? 12 : 0,
                  borderBottom: i < meals.length - 1 ? '1px solid var(--border)' : undefined,
                }}
              >
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
                      style={{
                        fontSize: 11, padding: '5px 10px', borderRadius: 6,
                        background: '#ef5350', color: '#fff', fontWeight: 700,
                      }}
                    >Удалить</button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{
                        fontSize: 11, padding: '5px 10px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.08)', color: 'var(--text-2)',
                      }}
                    >Отмена</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(meal.id)}
                    aria-label="Удалить запись"
                    style={{ fontSize: 18, color: 'var(--text-3)', lineHeight: 1, flexShrink: 0, padding: '0 4px' }}
                  >×</button>
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
              background: 'var(--accent-dim)',
              border: '1px dashed rgba(215,255,63,0.3)',
              color: 'var(--accent)', fontSize: 14, fontWeight: 600,
            }}
          >+ Добавить приём пищи</button>
        ) : (
          <form onSubmit={handleAddMeal}>
            <div style={{ marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Название блюда *"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                required
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <select
                value={addForm.mealType}
                onChange={e => setAddForm(f => ({ ...f, mealType: e.target.value as MealType }))}
                style={inputStyle}
              >
                {MEAL_TYPES.map(t => (
                  <option key={t} value={t}>{MEAL_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <input
                type="number" min="0" placeholder="Ккал"
                value={addForm.caloriesKcal}
                onChange={e => setAddForm(f => ({ ...f, caloriesKcal: e.target.value }))}
                style={inputStyle}
              />
              <input
                type="number" min="0" step="0.1" placeholder="Белки, г"
                value={addForm.proteinG}
                onChange={e => setAddForm(f => ({ ...f, proteinG: e.target.value }))}
                style={inputStyle}
              />
              <input
                type="number" min="0" step="0.1" placeholder="Жиры, г"
                value={addForm.fatG}
                onChange={e => setAddForm(f => ({ ...f, fatG: e.target.value }))}
                style={inputStyle}
              />
              <input
                type="number" min="0" step="0.1" placeholder="Углев., г"
                value={addForm.carbsG}
                onChange={e => setAddForm(f => ({ ...f, carbsG: e.target.value }))}
                style={inputStyle}
              />
            </div>
            {addError && (
              <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{addError}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={addLoading}
                style={{
                  flex: 1, padding: 12, borderRadius: 10,
                  background: 'var(--accent)', color: '#000',
                  fontSize: 14, fontWeight: 700,
                  opacity: addLoading ? 0.6 : 1,
                }}
              >{addLoading ? 'Сохраняем…' : 'Добавить'}</button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setAddError(null); setAddForm(EMPTY_FORM); }}
                style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-2)', fontSize: 14,
                }}
              >Отмена</button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
