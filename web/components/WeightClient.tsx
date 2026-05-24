'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  webApi, ApiError,
  type WebWeightEntry, type WebWeightResponse, type WebAddWeightPayload,
} from '@/lib/webApi';

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

const GOAL_LABELS: Record<string, string> = {
  lose:     'Похудение',
  maintain: 'Поддержание',
  gain:     'Набор веса',
  track:    'Контроль',
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function fmtDelta(delta: number): string {
  if (Math.abs(delta) < 0.05) return '0 кг';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${Math.round(delta * 10) / 10} кг`;
}

// ─── UI primitives ────────────────────────────────────────────────────────────

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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 8,
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 14, minHeight: 44,
};

// ─── Weight line chart (SVG, no deps) ────────────────────────────────────────

function WeightLineChart({
  entries,
  desiredWeightKg,
}: {
  entries: WebWeightEntry[];
  desiredWeightKg: number | null;
}) {
  if (entries.length < 2) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        Добавьте минимум 2 замера для графика
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
  const weights = sorted.map(e => e.weightKg);
  const allVals = [...weights, ...(desiredWeightKg != null ? [desiredWeightKg] : [])];
  const minW = Math.min(...allVals);
  const maxW = Math.max(...allVals);
  const span = maxW - minW;
  const padKg = span < 0.5 ? 2 : span * 0.18;
  const lo = minW - padKg;
  const hi = maxW + padKg;

  const W = 300, H = 168;
  const padL = 44, padR = 8, padT = 20, padB = 22;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = sorted.length;

  const toX = (i: number) => padL + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const toY = (w: number) => padT + chartH - ((w - lo) / (hi - lo)) * chartH;

  const points = sorted.map((e, i) => `${toX(i)},${toY(e.weightKg)}`).join(' ');
  const goalY = desiredWeightKg != null ? toY(desiredWeightKg) : null;
  const rDot = n <= 20 ? 3 : 2;

  const fmtLabel = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  const midVal = Math.round(((lo + hi) / 2) * 10) / 10;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}
      aria-label="График веса">
      {/* Grid lines + Y labels */}
      {([lo, (lo + hi) / 2, hi] as number[]).map((v, idx) => {
        const y = toY(v);
        const label = idx === 1 ? String(midVal) : `${Math.round(v * 10) / 10}`;
        return (
          <g key={idx}>
            <line x1={padL} y1={y} x2={W - padR} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 3} y={y + 3.5} textAnchor="end" fontSize="8"
              fill="rgba(255,255,255,0.25)">{label}</text>
          </g>
        );
      })}

      {/* Goal line */}
      {goalY !== null && (
        <g>
          <line x1={padL} y1={goalY} x2={W - padR} y2={goalY}
            stroke="rgba(76,175,80,0.45)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={padL + 3} y={goalY - 3} fontSize="8" fill="rgba(76,175,80,0.65)">
            Цель {desiredWeightKg} кг
          </text>
        </g>
      )}

      {/* Line */}
      <polyline points={points} fill="none"
        stroke="rgba(215,255,63,0.65)" strokeWidth="1.8" strokeLinejoin="round" />

      {/* Dots */}
      {sorted.map((e, i) => (
        <circle key={i} cx={toX(i)} cy={toY(e.weightKg)} r={rDot}
          fill="rgba(215,255,63,0.85)" />
      ))}

      {/* Weight labels: first + last */}
      <text x={toX(0)} y={toY(sorted[0].weightKg) - 7}
        textAnchor="start" fontSize="9" fontWeight="700" fill="rgba(255,255,255,0.75)">
        {sorted[0].weightKg} кг
      </text>
      {n > 1 && (
        <text x={toX(n - 1)} y={toY(sorted[n - 1].weightKg) - 7}
          textAnchor="end" fontSize="9" fontWeight="700" fill="rgba(255,255,255,0.75)">
          {sorted[n - 1].weightKg} кг
        </text>
      )}

      {/* Date labels: first + last */}
      <text x={toX(0)} y={H - 4} textAnchor="start" fontSize="9"
        fill="rgba(255,255,255,0.30)">
        {fmtLabel(sorted[0].measuredAt)}
      </text>
      {n > 1 && (
        <text x={toX(n - 1)} y={H - 4} textAnchor="end" fontSize="9"
          fill="rgba(255,255,255,0.30)">
          {fmtLabel(sorted[n - 1].measuredAt)}
        </text>
      )}
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeightClient() {
  const [authState, setAuthState]             = useState<AuthState>('loading');
  const [data, setData]                       = useState<WebWeightResponse | null>(null);
  const [dataLoading, setDataLoading]         = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [addWeightKg, setAddWeightKg]         = useState('');
  const [addDate, setAddDate]                 = useState(todayStr());
  const [addLoading, setAddLoading]           = useState(false);
  const [addError, setAddError]               = useState<string | null>(null);

  async function loadData() {
    setDataLoading(true);
    try {
      const res = await webApi.getWeightHistory();
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
        loadData();
      })
      .catch(() => setAuthState('unauthenticated'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const w = Number(addWeightKg);
    if (!addWeightKg || !Number.isFinite(w) || w < 30 || w > 300) {
      setAddError('Введите вес от 30 до 300 кг');
      return;
    }
    const payload: WebAddWeightPayload = {
      weightKg: w,
      ...(addDate && addDate !== todayStr() ? { measuredAt: addDate } : {}),
    };
    setAddLoading(true);
    try {
      await webApi.addWeightEntry(payload);
      setAddWeightKg('');
      setAddDate(todayStr());
      await loadData();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.code : 'Ошибка при сохранении');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    try {
      await webApi.deleteWeightEntry(id);
      setConfirmDeleteId(null);
      await loadData();
    } catch {
      setConfirmDeleteId(null);
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
          Войдите в аккаунт, чтобы вести историю веса.
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
  const profile  = data?.profile  ?? null;
  const entries  = data?.entries  ?? [];
  const progress = data?.progress ?? null;

  // Compute per-entry delta (change since previous, older measurement)
  const entriesWithDelta = entries.map((e, i) => ({
    ...e,
    delta: i < entries.length - 1
      ? Math.round((e.weightKg - entries[i + 1].weightKg) * 10) / 10
      : null,
  }));

  const goalReached = progress != null && progress.progressPercent >= 100;

  return (
    <div>
      {/* Back link */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/client" style={{ fontSize: 13, color: 'var(--text-3)' }}>
          ← Мой кабинет
        </Link>
      </div>

      {/* Current weight & goal chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{
          flex: 1, padding: '16px 18px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 6 }}>
            Текущий вес
          </div>
          {dataLoading ? (
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-3)' }}>—</div>
          ) : profile?.currentWeightKg != null ? (
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>
              {profile.currentWeightKg} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)' }}>кг</span>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-3)' }}>Нет данных</div>
          )}
          {profile?.goalType && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              {GOAL_LABELS[profile.goalType] ?? profile.goalType}
            </div>
          )}
        </div>

        <div style={{
          flex: 1, padding: '16px 18px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 6 }}>
            Цель
          </div>
          {profile?.desiredWeightKg != null ? (
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>
              {profile.desiredWeightKg} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)' }}>кг</span>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-3)' }}>Не задана</div>
          )}
          {profile?.heightCm && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              Рост: {profile.heightCm} см
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <Card>
          <SLabel>Прогресс</SLabel>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 12, color: 'var(--text-3)', marginBottom: 8,
          }}>
            <span>Старт: {progress.startWeightKg} кг</span>
            <span>Цель: {progress.desiredWeightKg} кг</span>
          </div>
          {/* Progress bar */}
          <div style={{
            width: '100%', height: 8, borderRadius: 4,
            background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 10,
          }}>
            <div style={{
              width: `${progress.progressPercent}%`,
              height: '100%', borderRadius: 4,
              background: goalReached ? '#4caf50' : 'var(--accent)',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: goalReached ? '#4caf50' : 'var(--text-2)', fontWeight: 600 }}>
              {goalReached
                ? 'Цель достигнута!'
                : `Осталось ${Math.abs(Math.round((progress.desiredWeightKg - progress.currentWeightKg) * 10) / 10)} кг до цели`}
            </span>
            <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>
              {progress.progressPercent}%
            </span>
          </div>
        </Card>
      )}

      {/* Weight line chart */}
      {entries.length >= 2 && (
        <Card>
          <SLabel>График веса</SLabel>
          <WeightLineChart entries={entries} desiredWeightKg={profile?.desiredWeightKg ?? null} />
        </Card>
      )}

      {/* Add entry form */}
      <Card>
        <SLabel>Добавить замер</SLabel>
        <form onSubmit={handleAdd}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input
              type="number"
              step="0.1"
              min="30"
              max="300"
              placeholder="Вес, кг *"
              value={addWeightKg}
              onChange={e => setAddWeightKg(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="date"
              value={addDate}
              onChange={e => setAddDate(e.target.value || todayStr())}
              style={inputStyle}
            />
          </div>
          {addError && (
            <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{addError}</div>
          )}
          <button
            type="submit"
            disabled={addLoading}
            style={{
              width: '100%', padding: 12, borderRadius: 10,
              background: 'var(--accent)', color: '#000',
              fontSize: 14, fontWeight: 700,
              opacity: addLoading ? 0.6 : 1,
            }}
          >{addLoading ? 'Сохраняем…' : 'Добавить замер'}</button>
        </form>
      </Card>

      {/* History */}
      <Card>
        <SLabel>История замеров</SLabel>
        {dataLoading ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Загрузка…</div>
        ) : entriesWithDelta.length === 0 ? (
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>
            Замеров пока нет. Добавьте первый!
          </div>
        ) : (
          entriesWithDelta.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                paddingBottom: i < entriesWithDelta.length - 1 ? 12 : 0,
                marginBottom: i < entriesWithDelta.length - 1 ? 12 : 0,
                borderBottom: i < entriesWithDelta.length - 1 ? '1px solid var(--border)' : undefined,
              }}
            >
              {/* Date */}
              <div style={{ width: 90, fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>
                {fmtDate(entry.measuredAt)}
              </div>

              {/* Weight */}
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{entry.weightKg}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 3 }}>кг</span>
                {entry.delta !== null && (
                  <span style={{
                    marginLeft: 8, fontSize: 12,
                    color: entry.delta < 0 ? '#4caf50' : entry.delta > 0 ? '#ef5350' : 'var(--text-3)',
                    fontWeight: 500,
                  }}>
                    {fmtDelta(entry.delta)}
                  </span>
                )}
              </div>

              {/* Delete */}
              {confirmDeleteId === entry.id ? (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleDelete(entry.id)}
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
                  onClick={() => setConfirmDeleteId(entry.id)}
                  aria-label="Удалить замер"
                  style={{ fontSize: 18, color: 'var(--text-3)', lineHeight: 1, flexShrink: 0, padding: '0 4px' }}
                >×</button>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
