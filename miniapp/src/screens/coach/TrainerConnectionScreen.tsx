import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

export default function TrainerConnectionScreen() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['trainer-my-code'],
    queryFn: api.trainerMyCode,
  });

  function handleCopyLink() {
    if (!data?.link) return;
    navigator.clipboard.writeText(data.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => null);
  }

  const code = data?.code ?? '';
  const link = data?.link ?? '';

  const qrUrl = link
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=svg&data=${encodeURIComponent(link)}`
    : '';

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >‹</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Подключить клиента</div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* QR + Code */}
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r-xl)',
            padding: 24, border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Клиент сканирует QR или вводит код</div>

            {qrUrl && (
              <div style={{
                width: 220, height: 220, borderRadius: 16, overflow: 'hidden',
                background: '#fff', padding: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img src={qrUrl} alt="QR код для подключения" width={220} height={220} />
              </div>
            )}

            {/* Big code display */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8 }}>
                Код подключения
              </div>
              <div style={{
                fontSize: 44, fontWeight: 700, letterSpacing: 12,
                color: 'var(--accent)', fontFamily: 'monospace',
                background: 'var(--accent-soft)', borderRadius: 16,
                padding: '12px 24px', lineHeight: 1,
              }}>
                {code}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                Постоянный код · не меняется
              </div>
            </div>
          </div>

          {/* Copy link button */}
          <button
            className="btn"
            style={{ fontSize: 14, marginBottom: 16 }}
            onClick={handleCopyLink}
          >
            {copied ? '✓ Ссылка скопирована' : '📋 Скопировать ссылку'}
          </button>

          {/* Link display */}
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '10px 14px',
            border: '1px solid var(--border)',
            fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)',
            wordBreak: 'break-all', lineHeight: 1.5,
            marginBottom: 16,
          }}>
            {link}
          </div>

          {/* Instructions */}
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            {[
              { n: '1', text: 'Покажите QR-код клиенту или отправьте ссылку' },
              { n: '2', text: 'Клиент сканирует QR или вводит 6-значный код в приложении' },
              { n: '3', text: 'Клиент подтверждает подключение и выбирает права доступа' },
            ].map((item, i, arr) => (
              <div
                key={item.n}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {item.n}
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
