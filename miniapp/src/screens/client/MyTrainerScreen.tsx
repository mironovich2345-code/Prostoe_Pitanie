import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { BootstrapData, TrainerRating } from '../../types';

interface Props { bootstrap: BootstrapData; }

const RATING_LABELS: Record<string, { label: string; color: string }> = {
  excellent: { label: '⭐ Отлично',    color: 'var(--accent)' },
  good:      { label: '👍 Хорошо',     color: '#7EB8F0' },
  ok:        { label: '👌 Нормально',  color: 'var(--text-2)' },
  improve:   { label: '↗️ Улучшить',   color: 'var(--warn)' },
};

export default function MyTrainerScreen({ bootstrap }: Props) {
  const navigate = useNavigate();
  const trainer = bootstrap.connectedTrainer;
  const qc = useQueryClient();

  const disconnectMutation = useMutation({
    mutationFn: api.disconnectTrainer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bootstrap'] }),
  });

  const historyMutation = useMutation({
    mutationFn: (fullAccess: boolean) => api.setTrainerHistoryAccess(fullAccess),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bootstrap'] }),
  });

  const { data: ratingsData } = useQuery({
    queryKey: ['my-ratings'],
    queryFn: api.myRatings,
    enabled: !!trainer,
  });

  const isPending = disconnectMutation.isPending || historyMutation.isPending;
  const recentRatings = (ratingsData?.ratings ?? []).slice(0, 5) as TrainerRating[];

  function handleDisconnect() {
    if (!confirm('Отключить тренера? Тренер потеряет доступ к вашим данным.')) return;
    disconnectMutation.mutate();
  }

  if (!trainer) {
    return (
      <div className="screen">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}>‹</button>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Мой тренер</div>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 16px' }}>
          <div style={{ fontSize: 56, opacity: 0.2, marginBottom: 16 }}>🏋</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Тренер не подключён</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.55, marginBottom: 28, maxWidth: 260, margin: '0 auto 28px' }}>
            Подключи персонального тренера — он будет видеть твой дневник и оценивать питание
          </div>
          <button className="btn" style={{ width: 'auto', padding: '13px 32px', display: 'inline-block', fontSize: 15 }} onClick={() => navigate('/connect-trainer')}>
            Подключить тренера
          </button>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden', marginTop: 16 }}>
          {[
            { icon: '📊', label: 'Тренер видит твою статистику питания' },
            { icon: '⭐', label: 'Получай оценки от тренера по каждому приёму' },
            { icon: '🔒', label: 'Ты сам выбираешь, какие данные доступны' },
          ].map((item, i, arr) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const connectedDate = new Date(trainer.connectedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}>‹</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Мой тренер</div>
      </div>

      {/* Trainer card */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: 20, border: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: 'var(--accent-soft)', border: '2px solid rgba(215,255,63,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
            {trainer.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{trainer.name ?? 'Тренер'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Подключён с {connectedDate}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'var(--accent-soft)', color: 'var(--accent)' }}>Активен</span>
        </div>

        {/* Access rights */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8 }}>
          Права доступа
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            trainer.fullHistoryAccess ? '📂 Вся история' : '📅 С момента подключения',
            trainer.canViewPhotos ? '📷 Видит фото' : '🚫 Без фото',
            '📊 Нормы и метрики',
          ].map(tag => (
            <div key={tag} style={{ background: 'var(--surface-2)', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              {tag}
            </div>
          ))}
        </div>

        <button
          className="btn btn-secondary"
          style={{ fontSize: 13 }}
          disabled={isPending}
          onClick={() => historyMutation.mutate(!trainer.fullHistoryAccess)}
        >
          {historyMutation.isPending ? 'Сохраняем...' : trainer.fullHistoryAccess ? '📅 Ограничить историю' : '📂 Дать полный доступ к истории'}
        </button>
      </div>

      {/* Recent ratings */}
      {recentRatings.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '8px 2px 10px' }}>
            Оценки тренера
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
            {recentRatings.map((r, i) => {
              const meta = RATING_LABELS[r.rating] ?? { label: r.rating, color: 'var(--text-2)' };
              const dateLabel = new Date(r.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < recentRatings.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {r.targetType === 'day' ? `День ${r.targetId}` : `Приём #${r.targetId}`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{dateLabel}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {(disconnectMutation.isError || historyMutation.isError) && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>Ошибка. Попробуйте ещё раз.</div>
      )}

      <button
        className="btn btn-secondary"
        style={{ fontSize: 14 }}
        disabled={isPending}
        onClick={handleDisconnect}
      >
        {disconnectMutation.isPending ? 'Отключаем...' : 'Отключить тренера'}
      </button>
    </div>
  );
}
