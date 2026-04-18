import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

type LookupResult = Awaited<ReturnType<typeof api.adminUserLookup>>;

const STATUS_COLORS: Record<string, string> = {
  trial:    'var(--accent)',
  active:   '#4CAF50',
  expired:  'var(--danger)',
  canceled: 'var(--danger)',
  past_due: '#F0A07A',
  verified: '#4CAF50',
  pending:  '#F0A07A',
  rejected: 'var(--danger)',
  blocked:  'var(--danger)',
};

const GOAL_LABELS: Record<string, string> = {
  lose: 'Похудение', maintain: 'Поддержание', gain: 'Набор массы', track: 'Контроль',
};

type PlanKey = 'optimal' | 'pro';

const PLAN_DEFS: { key: PlanKey; label: string; desc: string; color: string }[] = [
  { key: 'optimal', label: 'Optimal', desc: '399 ₽/мес',     color: '#7EB8F0' },
  { key: 'pro',     label: 'Pro',     desc: '499 ₽/мес',     color: '#C084FC' },
];

const SUB_ACTIONS_DANGER = [
  { key: 'cancel', label: 'Отменить подписку' },
  { key: 'expire', label: 'Пометить истёкшей' },
] as const;

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 13, marginBottom: 5, gap: 8 }}>
      <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-2)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

interface ResultViewProps {
  data: LookupResult;
  extendDays: string;
  setExtendDays: (v: string) => void;
  selectedPlan: PlanKey;
  setSelectedPlan: (p: PlanKey) => void;
  onAction: (chatId: string, action: string) => void;
  actionPending: boolean;
}

