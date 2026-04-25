import type { ReactNode } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import type { UserProfile, SubscriptionInfo } from '../../types';

interface LinkData {
  id: number;
  clientId: string;
  status: string;
  fullHistoryAccess: boolean;
  connectedAt: string;
  clientAlias: string | null;
}

interface ClientItem {
  link: LinkData;
  profile: (UserProfile & { avatarData?: string | null }) | null;
  subscription: SubscriptionInfo | null;
  displayName: string;
}

interface ClientRef {
  chatId: string;
  displayName: string;
}

function isClientActive(sub: SubscriptionInfo | null | undefined): boolean {
  if (!sub) return false;
  return sub.status === 'active' || sub.status === 'trial';
}

function isClientPro(sub: SubscriptionInfo | null | undefined): boolean {
  if (!isClientActive(sub)) return false;
  return sub!.planId === 'pro' || sub!.planId === 'intro';
}

function genderSuffix(name: string): string {
  const last = name.trim().slice(-1);
  return last === 'а' || last === 'я' ? 'а' : '';
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function ClientAvatar({ name, avatarData }: { name: string; avatarData?: string | null }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div style={{
      width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
      overflow: 'hidden',
      background: avatarData ? 'transparent' : 'rgba(215,255,63,0.10)',
      border: '1.5px solid rgba(215,255,63,0.28)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px',
      color: 'var(--accent)',
    }}>
      {avatarData
        ? <img src={avatarData} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initial}
    </div>
  );
}

// ─── Status pill (local, more refined than generic badge) ─────────────────────
function StatusPill({ subscription }: { subscription: SubscriptionInfo | null }) {
  if (isClientPro(subscription)) {
    // Use StatusBadge for Pro — it carries the right label ('Активна', 'Pro Intro', etc.)
    return <StatusBadge status={subscription!.status} />;
  }
  if (isClientActive(subscription)) {
    return (
      <span style={{
        display: 'inline-block',
        fontSize: 11, fontWeight: 700, letterSpacing: 0.1,
        padding: '4px 10px', borderRadius: 20,
        background: 'rgba(255,180,0,0.09)', color: 'var(--warn)',
        border: '1px solid rgba(255,180,0,0.20)',
      }}>
        тариф
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11, fontWeight: 700, letterSpacing: 0.1,
      padding: '4px 10px', borderRadius: 20,
      background: 'var(--danger-soft)', color: 'var(--danger)',
      border: '1px solid rgba(255,87,87,0.20)',
    }}>
      не оплачено
    </span>
  );
}

// ─── Client card ──────────────────────────────────────────────────────────────
function ClientCard({
  client,
  pressed,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onClick,
}: {
  client: ClientItem;
  pressed: boolean;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onClick: () => void;
}) {
  const name = client.displayName;
  const weight = client.profile?.currentWeightKg;
  const frozen = client.link.status === 'frozen';

  return (
    <div
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '15px 16px',
        background: 'var(--surface-2)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        /* Press animation: scale + slight dim */
        transform: pressed ? 'scale(0.975)' : 'scale(1)',
        opacity: pressed ? 0.72 : 1,
        transition: pressed
          ? 'transform 0.06s ease, opacity 0.06s ease'
          : 'transform 0.18s ease, opacity 0.18s ease',
        willChange: 'transform',
      } as React.CSSProperties}
    >
      {/* Avatar */}
      <ClientAvatar name={name} avatarData={client.profile?.avatarData} />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px',
          color: 'var(--text)', lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {name}
        </div>
        <div style={{
          fontSize: 12, color: 'var(--text-3)',
          marginTop: 4, lineHeight: 1,
        }}>
          {weight ? `${weight} кг` : '—'}
          {frozen ? <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>· заморожен</span> : null}
        </div>
      </div>

      {/* Status */}
      <StatusPill subscription={client.subscription} />
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--surface-2)',
      borderRadius: 'var(--r-md)',
      border: '1px solid var(--border)',
      padding: '14px 6px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: 'var(--text)' }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, color: 'var(--text-3)', marginTop: 6,
        whiteSpace: 'pre-line', lineHeight: 1.35, letterSpacing: 0.1,
      }}>
        {label}
      </div>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 1.1, color: 'var(--text-3)',
    }}>
      {children}
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CoachClientsScreen() {
  const navigate = useNavigate();
  const [pressedId, setPressedId] = useState<number | null>(null);

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['trainer-clients'],
    queryFn: api.trainerClients,
  });
  const { data: alertsData } = useQuery({
    queryKey: ['trainer-alerts'],
    queryFn: api.trainerAlerts,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  const clients = (clientsData?.clients ?? []) as unknown as ClientItem[];
  const notLoggedToday = (alertsData?.notLoggedToday ?? []) as unknown as ClientRef[];
  const activeToday = alertsData?.activeToday ?? 0;

  return (
    <div className="screen">
      {/* ── Outer card ───────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border-2)',
        overflow: 'hidden',
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3, color: 'var(--text)' }}>
              EATLYY
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
              Expert
            </span>
          </div>
        </div>

        {/* ── Statistics ─────────────────────────────────────────────── */}
        <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <SectionLabel>Статистика</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <StatCard value={clients.length} label={'Всего\nклиентов'} />
            <StatCard value={activeToday} label={'Записали\nсегодня'} />
            <StatCard value={notLoggedToday.length} label={'Не\nзаписали'} />
          </div>
        </div>

        {/* ── Clients list ───────────────────────────────────────────── */}
        <div style={{ borderBottom: notLoggedToday.length > 0 ? '1px solid var(--border)' : 'none' }}>
          {/* Section header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '15px 16px 11px',
          }}>
            <SectionLabel>Клиенты</SectionLabel>
            <button
              onClick={() => navigate('/connect-client')}
              style={{
                fontSize: 12, fontWeight: 700, letterSpacing: 0.1,
                background: 'var(--accent)', color: '#000',
                border: 'none', borderRadius: 20,
                padding: '5px 13px', cursor: 'pointer',
              }}
            >
              + Добавить
            </button>
          </div>

          {clients.length === 0 ? (
            <div style={{ padding: '6px 16px 20px', fontSize: 14, color: 'var(--text-3)', textAlign: 'center' }}>
              Клиентов пока нет
            </div>
          ) : (
            /* Individual cards with gap — not rows with borders */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 12px 14px' }}>
              {clients.map((c: ClientItem) => (
                <ClientCard
                  key={c.link.id}
                  client={c}
                  pressed={pressedId === c.link.id}
                  onPointerDown={() => setPressedId(c.link.id)}
                  onPointerUp={() => setPressedId(null)}
                  onPointerLeave={() => setPressedId(null)}
                  onClick={() => navigate(`/client/${c.link.clientId}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Not logged today ───────────────────────────────────────── */}
        {notLoggedToday.length > 0 && (
          <div>
            <div style={{ padding: '14px 16px 10px' }}>
              <SectionLabel>Не записали сегодня</SectionLabel>
            </div>
            {notLoggedToday.map((c: ClientRef) => (
              <div
                key={c.chatId}
                onClick={() => navigate(`/client/${c.chatId}/stats`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 16px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--accent-dim)',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--accent)', flexShrink: 0,
                }} />
                <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{c.displayName}</span>
                  {` не добавил${genderSuffix(c.displayName)} еду сегодня`}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
