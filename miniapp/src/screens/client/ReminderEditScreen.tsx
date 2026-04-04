import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { PageHeader } from '../../ui';
import type { ReminderMealType } from '../../types';

const MEAL_OPTIONS: { value: ReminderMealType; label: string }[] = [
  { value: 'breakfast', label: 'Завтрак' },
  { value: 'lunch',     label: 'Обед'    },
  { value: 'dinner',    label: 'Ужин'    },
  { value: 'snack',     label: 'Перекус' },
];

/** Max allowed per type: 2 for snack, 1 for others */
const MAX_PER_TYPE: Record<ReminderMealType, number> = {
  breakfast: 1,
  lunch: 1,
  dinner: 1,
  snack: 2,
};

export default function ReminderEditScreen() {
  const navigate = useNavigate();
  // Route is always /notifications/:id
  // id === 'new' → create mode; id is a numeric string → edit mode
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const numericId = isNew ? null : Number(id);
  const qc = useQueryClient();

  const { data: listData, isLoading } = useQuery({ queryKey: ['reminders'], queryFn: api.reminders });
  const reminders = listData?.reminders ?? [];
  const existing = numericId != null && !isNaN(numericId)
    ? (reminders.find(r => r.id === numericId) ?? null)
    : null;

  // Count of each type excluding the reminder being edited
  const typeCounts = reminders
    .filter(r => r.id !== existing?.id)
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.mealType] = (acc[r.mealType] ?? 0) + 1;
      return acc;
    }, {});

  const isTypeBlocked = (type: ReminderMealType) => {
    const count = typeCounts[type] ?? 0;
    return count >= (MAX_PER_TYPE[type] ?? 1);
  };

  const [time, setTime] = useState('08:00');
  const [mealType, setMealType] = useState<ReminderMealType>('breakfast');
  const [initialized, setInitialized] = useState(isNew);

  useEffect(() => {
    if (!initialized && existing) {
      setTime(existing.time);
      setMealType(existing.mealType as ReminderMealType);
      setInitialized(true);
    }
  }, [existing, initialized]);

  const createMutation = useMutation({
    mutationFn: ({ mealType, time }: { mealType: string; time: string }) =>
      api.createReminder({ mealType, time }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); navigate('/notifications'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ reminderId, time }: { reminderId: number; time: string }) =>
      api.patchReminder(reminderId, { time }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); navigate('/notifications'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (reminderId: number) => api.deleteReminder(reminderId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); navigate('/notifications'); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const error = (createMutation.error ?? updateMutation.error ?? deleteMutation.error)?.message;

  // Loading spinner in edit mode while reminders are being fetched
  if (isLoading && !isNew) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  // Edit mode: reminder not found after load
  if (!isNew && !isLoading && existing === null) {
    return (
      <div className="screen">
        <PageHeader title="Напоминание" onBack={() => navigate('/notifications')} />
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
          padding: '28px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
            Напоминание не найдено
          </div>
          <button className="btn" style={{ width: 'auto', padding: '10px 28px' }} onClick={() => navigate('/notifications')}>
            Назад
          </button>
        </div>
      </div>
    );
  }

  function handleSave() {
    if (isNew) {
      createMutation.mutate({ mealType, time });
    } else if (existing) {
      updateMutation.mutate({ reminderId: existing.id, time });
    }
  }

  return (
    <div className="screen">
      <PageHeader
        title={isNew ? 'Новое напоминание' : 'Редактировать'}
        onBack={() => navigate('/notifications')}
      />

      {/* Time picker */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
        padding: '16px 18px', marginBottom: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10 }}>
          Время
        </div>
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          style={{
            fontSize: 48, fontWeight: 200, letterSpacing: -2,
            border: 'none', background: 'transparent',
            color: 'var(--text)',
            outline: 'none', width: '100%', padding: '4px 0',
          }}
        />
      </div>

      {/* Meal type selector */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
        padding: '16px 18px', marginBottom: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 12 }}>
          Тип
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {MEAL_OPTIONS.map((opt) => {
            const blocked = isTypeBlocked(opt.value);
            const selected = mealType === opt.value;
            const clickable = isNew && !blocked;
            return (
              <button
                key={opt.value}
                onClick={() => clickable && setMealType(opt.value)}
                style={{
                  padding: '13px 10px 11px',
                  borderRadius: 12,
                  border: selected
                    ? '1.5px solid rgba(215,255,63,0.35)'
                    : '1px solid var(--border)',
                  background: selected ? 'var(--accent-soft)' : 'var(--surface-2)',
                  cursor: clickable ? 'pointer' : 'default',
                  textAlign: 'center',
                  transition: 'background 0.15s, border-color 0.15s',
                  opacity: blocked && !selected ? 0.38 : 1,
                }}
              >
                <div style={{
                  fontSize: 14, fontWeight: selected ? 700 : 500,
                  color: selected ? 'var(--accent)' : blocked ? 'var(--text-3)' : 'var(--text-2)',
                  marginBottom: blocked && !selected && isNew ? 4 : 0,
                }}>
                  {opt.label}
                </div>
                {blocked && !selected && isNew && (
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>
                    уже добавлен
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12, padding: '10px 14px', background: 'rgba(255,87,87,0.1)', borderRadius: 10 }}>
          {error}
        </div>
      )}

      <button className="btn" onClick={handleSave} disabled={isPending} style={{ marginBottom: 8 }}>
        {isPending && !deleteMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
      </button>

      {!isNew && existing && (
        <button
          className="btn btn-danger"
          onClick={() => deleteMutation.mutate(existing.id)}
          disabled={isPending}
        >
          {deleteMutation.isPending ? 'Удаляем...' : 'Удалить напоминание'}
        </button>
      )}
    </div>
  );
}
