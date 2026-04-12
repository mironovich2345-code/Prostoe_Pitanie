import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import PaywallCard from '../../components/PaywallCard';
import { PageHeader, Toggle } from '../../ui';
import type { BootstrapData, MealReminder, ReminderMealType, SubscriptionInfo } from '../../types';

const MEAL_LABELS: Record<ReminderMealType, string> = {
  breakfast: 'Завтрак',
  lunch:     'Обед',
  dinner:    'Ужин',
  snack:     'Перекус',
};

function isPremiumTier(sub: SubscriptionInfo | null | undefined): boolean {
  if (!sub) return false;
  return sub.status === 'active' || sub.status === 'trial';
}

export default function NotificationSettingsScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showWeightInfo, setShowWeightInfo] = useState(false);

  const bs = qc.getQueryData<BootstrapData>(['bootstrap']);
  const isPremium = isPremiumTier(bs?.subscription);

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
      <PageHeader title="Уведомления" onBack={() => navigate('/profile')} />

      {!isPremium && (
        <PaywallCard plan="optimal" feature="Редактирование уведомлений" />
      )}

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
                style={{ width: '100%', padding: '13px 0', fontSize: 15 }}
                onClick={() => isPremium ? navigate('/notifications/new') : navigate('/subscription')}
              >
                {isPremium ? 'Добавить' : '🔒 Подключить подписку'}
              </button>
            </div>
          ) : (
            <>
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
                    isLocked={!isPremium}
                    toggling={toggleMutation.isPending}
                    onTap={() => isPremium ? navigate(`/notifications/${r.id}`) : navigate('/subscription')}
                    onToggle={val => isPremium ? toggleMutation.mutate({ id: r.id, enabled: val }) : navigate('/subscription')}
                  />
                ))}
              </div>
              {canAddMeal ? (
                <button
                  onClick={() => isPremium ? navigate('/notifications/new') : navigate('/subscription')}
                  style={{
                    width: '100%', padding: '13px 0', fontSize: 14, fontWeight: 600,
                    borderRadius: 'var(--r-lg)', border: '1px dashed var(--border)',
                    background: 'transparent', color: isPremium ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', marginBottom: 4,
                  }}
                >
                  {isPremium ? '+ Добавить напоминание' : '🔒 Добавить напоминание'}
                </button>
              ) : (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                  Максимум 5 напоминаний
                </p>
              )}
            </>
          )}

          {/* Weight reminders section */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)' }}>
                Замер веса
              </div>
              <button
                onClick={() => setShowWeightInfo(true)}
                style={{
                  background: 'none', border: '1.5px solid var(--text-3)',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, lineHeight: 1, flexShrink: 0,
                }}
                aria-label="Почему только 2 уведомления?"
              >?</button>
            </div>

            {weightReminders.length === 0 ? (
              <div style={{
                background: 'var(--surface)', borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)', padding: '20px 16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Нет напоминаний</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>Добавь напоминание о взвешивании</div>
                <button
                  className="btn"
                  style={{ width: '100%', padding: '13px 0', fontSize: 15 }}
                  onClick={() => isPremium ? navigate('/notifications/weight/new') : navigate('/subscription')}
                >
                  {isPremium ? 'Добавить' : '🔒 Подключить подписку'}
                </button>
              </div>
            ) : (
              <>
                <div style={{
                  background: 'var(--surface)', borderRadius: 'var(--r-lg)',
                  overflow: 'hidden', border: '1px solid var(--border)',
                  marginBottom: 10,
                }}>
                  {weightReminders.map((r, i) => (
                    <WeightReminderRow
                      key={r.id}
                      reminder={r}
                      isLast={i === weightReminders.length - 1}
                      toggling={toggleMutation.isPending}
                      onTap={() => isPremium ? navigate(`/notifications/weight/${r.id}`) : navigate('/subscription')}
                      onToggle={val => isPremium ? toggleMutation.mutate({ id: r.id, enabled: val }) : navigate('/subscription')}
                    />
                  ))}
                </div>
                {canAddWeight ? (
                  <button
                    onClick={() => isPremium ? navigate('/notifications/weight/new') : navigate('/subscription')}
                    style={{
                      width: '100%', padding: '13px 0', fontSize: 14, fontWeight: 600,
                      borderRadius: 'var(--r-lg)', border: '1px dashed var(--border)',
                      background: 'transparent', color: isPremium ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', marginBottom: 4,
                    }}
                  >
                    {isPremium ? '+ Добавить напоминание' : '🔒 Добавить напоминание'}
                  </button>
                ) : (
                  <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                    Максимум 2 напоминания о замере
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}

      {showWeightInfo && (
        <>
          <div
            onClick={() => setShowWeightInfo(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.45)', zIndex: 200,
            }}
          />
          <div className="bottom-sheet">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                Почему только 2 уведомления?
              </div>
              <button
                onClick={() => setShowWeightInfo(false)}
                style={{
                  background: 'none', border: 'none', fontSize: 22,
                  color: 'var(--text-3)', cursor: 'pointer', padding: 0, lineHeight: 1,
                }}
              >×</button>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)', margin: '0 0 12px' }}>
              Слишком частые напоминания о весе могут усиливать тревожность и мешать спокойному контролю.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)', margin: '0 0 12px' }}>
              Обычно достаточно 1–2 напоминаний в неделю — этого хватает, чтобы отслеживать динамику без лишнего стресса.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)', margin: 0 }}>
              Взвешивайся в одно и то же время и в тех же условиях — тогда данные будут точнее и сравнимы между собой.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function ReminderRow({
  reminder, label, isLast, isLocked, toggling, onTap, onToggle,
}: {
  reminder: MealReminder;
  label: string;
  isLast: boolean;
  isLocked?: boolean;
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
        cursor: isLocked ? 'default' : 'pointer',
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
      {isLocked ? (
        <div style={{ fontSize: 18, color: 'var(--text-3)', opacity: 0.5 }}>🔒</div>
      ) : (
        <div onClick={e => { e.stopPropagation(); onToggle(!reminder.enabled); }}>
          <Toggle enabled={reminder.enabled} pending={toggling} onChange={onToggle} />
        </div>
      )}
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
