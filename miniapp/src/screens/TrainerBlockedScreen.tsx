interface Props { onBack: () => void; }

export default function TrainerBlockedScreen({ onBack }: Props) {
  return (
    <div className="screen">
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 64 }}>🚫</div>
        <h2 style={{ margin: '16px 0 8px' }}>Доступ заблокирован</h2>
        <p style={{ color: 'var(--text-2)', marginBottom: 24 }}>Тренерский аккаунт заблокирован. Обратись в поддержку.</p>
        <button className="btn btn-secondary" onClick={onBack}>Вернуться в режим клиента</button>
      </div>
    </div>
  );
}
