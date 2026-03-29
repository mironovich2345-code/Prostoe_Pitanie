/**
 * Shared week-strip calendar component.
 * Shows Mon–Sun of the week containing `selected`.
 * Future days are disabled. Navigation capped at today.
 */

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

interface WeekCalendarProps {
  selected: string;
  onSelect: (d: string) => void;
  style?: React.CSSProperties;
}

export default function WeekCalendar({ selected, onSelect, style }: WeekCalendarProps) {
  const days = getWeekDays(selected);
  const monday = days[0];
  const sunday = days[6];

  const monthLabel = isoToLocalDate(monday).toLocaleDateString('ru-RU', {
    month: 'long', year: 'numeric',
  });

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
      padding: '12px 10px',
      border: '1px solid var(--border)',
      marginBottom: 12,
      ...style,
    }}>
      {/* Month + arrows */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingInline: 2 }}>
        <button
          onClick={goBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 20, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 8, flexShrink: 0 }}
        >‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', letterSpacing: -0.1, textTransform: 'capitalize' }}>
          {monthLabel}
        </span>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          style={{ background: 'none', border: 'none', color: canGoForward ? 'var(--text-2)' : 'transparent', fontSize: 20, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canGoForward ? 'pointer' : 'default', borderRadius: 8, flexShrink: 0 }}
        >›</button>
      </div>

      {/* Day buttons */}
      <div style={{ display: 'flex', gap: 3 }}>
        {days.map((day, i) => {
          const isSelected = day === selected;
          const isToday = day === TODAY;
          const isFuture = day > TODAY;
          const dayNum = isoToLocalDate(day).getDate();

          return (
            <button
              key={day}
              onClick={() => !isFuture && onSelect(day)}
              disabled={isFuture}
              style={{
                flex: 1, padding: '8px 2px 7px', borderRadius: 12,
                border: isToday && !isSelected
                  ? '1px solid rgba(215,255,63,0.35)'
                  : '1px solid transparent',
                background: isSelected ? 'var(--accent)' : 'transparent',
                cursor: isFuture ? 'default' : 'pointer',
                opacity: isFuture ? 0.28 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2, color: isSelected ? '#000' : 'var(--text-3)' }}>
                {RU_DOW_SHORT[i]}
              </span>
              <span style={{ fontSize: 16, lineHeight: 1, fontWeight: isSelected || isToday ? 700 : 500, color: isSelected ? '#000' : isToday ? 'var(--accent)' : 'var(--text)' }}>
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
