import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { MealReminder, ReminderMealType } from '../../types';

const MEAL_LABELS: Record<ReminderMealType, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
  extra: 'Дополнительное',
};

export default function NotificationSettingsScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['reminders'], queryFn: api.reminders });
  const reminders = data?.reminders ?? [];
  const canAdd = reminders.length < 5;

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.patchReminder(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  });

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/profile')}
            style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--tg-theme-button-color, #007aff)', cursor: 'pointer' }}
          >‹</button>
          <h1 style={{ margin: 0 }}>🔔 Уведомления</h1>
        </div>
        <button
          onClick={() => canAdd && navigate('/notifications/new')}
          style={{
            background: 'none', border: 'none', fontSize: 28, lineHeight: 1, padding: '0 2px',
            color: canAdd ? 'var(--tg-theme-button-color, #007aff)' : 'var(--tg-theme-hint-color, #8e8e93)',
            cursor: canAdd ? 'pointer' : 'default',
          }}
        >+</button>
      </div>

      {isLoading ? (
        <div className="card">
          <div style={{ color: 'var(--tg-theme-hint-color)' }}>Загружаем...</div>
        </div>
      ) : reminders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <div style={{ marginBottom: 16 }}>Нет напоминаний</div>
          <button className="btn" style={{ width: 'auto', padding: '10px 24px' }} onClick={() => navigate('/notifications/new')}>
            Добавить
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {reminders.map((r: MealReminder, i: number) => (
            <ReminderRow
              key={r.id}
              reminder={r}
              label={MEAL_LABELS[r.mealType as ReminderMealType] ?? r.mealType}
              isLast={i === reminders.length - 1}
              toggling={toggleMutation.isPending}
              onTap={() => navigate(`/notifications/${r.id}`)}
              onToggle={(val) => toggleMutation.mutate({ id: r.id, enabled: val })}
            />
          ))}
        </div>
      )}

      {!canAdd && reminders.length > 0 && (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 12 }}>
          Максимум 5 напоминаний — по одному на каждый тип приёма пищи
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
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.06)',
        opacity: reminder.enabled ? 1 : 0.45,
        cursor: 'pointer',
      }}
      onClick={onTap}
    >
      <div>
        <div style={{ fontSize: 36, fontWeight: 200, letterSpacing: -1, lineHeight: 1.05, color: 'var(--tg-theme-text-color, #000)' }}>
          {reminder.time}
        </div>
        <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: 3 }}>
          {label}
        </div>
      </div>
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(!reminder.enabled); }}
        style={{
          flexShrink: 0,
          width: 51, height: 31, borderRadius: 31, padding: 2,
          background: reminder.enabled ? 'var(--tg-theme-button-color, #34c759)' : 'rgba(120,120,128,0.32)',
          display: 'flex', alignItems: 'center',
          justifyContent: reminder.enabled ? 'flex-end' : 'flex-start',
          cursor: toggling ? 'default' : 'pointer',
          transition: 'background 0.2s, justify-content 0s',
        }}
      >
        <div style={{ width: 27, height: 27, borderRadius: 27, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
      </div>
    </div>
  );
}
