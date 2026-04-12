import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

type SubRow = {
  planId: string;
  status: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  autoRenew: boolean;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  trial:    'var(--accent)',
  active:   '#4CAF50',
  expired:  'var(--danger)',
  canceled: 'var(--danger)',
  past_due: '#F0A07A',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SubBlock({ label, sub }: { label: string; sub: SubRow }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 8 }}>
        {label}
      </div>
      {[
        { label: 'Plan',    value: sub.planId },
        { label: 'Статус',  value: <span style={{ color: STATUS_COLORS[sub.status] ?? 'var(--text-2)', fontWeight: 700 }}>{sub.status}</span> },
        { label: 'Период',  value: fmtDate(sub.currentPeriodEnd) },
        { label: 'Триал до', value: fmtDate(sub.trialEndsAt) },
        { label: 'Создан',  value: fmtDate(sub.createdAt) },
      ].map(row => (
        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-3)' }}>{row.label}</span>
          <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminSubscriptionsScreen() {
  const navigate = useNavigate();

  const [inputChatId, setInputChatId] = useState('');
  const [chatId, setChatId] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.adminGetSubscription>> | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [extendDays, setExtendDays] = useState('30');

  function showToast(text: string, ok = true) {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 2800);
  }

  const lookupMutation = useMutation({
    mutationFn: () => api.adminGetSubscription(inputChatId.trim()),
    onSuccess: (data) => { setResult(data); setChatId(inputChatId.trim()); },
    onError: () => showToast('Ошибка загрузки', false),
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, days }: { action: string; days?: number }) =>
      api.adminPatchSubscription(chatId, action, days),
    onSuccess: () => {
      showToast('Применено');
      lookupMutation.mutate();
    },
    onError: () => showToast('Ошибка', false),
  });

  const ACTIONS = [
    { key: 'trial',   label: 'Триал',         desc: `+${extendDays}д`, danger: false },
    { key: 'monthly', label: 'Ежемесячная',   desc: `+${extendDays}д`, danger: false },
    { key: 'extend',  label: 'Продлить',       desc: `+${extendDays}д`, danger: false },
    { key: 'cancel',  label: 'Отменить',       desc: 'canceled',        danger: true  },
    { key: 'expire',  label: 'Истекла',        desc: 'expired',         danger: true  },
  ] as const;

  return (
    <div className="screen">
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ← Назад
      </button>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 20 }}>
        Подписки
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={inputChatId}
          onChange={e => setInputChatId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && inputChatId.trim() && lookupMutation.mutate()}
          placeholder="Chat ID пользователя"
          style={{
            flex: 1, padding: '11px 14px', fontSize: 14, borderRadius: 10,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => inputChatId.trim() && lookupMutation.mutate()}
          disabled={lookupMutation.isPending || !inputChatId.trim()}
          className="btn"
          style={{ flexShrink: 0, fontSize: 14 }}
        >
          {lookupMutation.isPending ? '...' : 'Найти'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.5 }}>
            chatId: <span style={{ color: 'var(--text-2)' }}>{result.chatId}</span>
            {result.userId && <><br />userId: <span style={{ color: 'var(--text-2)' }}>{result.userId}</span></>}
          </div>

          {result.legacySub
            ? <SubBlock label="Legacy (chatId)" sub={result.legacySub} />
            : <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8, fontStyle: 'italic' }}>Legacy-подписки нет</div>
          }

          {result.userSub
            ? <SubBlock label="UserSubscription (userId)" sub={result.userSub} />
            : result.userId
              ? <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8, fontStyle: 'italic' }}>UserSubscription ещё не создана</div>
              : null
          }

          {/* Actions */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', margin: '16px 0 10px' }}>
            Действия
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Дней:</span>
            <input
              type="number"
              value={extendDays}
              onChange={e => setExtendDays(e.target.value)}
              min={1} max={365}
              style={{
                width: 64, padding: '7px 10px', fontSize: 14, borderRadius: 8,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text)', outline: 'none', textAlign: 'center',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ACTIONS.map(a => (
              <button
                key={a.key}
                disabled={actionMutation.isPending}
                onClick={() => actionMutation.mutate({ action: a.key, days: Number(extendDays) || 30 })}
                style={{
                  padding: '9px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10,
                  cursor: 'pointer',
                  background: a.danger ? 'rgba(255,59,48,0.10)' : 'var(--accent-soft)',
                  border: a.danger ? '1px solid rgba(255,59,48,0.25)' : '1px solid transparent',
                  color: a.danger ? 'var(--danger)' : 'var(--accent)',
                }}
              >
                {a.label}
                <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 5 }}>{a.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? 'var(--accent)' : 'var(--danger)',
          color: toast.ok ? '#000' : '#fff',
          fontWeight: 700, padding: '10px 22px', borderRadius: 24, fontSize: 14,
          zIndex: 999, whiteSpace: 'nowrap',
        }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
