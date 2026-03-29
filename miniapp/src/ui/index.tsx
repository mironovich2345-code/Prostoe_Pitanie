/**
 * Простое Питание — UI Component Library
 * Dark Premium Design System
 */

import React from 'react';

// ─── Design tokens (mirrors styles.css :root) ─────────────────────────────
export const colors = {
  bg: '#0A0A0A',
  surface: '#141414',
  surface2: '#1E1E1E',
  surface3: '#282828',
  border: 'rgba(255,255,255,0.07)',
  border2: 'rgba(255,255,255,0.13)',
  text: '#FFFFFF',
  text2: '#A0A0A0',
  text3: '#555555',
  accent: '#D7FF3F',
  accentSoft: 'rgba(215,255,63,0.14)',
  danger: '#FF5757',
  dangerSoft: 'rgba(255,87,87,0.12)',
  warn: '#FFC400',
  warnSoft: 'rgba(255,196,0,0.12)',
  macroP: '#7EB8F0',
  macroF: '#F0A07A',
  macroC: '#90C860',
} as const;

export const radius = { xs: 8, sm: 12, md: 18, lg: 22, xl: 28 } as const;

// ─── PageHeader ───────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: React.CSSProperties;
}
export function PageHeader({ title, onBack, right, style }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Назад"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              width: 36, height: 36,
              borderRadius: radius.sm,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text)',
              fontSize: 20, lineHeight: 1,
              flexShrink: 0, cursor: 'pointer',
            }}
          >‹</button>
        )}
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </h1>
      </div>
      {right && <div style={{ flexShrink: 0, marginLeft: 8 }}>{right}</div>}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  noPad?: boolean;
  onClick?: () => void;
}
export function Card({ children, style, noPad, onClick }: CardProps) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{ padding: noPad ? 0 : undefined, cursor: onClick ? 'pointer' : undefined, ...style }}
    >
      {children}
    </div>
  );
}

// ─── SectionTitle ─────────────────────────────────────────────────────────
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="section-title" style={style}>{children}</div>;
}

// ─── StatRow ──────────────────────────────────────────────────────────────
export function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────
export function ProgressBar({ value, danger }: { value: number; danger?: boolean }) {
  return (
    <div className="progress-bar">
      <div className={`progress-fill${danger ? ' progress-fill-danger' : ''}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// ─── ListCard + ListItem ──────────────────────────────────────────────────
export function ListCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="list-card" style={style}>{children}</div>;
}

interface ListItemProps {
  label: React.ReactNode;
  right?: React.ReactNode;
  arrow?: boolean;
  onClick?: () => void;
}
export function ListItem({ label, right, arrow = true, onClick }: ListItemProps) {
  return (
    <button className="list-item" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <span>{label}</span>
      {right != null ? right : arrow ? <span className="list-arrow">›</span> : null}
    </button>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent-soft';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  fullWidth?: boolean;
}
export function Button({ variant = 'primary', fullWidth = true, style, className, ...rest }: ButtonProps) {
  const cls = variant === 'primary' ? 'btn' : `btn btn-${variant}`;
  return (
    <button
      className={`${cls}${className ? ` ${className}` : ''}`}
      style={{ width: fullWidth ? '100%' : 'auto', ...style }}
      {...rest}
    />
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────
interface IconButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  'aria-label'?: string;
}
export function IconButton({ onClick, children, style, ...rest }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: radius.sm, width: 36, height: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text)', fontSize: 18, cursor: 'pointer',
        flexShrink: 0, ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────
type ChipVariant = 'accent' | 'muted' | 'danger' | 'warn' | 'purple';
interface ChipProps {
  children: React.ReactNode;
  variant?: ChipVariant;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function Chip({ children, variant = 'muted', onClick, style }: ChipProps) {
  return (
    <span
      className={`chip chip-${variant}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
    >
      {children}
    </span>
  );
}

// ─── MacroTiles ───────────────────────────────────────────────────────────
// Horizontal row of 3 compact macro tiles: Белки / Жиры / Углеводы
interface MacroTilesProps {
  protein: number;
  fat: number;
  carbs: number;
  normProtein?: number | null;
  normFat?: number | null;
  normCarbs?: number | null;
}
export function MacroTiles({ protein, fat, carbs, normProtein, normFat, normCarbs }: MacroTilesProps) {
  const macros = [
    { label: 'Белки', value: protein, norm: normProtein, color: colors.macroP },
    { label: 'Жиры',  value: fat,     norm: normFat,     color: colors.macroF },
    { label: 'Углеводы', value: carbs, norm: normCarbs,  color: colors.macroC },
  ];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {macros.map(m => (
        <div
          key={m.label}
          style={{
            flex: 1,
            background: 'var(--surface)',
            borderRadius: radius.md,
            padding: '12px 10px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: m.color, letterSpacing: -0.5, lineHeight: 1 }}>
            {m.value.toFixed(0)}<span style={{ fontSize: 12, fontWeight: 500 }}>г</span>
          </div>
          {m.norm && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>/ {m.norm}г</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontWeight: 500 }}>{m.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── CalorieCard ──────────────────────────────────────────────────────────
// Large today-calories display with progress bar
interface CalorieCardProps {
  calories: number;
  norm?: number | null;
  mealCount?: number;
}
export function CalorieCard({ calories, norm, mealCount }: CalorieCardProps) {
  const pct = norm ? Math.min(100, Math.round((calories / norm) * 100)) : null;
  const isOver = pct !== null && pct >= 100;
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: radius.lg,
        padding: '20px 18px',
        marginBottom: 10,
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 6 }}>
            Сегодня
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1.5, color: 'var(--text)', lineHeight: 1 }}>
              {calories.toLocaleString('ru')}
            </span>
            <span style={{ fontSize: 15, color: 'var(--text-3)', fontWeight: 500 }}>ккал</span>
          </div>
          {norm && (
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>
              норма {norm.toLocaleString('ru')} ккал
            </div>
          )}
        </div>
        {pct !== null && (
          <div
            style={{
              background: isOver ? 'var(--danger-soft)' : 'var(--accent-soft)',
              color: isOver ? 'var(--danger)' : 'var(--accent)',
              borderRadius: radius.sm,
              padding: '6px 12px',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            {pct}%
          </div>
        )}
      </div>
      {pct !== null && <ProgressBar value={pct} danger={isOver} />}
      {mealCount !== undefined && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
          {mealCount === 0 ? 'Нет записей' : `${mealCount} ${mealCount === 1 ? 'приём' : mealCount < 5 ? 'приёма' : 'приёмов'} пищи`}
        </div>
      )}
    </div>
  );
}

// ─── Toggle (iOS-style) ───────────────────────────────────────────────────
interface ToggleProps {
  enabled: boolean;
  pending?: boolean;
  onChange: (v: boolean) => void;
}
export function Toggle({ enabled, pending, onChange }: ToggleProps) {
  return (
    <div
      onClick={() => !pending && onChange(!enabled)}
      role="switch"
      aria-checked={enabled}
      style={{
        width: 51, height: 31, borderRadius: 31, padding: 2,
        background: enabled ? 'var(--accent)' : 'rgba(120,120,128,0.32)',
        display: 'flex', alignItems: 'center',
        justifyContent: enabled ? 'flex-end' : 'flex-start',
        cursor: pending ? 'default' : 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{ width: 27, height: 27, borderRadius: 27, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
    </div>
  );
}
