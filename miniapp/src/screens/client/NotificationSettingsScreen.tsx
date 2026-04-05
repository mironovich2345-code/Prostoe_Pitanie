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
};

export default function NotificationSettingsScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['reminders'], queryFn: api.reminders });
  const reminders = data?.reminders ?? [];

  const mealReminders = reminders.filter(r => r.mealType !== 'weight');
  const weightReminders = reminders.filter(r => r.mealType === 'weight');
  const canAddMeal = mealReminders.length < 5;
  const canAddWeight = weightReminders.length < 2;

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
            onClick={() => canAddMeal && navigate('/notifications/new')}
            style={{
              background: 'none', border: 'none',
              fontSize: 28, lineHeight: 1, padding: '0 2px',
              color: canAddMeal ? 'var(--accent)' : 'var(--text-3)',
              cursor: canAddMeal ? 'pointer' : 'default',
            }}
          >+</button>
        }
      />

      {isLoading ? (
        <div className="card"><div style={{ color: 'var(--text-3)', fontSize: 14 }}>Загружаем...</div></div>
      ) : (
        <>
          {/* Section label for meals */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 10 }}>
            Приёмы пищи
          </div>

          {mealReminders.length === 0 ? (
            <div className="empty-state" style={{ marginBottom: 0 }}>
              <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', opacity: 0.3 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
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
              {mealReminders.map((r: MealReminder, i: number) => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  label={MEAL_LABELS[r.mealType as ReminderMealType] ?? r.mealType}
                  isLast={i === mealReminders.length - 1}
                  toggling={toggleMutation.isPending}
                  onTap={() => navigate(`/notifications/${r.id}`)}
                  onToggle={val => toggleMutation.mutate({ id: r.id, enabled: val })}
                />
              ))}
            </div>
          )}

          {!canAddMeal && mealReminders.length > 0 && (
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>
              Максимум 5 напоминаний
            </p>
          )}

          {/* Weight reminders section */}
          <div style={{ marginTop: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)' }}>
                Замер веса
              </div>
              <button
                onClick={() => canAddWeight && navigate('/notifications/weight/new')}
                style={{
                  background: 'none', border: 'none',
                  fontSize: 28, lineHeight: 1, padding: '0 2px',
                  color: canAddWeight ? 'var(--accent)' : 'var(--text-3)',
                  cursor: canAddWeight ? 'pointer' : 'default',
                }}
              >+</button>
            </div>

            {weightReminders.length === 0 ? (
              <div style={{
                background: 'var(--surface)', borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)', padding: '18px 16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  Добавь напоминание о взвешивании
                </div>
              </div>
            ) : (
              <div style={{
                background: 'var(--surface)', borderRadius: 'var(--r-lg)',
                overflow: 'hidden', border: '1px solid var(--border)',
              }}>
                {weightReminders.map((r, i) => (
                  <WeightReminderRow
                    key={r.id}
                    reminder={r}
                    isLast={i === weightReminders.length - 1}
                    toggling={toggleMutation.isPending}
                    onTap={() => navigate(`/notifications/weight/${r.id}`)}
                    onToggle={val => toggleMutation.mutate({ id: r.id, enabled: val })}
                  />
                ))}
              </div>
            )}

            {!canAddWeight && weightReminders.length > 0 && (
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>
                Максимум 2 напоминания о замере
              </p>
            )}
          </div>
        </>
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

const DOW_LABELS_SHORT: Record<string, string> = {
  mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс',
};

function WeightReminderRow({
  reminder, isLast, toggling, onTap, onToggle,
}: {
  reminder: import('../../types').MealReminder;
  isLast: boolean;
  toggling: boolean;
  onTap: () => void;
  onToggle: (v: boolean) => void;
}) {
  const dowLabel = reminder.dayOfWeek ? DOW_LABELS_SHORT[reminder.dayOfWeek] ?? reminder.dayOfWeek : '—';
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
          {dowLabel}
        </div>
      </div>
      <div onClick={e => { e.stopPropagation(); onToggle(!reminder.enabled); }}>
        <Toggle enabled={reminder.enabled} pending={toggling} onChange={onToggle} />
      </div>
    </div>
  );
}