function ResultView({ data, extendDays, setExtendDays, selectedPlan, setSelectedPlan, onAction, actionPending }: ResultViewProps) {
  const aiCostKey = data.found ? (data.userId ?? data.chatId ?? null) : null;
  const { data: aiCost } = useQuery({
    queryKey: ['admin-ai-cost-user', aiCostKey],
    queryFn: () => api.adminAiCostByUser(aiCostKey!),
    enabled: !!aiCostKey,
  });

  if (!data.found) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)', fontSize: 14 }}>
        Пользователь не найден
      </div>
    );
  }

  const { chatId, userId, profile, subscription, trainerProfile, asClient, asTrainer } = data;

  return (
    <>
      <Section title="Идентификаторы">
        <Row label="chatId" value={chatId} />
        <Row label="userId" value={userId ?? '—'} />
        {profile?.telegramUsername && <Row label="username" value={`@${profile.telegramUsername}`} />}
        <Row label="Зарегистрирован" value={fmtDate(profile?.createdAt)} />
      </Section>

      <Section title="Профиль">
        <Row label="Имя" value={profile?.preferredName || '—'} />
        <Row label="Цель" value={profile?.goalType ? (GOAL_LABELS[profile.goalType] ?? profile.goalType) : '—'} />
        <Row label="Вес" value={profile?.currentWeightKg ? `${profile.currentWeightKg} кг` : '—'} />
        <Row label="Норма" value={profile?.dailyCaloriesKcal ? `${profile.dailyCaloriesKcal} ккал` : '—'} />
      </Section>

      <Section title="Подписка">
        {subscription ? (
          <>
            <Row label="Plan" value={subscription.planId} />
            <Row
              label="Статус"
              value={<span style={{ color: STATUS_COLORS[subscription.status] ?? 'var(--text-2)', fontWeight: 700 }}>{subscription.status}</span>}
            />
            <Row label="Период до" value={fmtDate(subscription.currentPeriodEnd)} />
            <Row label="Intro до" value={fmtDate(subscription.trialEndsAt)} />
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 8 }}>Нет подписки</div>
        )}

        {chatId && (
          <>
            <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />

            {/* Plan selector */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Тариф
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {PLAN_DEFS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPlan(p.key)}
                    style={{
                      padding: '9px 6px', borderRadius: 10, cursor: 'pointer',
                      border: selectedPlan === p.key ? `1.5px solid ${p.color}` : '1px solid var(--border)',
                      background: selectedPlan === p.key ? `${p.color}18` : 'var(--surface-2)',
                      textAlign: 'center', lineHeight: 1.3,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: selectedPlan === p.key ? p.color : 'var(--text-2)' }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Days input */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
                Срок в днях — для Pro Intro рекомендуется 3:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  value={extendDays}
                  onChange={e => setExtendDays(e.target.value)}
                  min={1} max={365}
                  style={{
                    width: 72, padding: '8px 10px', fontSize: 15, borderRadius: 8,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    color: 'var(--text)', outline: 'none', textAlign: 'center', fontWeight: 600,
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>дней</span>
              </div>
            </div>

            {/* Activate actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <button
                disabled={actionPending || selectedPlan !== 'pro'}
                onClick={() => onAction(chatId, 'trial')}
                style={{
                  padding: '11px 8px', fontSize: 13, fontWeight: 600, borderRadius: 10,
                  cursor: (actionPending || selectedPlan !== 'pro') ? 'default' : 'pointer',
                  opacity: (actionPending || selectedPlan !== 'pro') ? 0.4 : 1,
                  background: 'var(--accent-soft)', border: '1px solid transparent',
                  color: 'var(--accent)', lineHeight: 1.3,
                }}
              >
                {selectedPlan === 'pro' ? `Pro Intro (${extendDays || '…'} дн.)` : 'Intro — только Pro'}
              </button>
              <button
                disabled={actionPending}
                onClick={() => onAction(chatId, 'monthly')}
                style={{
                  padding: '11px 8px', fontSize: 13, fontWeight: 600, borderRadius: 10,
                  cursor: actionPending ? 'default' : 'pointer',
                  opacity: actionPending ? 0.6 : 1,
                  background: 'var(--accent-soft)', border: '1px solid transparent',
                  color: 'var(--accent)', lineHeight: 1.3,
                }}
              >
                Активировать {PLAN_DEFS.find(p => p.key === selectedPlan)?.label ?? selectedPlan}
              </button>
            </div>
            <button
              disabled={actionPending}
              onClick={() => onAction(chatId, 'extend')}
              style={{
                width: '100%', padding: '11px', fontSize: 13, fontWeight: 600, borderRadius: 10,
                cursor: actionPending ? 'default' : 'pointer',
                opacity: actionPending ? 0.6 : 1,
                background: 'var(--accent-soft)', border: '1px solid transparent',
                color: 'var(--accent)', marginBottom: 8,
              }}
            >
              Продлить на {extendDays || '…'} дней
            </button>

            {/* Danger actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {SUB_ACTIONS_DANGER.map(a => (
                <button
                  key={a.key}
                  disabled={actionPending}
                  onClick={() => onAction(chatId, a.key)}
                  style={{
                    padding: '11px 8px', fontSize: 13, fontWeight: 600, borderRadius: 10,
                    cursor: actionPending ? 'default' : 'pointer',
                    opacity: actionPending ? 0.6 : 1,
                    background: 'rgba(255,59,48,0.10)', border: '1px solid rgba(255,59,48,0.25)',
                    color: 'var(--danger)', lineHeight: 1.3,
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}
      </Section>

      {trainerProfile && (
        <Section title="Эксперт / тренер">
          <Row label="Имя" value={trainerProfile.fullName || '—'} />
          <Row label="Специализация" value={trainerProfile.specialization || '—'} />
          <Row
            label="Статус"
            value={<span style={{ color: STATUS_COLORS[trainerProfile.verificationStatus] ?? 'var(--text-2)', fontWeight: 700 }}>{trainerProfile.verificationStatus}</span>}
          />
          <Row label="Подал заявку" value={fmtDate(trainerProfile.appliedAt)} />
          <Row label="Верифицирован" value={fmtDate(trainerProfile.verifiedAt)} />
        </Section>
      )}

      {(asClient && asClient.length > 0) && (
        <Section title={`Подключён к тренеру (${asClient.length})`}>
          {asClient.map(l => (
            <div key={l.trainerId} style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{l.trainerName || l.trainerId}</span>
              <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>с {fmtDate(l.connectedAt)}</span>
            </div>
          ))}
        </Section>
      )}

      {(asTrainer && asTrainer.length > 0) && (
        <Section title={`Клиенты тренера (${asTrainer.length})`}>
          {asTrainer.map(l => (
            <div key={l.clientId} style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{l.clientAlias || l.clientId}</span>
              <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>с {fmtDate(l.connectedAt)}</span>
            </div>
          ))}
        </Section>
      )}

      {aiCost && aiCost.totalRequests > 0 && (
        <Section title="ИИ-расходы">
          <Row label="Всего" value={`$${aiCost.totalCostUsd.toFixed(4)}`} />
          <Row label="Запросов" value={aiCost.totalRequests.toLocaleString('ru')} />
          <Row label="Токенов" value={aiCost.totalTokens.toLocaleString('ru')} />
          {aiCost.byScenario.length > 0 && (
            <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 6 }}>
                По сценариям
              </div>
              {aiCost.byScenario.map(s => (
                <div key={s.scenario} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-2)' }}>{s.scenario}</span>
                  <span style={{ color: 'var(--text-3)' }}>{s.requests} · ${s.costUsd.toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
          {aiCost.recent.length > 0 && (
            <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 6 }}>
                Последние запросы
              </div>
              {aiCost.recent.slice(0, 5).map(r => (
                <div key={r.id} style={{ fontSize: 12, marginBottom: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{r.scenario}</span>
                    <span style={{ color: 'var(--accent)' }}>${r.costUsd.toFixed(4)}</span>
                  </div>
                  <div style={{ color: 'var(--text-3)', marginTop: 1 }}>
                    {r.model} · {r.inputTokens + r.outputTokens} tok · {fmtDate(r.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </>
  );
}

export default function AdminUserSearchScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [extendDays, setExtendDays] = useState('30');
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('pro');
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  function showToast(text: string, ok = true) {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 2800);
  }

  const lookupMutation = useMutation({
    mutationFn: () => api.adminUserLookup(query.trim()),
    onSuccess: (data) => setResult(data),
    onError: () => showToast('Ошибка запроса', false),
  });

  const actionMutation = useMutation({
    mutationFn: ({ chatId, action }: { chatId: string; action: string }) =>
      api.adminPatchSubscription(chatId, action, Number(extendDays) || 30, selectedPlan),
    onSuccess: () => {
      showToast('Применено');
      lookupMutation.mutate();
    },
    onError: () => showToast('Ошибка', false),
  });

  function handleSearch() {
    if (!query.trim()) return;
    lookupMutation.mutate();
  }

  return (
    <div className="screen">
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 6 }}>
        Поиск пользователя
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
        Введите Chat ID или @username
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="123456789 или @username"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', fontSize: 15, borderRadius: 10,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={lookupMutation.isPending || !query.trim()}
          className="btn"
          style={{ width: '100%', fontSize: 15 }}
        >
          {lookupMutation.isPending ? 'Загрузка...' : 'Найти'}
        </button>
      </div>

      {result && (
        <ResultView
          data={result}
          extendDays={extendDays}
          setExtendDays={setExtendDays}
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          onAction={(chatId, action) => actionMutation.mutate({ chatId, action })}
          actionPending={actionMutation.isPending || lookupMutation.isPending}
        />
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
