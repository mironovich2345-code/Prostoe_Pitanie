import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { PageHeader } from '../../ui';

const DOW_OPTIONS: { value: string; label: string }[] = [
  { value: 'mon', label: 'Пн' },
  { value: 'tue', label: 'Вт' },
  { value: 'wed', label: 'Ср' },
  { value: 'thu', label: 'Чт' },
  { value: 'fri', label: 'Пт' },
  { value: 'sat', label: 'Сб' },
  { value: 'sun', label: 'Вс' },
];

export default function WeightReminderEditScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const numericId = isNew ? null : Number(id);
  const qc = useQueryClient();

  const { data: listData, isLoading } = useQuery({ queryKey: ['reminders'], queryFn: api.reminders });
  const reminders = listData?.reminders ?? [];
  const existing = numericId != null && !isNaN(numericId)
    ? (reminders.find(r => r.id === numericId) ?? null)
    : null;

  const [time, setTime] = useState('08:00');
  const [dayOfWeek, setDayOfWeek] = useState('mon');
  const [initialized, setInitialized] = useState(isNew);

  useEffect(() => {
    if (!initialized && existing) {
      setTime(existing.time);
      if (existing.dayOfWeek) setDayOfWeek(existing.dayOfWeek);
      setInitialized(true);
    }
  }, [existing, initialized]);

  const createMutation = useMutation({
    mutationFn: () => api.createReminder({ mealType: 'weight', time, dayOfWeek }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); navigate('/notifications'); },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patchReminder(existing!.id, { time, dayOfWeek }),
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

  if (!isNew && !isLoading && existing === null) {
    return (
      <div className="screen">
        <PageHeader title="Замер веса" onBack={() => navigate('/notifications')} />
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '28px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>Напоминание не найдено</div>
          <button className="btn" style={{ width: 'auto', padding: '10px 28px' }} onClick={() => navigate('/notifications')}>Назад</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <PageHeader
        title={isNew ? 'Замер веса' : 'Редактировать'}
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
            color: 'var(--text)', outline: 'none', width: '100%', padding: '4px 0',
          }}
        />
      </div>

      {/* Day of week selector */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
        padding: '16px 18px', marginBottom: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 12 }}>
          День недели
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {DOW_OPTIONS.map(opt => {
            const selected = dayOfWeek === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setDayOfWeek(opt.value)}
                style={{
                  padding: '10px 4px',
                  borderRadius: 10,
                  border: selected ? '1.5px solid rgba(215,255,63,0.35)' : '1px solid var(--border)',
                  background: selected ? 'var(--accent-soft)' : 'var(--surface-2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                <div style={{
                  fontSize: 13, fontWeight: selected ? 700 : 500,
                  color: selected ? 'var(--accent)' : 'var(--text-2)',
                }}>
                  {opt.label}
                </div>
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

      <button
        className="btn"
        onClick={() => isNew ? createMutation.mutate() : updateMutation.mutate()}
        disabled={isPending}
        style={{ marginBottom: 8 }}
      >
        {isPending && !deleteMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
      </button>

      {!isNew && existing && (
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
