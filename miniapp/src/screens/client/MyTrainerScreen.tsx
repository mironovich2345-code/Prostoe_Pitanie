import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BootstrapData } from '../../types';

interface Props { bootstrap: BootstrapData; }

export default function MyTrainerScreen({ bootstrap }: Props) {
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

  const isPending = disconnectMutation.isPending || historyMutation.isPending;

  function handleDisconnect() {
    if (!confirm('Отключить тренера? Тренер потеряет доступ к вашим данным.')) return;
    disconnectMutation.mutate();
  }

  return (
    <div className="screen">
      <h1 style={{ marginBottom: 16 }}>🏋 Мой тренер</h1>
      {trainer ? (
        <>
          <div className="card">
            <div className="card-title">Подключён тренер</div>
            <div className="stat-row">
              <span className="stat-label">Тренер</span>
              <span className="stat-value">{trainer.name ?? `ID: ${trainer.trainerId}`}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Дата подключения</span>
              <span className="stat-value">{new Date(trainer.connectedAt).toLocaleDateString('ru-RU')}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Доступ к истории</span>
              <span className="stat-value">{trainer.fullHistoryAccess ? 'Полный ✅' : 'С момента подключения'}</span>
            </div>
          </div>

          {(disconnectMutation.isError || historyMutation.isError) && (
            <div style={{ color: '#dc3545', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
              Ошибка. Попробуйте ещё раз.
            </div>
          )}

          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trainer.fullHistoryAccess ? (
              <button
                className="btn btn-secondary"
                onClick={() => historyMutation.mutate(false)}
                disabled={isPending}
              >
                {historyMutation.isPending ? 'Сохраняем...' : '📂 Отозвать полный доступ к истории'}
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={() => historyMutation.mutate(true)}
                disabled={isPending}
              >
                {historyMutation.isPending ? 'Сохраняем...' : '📂 Дать полный доступ к истории'}
              </button>
            )}
            <button
              className="btn btn-danger"
              onClick={handleDisconnect}
              disabled={isPending}
            >
              {disconnectMutation.isPending ? 'Отключаем...' : 'Отключить тренера'}
            </button>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🏋</div>
          <div style={{ marginBottom: 16 }}>Тренер не подключён</div>
          <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>
            Чтобы подключить тренера, передайте ему свой chatId: <strong>{bootstrap.chatId}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
