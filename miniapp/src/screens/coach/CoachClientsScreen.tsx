import type { ReactNode } from 'react';
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

// Heuristic Russian feminine suffix
function genderSuffix(name: string): string {
  const last = name.trim().slice(-1);
  return last === 'а' || last === 'я' ? 'а' : '';
}

function ClientAvatar({ name, avatarData }: { name: string; avatarData?: string | null }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div style={{
      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
      background: avatarData ? 'transparent' : 'var(--accent-soft)',
      border: '1.5px solid rgba(215,255,63,0.22)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, fontWeight: 700, color: 'var(--accent)', overflow: 'hidden',
    }}>
      {avatarData
        ? <img src={avatarData} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initial}
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
        <div>
          {/* Section header row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 12px',
          }}>
            <SectionLabel>Клиенты</SectionLabel>
            <button
              onClick={() => navigate('/connect-client')}
              style={{
                fontSize: 12, fontWeight: 700,
                background: 'var(--accent)', color: '#000',
                border: 'none', borderRadius: 20,
                padding: '5px 13px', cursor: 'pointer',
                letterSpacing: 0.1,
              }}
            >
              + Добавить
            </button>
          </div>

          {clients.length === 0 ? (
            <div style={{ padding: '8px 16px 20px', fontSize: 14, color: 'var(--text-3)', textAlign: 'center' }}>
              Клиентов пока нет
            </div>
          ) : (
            clients.map((c: ClientItem) => {
              const name = c.displayName;
              return (
                <div
                  key={c.link.id}
                  onClick={() => navigate(`/client/${c.link.clientId}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 16px',
                    borderTop: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onTouchStart={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onTouchEnd={e => (e.currentTarget.style.background = '')}
                >
                  <ClientAvatar name={name} avatarData={c.profile?.avatarData} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                      {name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
                      {c.profile?.currentWeightKg ? `${c.profile.currentWeightKg} кг` : '—'}
                      {c.link.status === 'frozen' ? ' · заморожен' : ''}
                    </div>
                  </div>
                  {isClientPro(c.subscription) ? (
                    <StatusBadge status={c.subscription!.status} />
                  ) : isClientActive(c.subscription) ? (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                      background: 'rgba(255,180,0,0.10)', color: 'var(--warn)',
                      border: '1px solid rgba(255,180,0,0.22)',
                    }}>
                      тариф
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                      background: 'var(--danger-soft)', color: 'var(--danger)',
                      border: '1px solid rgba(255,87,87,0.22)',
                    }}>
                      не оплачено
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Not logged today ───────────────────────────────────────── */}
        {notLoggedToday.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
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
