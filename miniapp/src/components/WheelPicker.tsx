import { useRef, useEffect } from 'react';

const ITEM_H = 52;
const VISIBLE = 5;
const PADDING = Math.floor(VISIBLE / 2); // 2 spacers top/bottom

interface WheelPickerProps {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}

/**
 * Drum-style scroll picker (iPhone alarm wheel).
 * Items are plain strings; selected item is centered between accent lines.
 *
 * Layout: PADDING spacer divs above + items + PADDING spacer divs below.
 * scrollTop = idx * ITEM_H when items[idx] is centered.
 * Scroll snap: y mandatory on container, center on each real item.
 */
export default function WheelPicker({ items, value, onChange }: WheelPickerProps) {
  const containerH = ITEM_H * VISIBLE;
  const scrollRef = useRef<HTMLDivElement>(null);
  // Keep onChange in ref to avoid stale closure issues
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Prevent feedback loop when we set scrollTop programmatically
  const suppressRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync scroll position when value changes externally
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = items.indexOf(value);
    if (idx < 0) return;
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) < 1) return;
    suppressRef.current = true;
    el.scrollTop = target;
    setTimeout(() => { suppressRef.current = false; }, 200);
  }, [value, items]);

  function handleScroll() {
    if (suppressRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
      onChangeRef.current(items[idx]);
    }, 80);
  }

  return (
    <div style={{ position: 'relative', height: containerH, userSelect: 'none' }}>

      {/* Accent selection lines */}
      <div style={{
        position: 'absolute',
        top: PADDING * ITEM_H,
        height: ITEM_H,
        left: 24, right: 24,
        borderTop: '1px solid rgba(215,255,63,0.3)',
        borderBottom: '1px solid rgba(215,255,63,0.3)',
        borderRadius: 4,
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      {/* Gradient fade top/bottom */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, var(--bg) 0%, transparent 32%, transparent 68%, var(--bg) 100%)',
        pointerEvents: 'none',
        zIndex: 3,
      }} />

      {/* Scrollable drum */}
      <div
        ref={scrollRef}
        className="wheel-picker-scroll"
        onScroll={handleScroll}
        style={{ height: '100%' }}
      >
        {/* Top spacers — allow first item to scroll to center */}
        {Array.from({ length: PADDING }, (_, i) => (
          <div key={`s-t-${i}`} style={{ height: ITEM_H }} />
        ))}

        {items.map((item, i) => (
          <div
            key={i}
            style={{
              height: ITEM_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              scrollSnapAlign: 'center',
              fontSize: 26,
              fontWeight: item === value ? 700 : 400,
              letterSpacing: '-0.6px',
              color: item === value ? 'var(--text)' : 'var(--text-3)',
            }}
          >
            {item}
          </div>
        ))}

        {/* Bottom spacers — allow last item to scroll to center */}
        {Array.from({ length: PADDING }, (_, i) => (
          <div key={`s-b-${i}`} style={{ height: ITEM_H }} />
        ))}
      </div>
    </div>
  );
}
