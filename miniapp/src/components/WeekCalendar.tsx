/**
 * Shared week/month calendar component.
 * Collapsed: Mon–Sun strip of the week containing `selected`, with week navigation.
 * Expanded: full month grid for the month containing `selected`.
 * Future days are disabled. Each day shows 3 meal-presence dots (breakfast/lunch/dinner).
 */

import { useState } from 'react';

const RU_DOW_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const TODAY = new Date().toISOString().split('T')[0];

export function isoToLocalDate(iso: string) {
  return new Date(iso + 'T12:00:00');
}

/** Returns Mon–Sun array of YYYY-MM-DD strings for the week containing `anchor` */
export function getWeekDays(anchor: string): string[] {
  const d = isoToLocalDate(anchor);
  const dow = d.getDay(); // 0=Sun
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + toMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(mon);
    day.setDate(mon.getDate() + i);
    return day.toISOString().split('T')[0];
  });
}

/** Returns all day cells (null = empty) for the Mon-aligned month grid of `anchor` */
function getMonthGrid(anchor: string): (string | null)[] {
  const d = isoToLocalDate(anchor);
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const firstDow = firstDay.getDay(); // 0=Sun
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;

  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dt = new Date(year, month, day);
    cells.push(dt.toISOString().split('T')[0]);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthLabel(anchor: string): string {
  return isoToLocalDate(anchor).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

export interface DotSet {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

/** 3 tiny dots: breakfast / lunch / dinner */
function MealDots({ dots, isFuture }: { dots?: DotSet; isFuture?: boolean }) {
  const has = dots ? [dots.breakfast, dots.lunch, dots.dinner] : [false, false, false];
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', height: 5, marginTop: 3 }}>
      {has.map((active, i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: active && !isFuture ? 'var(--accent)' : 'rgba(255,255,255,0.13)',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

interface WeekCalendarProps {
  selected: string;
  onSelect: (d: string) => void;
  dotsByDate?: Record<string, DotSet>;
  style?: React.CSSProperties;
}

export default function WeekCalendar({ selected, onSelect, dotsByDate, style }: WeekCalendarProps) {
  const [expanded, setExpanded] = useState(false);

  return expanded
    ? <MonthView selected={selected} onSelect={onSelect} dotsByDate={dotsByDate} onCollapse={() => setExpanded(false)} style={style} />
    : <WeekView  selected={selected} onSelect={onSelect} dotsByDate={dotsByDate} onExpand={() => setExpanded(true)} style={style} />;
}

// ─── Week strip ─────────────────────────────────────────────────────────────

function WeekView({ selected, onSelect, dotsByDate, onExpand, style }: WeekCalendarProps & { onExpand: () => void }) {
  const days = getWeekDays(selected);
  const sunday = days[6];

  const goBack = () => {
    const d = isoToLocalDate(selected);
    d.setDate(d.getDate() - 7);
    onSelect(d.toISOString().split('T')[0]);
  };

  const goForward = () => {
    const d = isoToLocalDate(selected);
    d.setDate(d.getDate() + 7);
    const candidate = d.toISOString().split('T')[0];
    onSelect(candidate > TODAY ? TODAY : candidate);
  };

  const canGoForward = sunday < TODAY;

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--r-lg)',
      padding: '10px 10px 12px',
      border: '1px solid var(--border)',
      marginBottom: 12,
      ...style,
    }}>
      {/* Month + arrows + expand toggle */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, paddingInline: 2, gap: 4 }}>
        <button
          onClick={goBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 20, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 8, flexShrink: 0 }}
        >‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', letterSpacing: -0.1, textTransform: 'capitalize' }}>
          {monthLabel(selected)}
        </span>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 20, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 8, flexShrink: 0, visibility: canGoForward ? 'visible' : 'hidden' }}
        >›</button>
        <button
          onClick={onExpand}
          aria-label="Показать месяц"
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 7,
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            color: 'var(--text-3)',
            fontSize: 11,
            lineHeight: 1,
          }}
        >▾</button>
      </div>

      {/* Day buttons */}
      <div style={{ display: 'flex', gap: 3 }}>
        {days.map((day, i) => {
          const isSelected = day === selected;
          const isToday = day === TODAY;
          const isFuture = day > TODAY;
          const dayNum = isoToLocalDate(day).getDate();
          const dots = dotsByDate?.[day];

          return (
            <button
              key={day}
              onClick={() => !isFuture && onSelect(day)}
              disabled={isFuture}
              style={{
                flex: 1, padding: '6px 2px 6px', borderRadius: 12,
                border: isToday && !isSelected
                  ? '1px solid rgba(215,255,63,0.35)'
                  : '1px solid transparent',
                background: isSelected ? 'var(--accent)' : 'transparent',
                cursor: isFuture ? 'default' : 'pointer',
                opacity: isFuture ? 0.28 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2, color: isSelected ? '#000' : 'var(--text-3)' }}>
                {RU_DOW_SHORT[i]}
              </span>
              <span style={{ fontSize: 16, lineHeight: 1, fontWeight: isSelected || isToday ? 700 : 500, color: isSelected ? '#000' : isToday ? 'var(--accent)' : 'var(--text)' }}>
                {dayNum}
              </span>
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {[dots?.breakfast, dots?.lunch, dots?.dinner].map((active, di) => (
                  <div key={di} style={{ width: 4, height: 4, borderRadius: '50%', background: active && !isFuture ? (isSelected ? 'rgba(0,0,0,0.5)' : 'var(--accent)') : (isSelected ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.13)') }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month grid ──────────────────────────────────────────────────────────────

function MonthView({ selected, onSelect, dotsByDate, onCollapse, style }: WeekCalendarProps & { onCollapse: () => void }) {
  const [anchor, setAnchor] = useState(() => {
    // Start at month of selected date
    return selected.slice(0, 7) + '-01';
  });

  const cells = getMonthGrid(anchor);
  const d = isoToLocalDate(anchor);
  const year = d.getFullYear();
  const month = d.getMonth();

  const goBack = () => {
    const prev = new Date(year, month - 1, 1);
    setAnchor(prev.toISOString().split('T')[0]);
  };

  const goForward = () => {
    const next = new Date(year, month + 1, 1);
    const nextStr = next.toISOString().split('T')[0];
    // Don't go past current month
    const todayMonth = TODAY.slice(0, 7);
    if (nextStr.slice(0, 7) <= todayMonth) {
      setAnchor(nextStr);
    }
  };

  const canGoForward = anchor.slice(0, 7) < TODAY.slice(0, 7);

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--r-lg)',
      padding: '10px 10px 12px',
      border: '1px solid var(--border)',
      marginBottom: 12,
      ...style,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, paddingInline: 2, gap: 4 }}>
        <button
          onClick={goBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 20, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 8, flexShrink: 0 }}
        >‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', letterSpacing: -0.1, textTransform: 'capitalize' }}>
          {monthLabel(anchor)}
        </span>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 20, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 8, flexShrink: 0, visibility: canGoForward ? 'visible' : 'hidden' }}
        >›</button>
        <button
          onClick={onCollapse}
          aria-label="Свернуть до недели"
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 7,
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            color: 'var(--text-3)',
            fontSize: 11,
            lineHeight: 1,
          }}
        >▴</button>
      </div>

      {/* DOW headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {RU_DOW_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-3)', letterSpacing: 0.2, padding: '0 0 4px' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px 2px' }}>
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`e-${idx}`} />;
          }
          const isSelected = day === selected;
          const isToday = day === TODAY;
          const isFuture = day > TODAY;
          const dayNum = isoToLocalDate(day).getDate();
          const dots = dotsByDate?.[day];

          return (
            <button
              key={day}
              onClick={() => !isFuture && onSelect(day)}
              disabled={isFuture}
              style={{
                padding: '5px 2px 5px',
                borderRadius: 10,
                border: isToday && !isSelected
                  ? '1px solid rgba(215,255,63,0.35)'
                  : '1px solid transparent',
                background: isSelected ? 'var(--accent)' : 'transparent',
                cursor: isFuture ? 'default' : 'pointer',
                opacity: isFuture ? 0.25 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                transition: 'background 0.15s',
                minWidth: 0,
              }}
            >
              <span style={{
                fontSize: 13, lineHeight: 1,
                fontWeight: isSelected || isToday ? 700 : 400,
                color: isSelected ? '#000' : isToday ? 'var(--accent)' : 'var(--text)',
              }}>
                {dayNum}
              </span>
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {[dots?.breakfast, dots?.lunch, dots?.dinner].map((active, di) => (
                  <div key={di} style={{ width: 3, height: 3, borderRadius: '50%', background: active && !isFuture ? (isSelected ? 'rgba(0,0,0,0.5)' : 'var(--accent)') : (isSelected ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.13)') }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
