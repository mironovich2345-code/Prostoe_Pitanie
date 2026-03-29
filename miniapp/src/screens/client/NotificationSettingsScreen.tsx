import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { PageHeader, Toggle } from '../../ui';
import type { MealReminder, ReminderMealType } from '../../types';

const MEAL_LABELS: Record<ReminderMealType, string> = {
  breakfast: 'Завтрак',
  lunch:     'Обед',
  dinner:    'Ужин',
  snack:     'Перекус',
  extra:     'Дополнительное',
};

export default function NotificationSettingsScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['reminders'], queryFn: api.reminders });
  const reminders = data?.reminders ?? [];
  const canAdd = reminders.length < 5;

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => api.patchReminder(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  });

  return (
    <div className="screen">
      <PageHeader
        title="Уведомления"
        onBack={() => navigate('/profile')}
        right={
          <button
            onClick={() => canAdd && navigate('/notifications/new')}
            style={{
              background: 'none', border: 'none',
              fontSize: 28, lineHeight: 1, padding: '0 2px',
              color: canAdd ? 'var(--accent)' : 'var(--text-3)',
              cursor: canAdd ? 'pointer' : 'default',
            }}
          >+</button>
        }
      />

      {isLoading ? (
        <div className="card"><div style={{ color: 'var(--text-3)', fontSize: 14 }}>Загружаем...</div></div>
      ) : reminders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Нет напоминаний</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Добавь первое напоминание о приёме пищи</div>
          <button
            className="btn"
            style={{ width: 'auto', padding: '10px 28px' }}
            onClick={() => navigate('/notifications/new')}
          >
            Добавить
          </button>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--r-lg)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            marginBottom: 10,
          }}
        >
          {reminders.map((r: MealReminder, i: number) => (
            <ReminderRow
              key={r.id}
              reminder={r}
              label={MEAL_LABELS[r.mealType as ReminderMealType] ?? r.mealType}
              isLast={i === reminders.length - 1}
              toggling={toggleMutation.isPending}
              onTap={() => navigate(`/notifications/${r.id}`)}
              onToggle={val => toggleMutation.mutate({ id: r.id, enabled: val })}
            />
          ))}
        </div>
      )}

      {!canAdd && reminders.length > 0 && (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>
          Максимум 5 напоминаний
        </p>
      )}
    </div>
  );
}

function ReminderRow({
  reminder, label, isLast, toggling, onTap, onToggle,
}: {
  reminder: MealReminder;
  label: string;
  isLast: boolean;
  toggling: boolean;
  onTap: () => void;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        opacity: reminder.enabled ? 1 : 0.38,
        cursor: 'pointer',
        transition: 'opacity 0.15s',
      }}
    >
      <div>
        <div style={{ fontSize: 36, fontWeight: 200, letterSpacing: -1.5, lineHeight: 1.05, color: 'var(--text)' }}>
          {reminder.time}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4, fontWeight: 500 }}>
          {label}
        </div>
      </div>
      <div onClick={e => { e.stopPropagation(); onToggle(!reminder.enabled); }}>
        <Toggle enabled={reminder.enabled} pending={toggling} onChange={onToggle} />
      </div>
    </div>
  );
}
