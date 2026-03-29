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
  const qc = useQueryClient();

  const { data: listData, isLoading } = useQuery({ queryKey: ['reminders'], queryFn: api.reminders });
  const reminders = listData?.reminders ?? [];
  const existing = !isNew ? reminders.find(r => r.id === parseInt(id!, 10)) : null;

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

  const createMutation = useMutation({
    mutationFn: () => api.createReminder({ mealType, time }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); navigate('/notifications'); },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patchReminder(existing!.id, { time }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); navigate('/notifications'); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteReminder(existing!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); navigate('/notifications'); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const error = (createMutation.error ?? updateMutation.error ?? deleteMutation.error)?.message;

  if (isLoading && !isNew) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  function handleSave() {
    if (isNew) createMutation.mutate();
    else updateMutation.mutate();
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
          // In edit mode, mealType is fixed — only show selected, rest dimmed
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

      {!isNew && (
        <button
          className="btn btn-danger"
          onClick={() => deleteMutation.mutate()}
          disabled={isPending}
        >
          {deleteMutation.isPending ? 'Удаляем...' : 'Удалить напоминание'}
        </button>
      )}
    </div>
  );
}
