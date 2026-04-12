import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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

function ResultView({ data, onManageSub }: { data: LookupResult; onManageSub: (chatId: string) => void }) {
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
            <Row label="Триал до" value={fmtDate(subscription.trialEndsAt)} />
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>Нет подписки</div>
        )}
        {chatId && (
          <button
            onClick={() => onManageSub(chatId)}
            style={{
              marginTop: 10, width: '100%', padding: '8px', fontSize: 12, fontWeight: 600,
              borderRadius: 8, background: 'var(--accent-soft)', border: 'none',
              color: 'var(--accent)', cursor: 'pointer',
            }}
          >
            Управлять подпиской →
          </button>
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
    </>
  );
}

export default function AdminUserSearchScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);

  const lookupMutation = useMutation({
    mutationFn: () => api.adminUserLookup(query.trim()),
    onSuccess: (data) => setResult(data),
  });

  function handleSearch() {
    if (!query.trim()) return;
    lookupMutation.mutate();
  }

  return (
    <div className="screen">
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ← Назад
      </button>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 6 }}>
        Поиск пользователя
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
        Введите Chat ID или @username
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="123456789 или @username"
          style={{
            flex: 1, padding: '11px 14px', fontSize: 14, borderRadius: 10,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={lookupMutation.isPending || !query.trim()}
          className="btn"
          style={{ flexShrink: 0, fontSize: 14 }}
        >
          {lookupMutation.isPending ? '...' : 'Найти'}
        </button>
      </div>

      {lookupMutation.isError && (
        <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>Ошибка запроса</div>
      )}

      {result && (
        <ResultView
          data={result}
          onManageSub={(chatId) => navigate('/subscriptions', { state: { prefillChatId: chatId } })}
        />
      )}
    </div>
  );
}
