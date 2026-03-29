import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ReminderMealType } from '../../types';

const MEAL_OPTIONS: { value: ReminderMealType; label: string }[] = [
  { value: 'breakfast', label: 'Завтрак' },
  { value: 'lunch', label: 'Обед' },
  { value: 'dinner', label: 'Ужин' },
  { value: 'snack', label: 'Перекус' },
  { value: 'extra', label: 'Дополнительное' },
];

export default function ReminderEditScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const numericId = isNew ? null : parseInt(id ?? '', 10);
  const qc = useQueryClient();

  const { data: listData, isLoading } = useQuery({ queryKey: ['reminders'], queryFn: api.reminders });
  const reminders = listData?.reminders ?? [];
  const existing = numericId != null ? (reminders.find(r => r.id === numericId) ?? null) : null;

  // Types already used by OTHER reminders (not the one being edited)
  const usedTypes = new Set(reminders.filter(r => r.id !== existing?.id).map(r => r.mealType));

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

  // Pass all needed values as explicit mutation arguments so react-query v5
  // captures them at call time, not at async-execution time via stale closure.
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

  // Show spinner while loading in edit mode
  if (isLoading && !isNew) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  // In edit mode, if the reminder doesn't exist in loaded data — go back
  if (!isNew && !isLoading && !existing) {
    return (
      <div className="screen">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => navigate('/notifications')}
            style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--tg-theme-button-color, #007aff)', cursor: 'pointer' }}
          >‹</button>
          <h1 style={{ margin: 0, fontSize: 20 }}>Напоминание не найдено</h1>
        </div>
        <button className="btn" onClick={() => navigate('/notifications')}>← Назад</button>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/notifications')}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--tg-theme-button-color, #007aff)', cursor: 'pointer' }}
        >‹</button>
        <h1 style={{ margin: 0, fontSize: 20 }}>{isNew ? 'Новое напоминание' : 'Редактировать'}</h1>
      </div>

      {/* Time picker */}
      <div className="card">
        <div className="card-title">Время</div>
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          style={{
            fontSize: 42, fontWeight: 200, letterSpacing: -2,
            border: 'none', background: 'transparent',
            color: 'var(--tg-theme-text-color, #000)',
            outline: 'none', width: '100%', padding: '4px 0',
          }}
        />
      </div>

      {/* Meal type selector */}
      <div className="card">
        <div className="card-title">Название</div>
        {MEAL_OPTIONS.map(opt => {
          const blocked = usedTypes.has(opt.value);
          const selected = mealType === opt.value;
          const clickable = isNew ? !blocked : selected;
          return (
            <button
              key={opt.value}
              onClick={() => isNew && !blocked && setMealType(opt.value)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '11px 12px', border: 'none', borderRadius: 8,
                background: selected ? 'var(--tg-theme-button-color, #007aff)' : 'none',
                color: selected ? '#fff' : blocked ? 'var(--tg-theme-hint-color, #8e8e93)' : 'var(--tg-theme-text-color, #000)',
                fontSize: 15, marginBottom: 2, textAlign: 'left',
                cursor: clickable ? 'pointer' : 'default',
              }}
            >
              <span>{opt.label}</span>
              {selected && <span>✓</span>}
              {!selected && blocked && isNew && <span style={{ fontSize: 12 }}>уже есть</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ color: '#dc3545', fontSize: 14, marginBottom: 12, padding: '8px 12px', background: 'rgba(220,53,69,0.1)', borderRadius: 8 }}>
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
