import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import type { UserProfile, SubscriptionInfo } from '../../types';

function isClientActive(sub: SubscriptionInfo | null | undefined): boolean {
  if (!sub) return false;
  return sub.status === 'active' || sub.status === 'trial';
}

interface LinkData {
  id: number;
  status: string;
  fullHistoryAccess: boolean;
  connectedAt: string;
  clientAlias: string | null;
}

function AliasSheet({
  current,
  defaultName,
  onSave,
  onClose,
}: {
  current: string | null;
  defaultName: string;
  onSave: (alias: string) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(current ?? '');
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', background: 'var(--surface)',
          borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
          padding: '24px 20px 32px', boxSizing: 'border-box',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          Моё название клиента
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.4 }}>
          Видно только вам. По умолчанию: <span style={{ color: 'var(--text-2)' }}>{defaultName}</span>
        </div>
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSave(val)}
          maxLength={50}
          placeholder={defaultName}
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--surface-2)', border: '1px solid var(--accent)',
            borderRadius: 10, padding: '12px 14px', fontSize: 15,
            color: 'var(--text)', outline: 'none', fontFamily: 'inherit', marginBottom: 12,
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => onSave(val)}>
            Сохранить
          </button>
          {current && (
            <button
              onClick={() => onSave('')}
              style={{
                padding: '12px 16px', background: 'var(--surface-3)',
                border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
                fontSize: 13, color: 'var(--danger)', cursor: 'pointer',
              }}
            >
              Сбросить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoachClientCardScreen() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showAliasSheet, setShowAliasSheet] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['trainer-client', clientId],
    queryFn: () => api.trainerClientCard(clientId!),
  });

  const aliasMutation = useMutation({
    mutationFn: (alias: string) => api.trainerSetClientAlias(clientId!, alias),
    onSuccess: () => {
      setShowAliasSheet(false);
      qc.invalidateQueries({ queryKey: ['trainer-client', clientId] });
      qc.invalidateQueries({ queryKey: ['trainer-clients'] });
    },
  });

  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  const p = data?.profile as UserProfile | null;
  const sub = data?.subscription as SubscriptionInfo | null;
  const link = data?.link as LinkData | null;
  const clientActive = isClientActive(sub);
  const displayName = (data as { displayName?: string })?.displayName ?? `Клиент …${clientId?.slice(-4)}`;
  const defaultName = p?.preferredName?.trim() || `Клиент …${clientId?.slice(-4)}`;
  const initial = displayName.charAt(0).toUpperCase();

  const GOAL_LABELS: Record<string, string> = {
    lose: 'Похудение', maintain: 'Поддержание', gain: 'Набор массы', track: 'Контроль питания',
  };
  const goalParts: string[] = [];
  if (p?.goalType) goalParts.push(`Цель: ${GOAL_LABELS[p.goalType] ?? p.goalType}`);
  if (p?.dailyCaloriesKcal) goalParts.push(`${p.dailyCaloriesKcal} ккал/день`);
  const goalLine = goalParts.join(' · ') || null;

  return (
    <div className="screen">
      {/* Unpaid banner */}
      {!clientActive && (
        <div style={{
          background: 'rgba(255,59,48,0.10)', border: '1px solid rgba(255,59,48,0.25)',
          borderRadius: 'var(--r-lg)', padding: '10px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>Подписка не активна</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              Клиент потерял доступ к платным функциям. Просмотр статистики ограничен.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >
          ‹
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>
          {link?.clientAlias && p?.preferredName && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              наст. имя: {p.preferredName}
            </div>
          )}
        </div>
        {/* Alias button */}
        <button
          onClick={() => setShowAliasSheet(true)}
          style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 12px', fontSize: 12,
            color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          {link?.clientAlias ? 'Переименовать' : 'Подписать'}
        </button>
      </div>

      {/* Avatar row */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '18px 20px',
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent-soft)', border: '2px solid rgba(215,255,63,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: 'var(--accent)',
        }}>
          {initial}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{displayName}</div>
          <StatusBadge status={sub?.status ?? 'free'} />
          {goalLine && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{goalLine}</div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12,
      }}>
        {[
          p?.currentWeightKg ? { label: 'Вес', value: `${p.currentWeightKg} кг` } : null,
          p?.desiredWeightKg ? { label: 'Желаемый вес', value: `${p.desiredWeightKg} кг` } : null,
          p?.dailyCaloriesKcal ? { label: 'Норма калорий', value: `${p.dailyCaloriesKcal} ккал` } : null,
          link ? { label: 'Доступ к истории', value: link.fullHistoryAccess ? 'Полный' : 'С подключения' } : null,
        ].filter(Boolean).map((row, i, arr) => (
          <div
            key={row!.label}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '13px 20px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{row!.label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{row!.value}</span>
          </div>
        ))}
      </div>

      {/* Subscription */}
      {sub?.currentPeriodEnd && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-xl)',
          border: '1px solid var(--border)', padding: '13px 20px', marginBottom: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Подписка до</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {new Date(sub.currentPeriodEnd).toLocaleDateString('ru-RU')}
          </span>
        </div>
      )}

      {clientActive ? (
        <button className="btn" onClick={() => navigate(`/client/${clientId}/stats`)}>
          Статистика клиента →
        </button>
      ) : (
        <button
          disabled
          className="btn"
          style={{ opacity: 0.4, cursor: 'default', background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
        >
          Статистика недоступна — нет подписки
        </button>
      )}

      {/* Alias bottom-sheet */}
      {showAliasSheet && (
        <AliasSheet
          current={link?.clientAlias ?? null}
          defaultName={defaultName}
          onSave={(alias) => aliasMutation.mutate(alias)}
          onClose={() => setShowAliasSheet(false)}
        />
      )}
    </div>
  );
}
