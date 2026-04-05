export default function ShopScreen() {
  return (
    <div className="screen">
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)', marginBottom: 6 }}>
        SHOP
      </h1>

      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '40px 24px',
        textAlign: 'center', marginTop: 24,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'var(--accent-soft)', border: '1px solid rgba(215,255,63,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="26" height="26" viewBox="0 0 22 22" fill="none">
            <path d="M4 6h14l-1.5 8.5a2 2 0 01-2 1.5H7.5a2 2 0 01-2-1.5L4 6z"
                  stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M4 6l-.8-3H2" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8.5" cy="19" r="1" fill="var(--accent)"/>
            <circle cx="15.5" cy="19" r="1" fill="var(--accent)"/>
          </svg>
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Скоро открываемся
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, maxWidth: 240, margin: '0 auto' }}>
          Здесь появятся продукты и подписки для твоего рациона
        </div>
      </div>
    </div>
  );
}
