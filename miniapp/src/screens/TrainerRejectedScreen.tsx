interface Props { onBack: () => void; }

export default function TrainerRejectedScreen({ onBack }: Props) {
  return (
    <div className="screen">
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Заявка отклонена</h2>
        <p style={{ color: 'var(--text-3)', marginBottom: 24, fontSize: 14, lineHeight: 1.55 }}>К сожалению, твоя заявка эксперта была отклонена. Ты можешь подать повторную заявку позже.</p>
        <button className="btn btn-secondary" onClick={onBack}>Вернуться в режим клиента</button>
      </div>
    </div>
  );
}
