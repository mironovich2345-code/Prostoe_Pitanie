interface Props { onBack: () => void; }

export default function TrainerRejectedScreen({ onBack }: Props) {
  return (
    <div className="screen">
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 64 }}>❌</div>
        <h2 style={{ margin: '16px 0 8px' }}>Заявка отклонена</h2>
        <p style={{ color: 'var(--tg-theme-hint-color, #888)', marginBottom: 24 }}>К сожалению, твоя заявка тренера была отклонена. Ты можешь подать повторную заявку позже.</p>
        <button className="btn btn-secondary" onClick={onBack}>Вернуться в режим клиента</button>
      </div>
    </div>
  );
}
