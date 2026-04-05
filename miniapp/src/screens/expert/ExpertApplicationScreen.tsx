import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useBootstrap } from '../../hooks/useBootstrap';

export default function ExpertApplicationScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: bootstrap } = useBootstrap();

  const existing = bootstrap?.trainerProfile;
  const isReapply = existing?.verificationStatus === 'rejected';

  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [socialLink, setSocialLink] = useState(existing?.socialLink ?? '');
  const [specialization, setSpecialization] = useState(existing?.specialization ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoData(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!fullName.trim() || !socialLink.trim()) {
      setError('Заполни все обязательные поля');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.expertApply({
        fullName,
        socialLink,
        documentLink: '-',          // legacy field, kept for API compat
        specialization,
        bio,
        verificationPhotoData: photoData ?? undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
      navigate('/profile', { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки заявки');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/profile')}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >
          ‹
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
          {isReapply ? 'Повторная заявка' : 'Стать экспертом'}
        </h1>
      </div>

      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '16px 18px', marginBottom: 12,
      }}>
        <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.55, margin: 0 }}>
          Заполни анкету — мы проверим её в течение 1–3 рабочих дней. После подтверждения ты сможешь работать с клиентами в режиме Эксперта.
        </p>
      </div>

      {/* Required fields */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '18px 18px', marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 14 }}>
          Обязательные поля
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Имя и фамилия</label>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Иван Иванов"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Ссылка на соцсеть или сайт</label>
          <input
            value={socialLink}
            onChange={e => setSocialLink(e.target.value)}
            placeholder="https://instagram.com/..."
            style={inputStyle}
          />
        </div>
      </div>

      {/* Verification photo */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '18px 18px', marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 14 }}>
          Подтверждение личности
        </div>

        <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 16 }}>
          Сделайте фото, чтобы подтвердить сходство с сайтом или соцсетью
        </div>

        {photoData ? (
          <div style={{ position: 'relative', marginBottom: 0 }}>
            <img
              src={photoData}
              alt="Фото верификации"
              style={{
                width: '100%', borderRadius: 12, objectFit: 'cover',
                maxHeight: 220, display: 'block',
                border: '2px solid var(--accent)',
              }}
            />
            <button
              onClick={() => { setPhotoData(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', border: 'none',
                color: '#fff', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%', padding: '20px 16px',
              background: 'var(--surface-2)', border: '1.5px dashed var(--border)',
              borderRadius: 12, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                Сделать фото
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Нажмите, чтобы открыть камеру
              </div>
            </div>
          </button>
        )}

        {/* Camera-only file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          style={{ display: 'none' }}
          onChange={handlePhotoChange}
        />
      </div>

      {/* Optional fields */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '18px 18px', marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 14 }}>
          Дополнительно
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Специализация</label>
          <input
            value={specialization}
            onChange={e => setSpecialization(e.target.value)}
            placeholder="Силовые тренировки, похудение..."
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>О себе</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Расскажи о своём опыте и подходе..."
            rows={3}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>
      </div>

      {error && (
        <div style={{
          color: 'var(--danger)', fontSize: 13, marginBottom: 12,
          padding: '10px 14px', background: 'rgba(255,59,48,0.1)',
          borderRadius: 10, border: '1px solid rgba(255,59,48,0.2)',
        }}>
          {error}
        </div>
      )}

      <button className="btn" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Отправляем...' : 'Отправить заявку'}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-3)',
  display: 'block',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 15,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};
