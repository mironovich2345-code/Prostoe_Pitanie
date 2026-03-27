import { useState } from 'react';
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
  const [documentLink, setDocumentLink] = useState(existing?.documentLink ?? '');
  const [specialization, setSpecialization] = useState(existing?.specialization ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!fullName.trim() || !socialLink.trim() || !documentLink.trim()) {
      setError('Заполни все обязательные поля');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.expertApply({ fullName, socialLink, documentLink, specialization, bio });
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
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--tg-theme-button-color, #007aff)' }}
        >
          ‹
        </button>
        <h1 style={{ margin: 0, fontSize: 20 }}>
          {isReapply ? '🔄 Повторная заявка' : '🎓 Стать экспертом'}
        </h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--tg-theme-hint-color, #888)', lineHeight: 1.5, margin: 0 }}>
          Заполни анкету — мы проверим её в течение 1–3 рабочих дней. После подтверждения ты сможешь работать с клиентами в режиме Эксперта.
        </p>
      </div>

      <div className="card">
        <div className="card-title">Обязательные поля</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #888)', display: 'block', marginBottom: 4 }}>
            Имя и фамилия
          </label>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Иван Иванов"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #888)', display: 'block', marginBottom: 4 }}>
            Ссылка на соцсеть или сайт
          </label>
          <input
            value={socialLink}
            onChange={e => setSocialLink(e.target.value)}
            placeholder="https://instagram.com/..."
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #888)', display: 'block', marginBottom: 4 }}>
            Ссылка на диплом / сертификат
          </label>
          <input
            value={documentLink}
            onChange={e => setDocumentLink(e.target.value)}
            placeholder="https://drive.google.com/..."
            style={inputStyle}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Дополнительно</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #888)', display: 'block', marginBottom: 4 }}>
            Специализация
          </label>
          <input
            value={specialization}
            onChange={e => setSpecialization(e.target.value)}
            placeholder="Силовые тренировки, похудение..."
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #888)', display: 'block', marginBottom: 4 }}>
            О себе
          </label>
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
        <div style={{ color: '#dc3545', fontSize: 14, marginBottom: 12, padding: '8px 12px', background: '#f8d7da', borderRadius: 8 }}>
          {error}
        </div>
      )}

      <button className="btn" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Отправляем...' : 'Отправить заявку'}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 8,
  fontSize: 15,
  background: 'var(--tg-theme-bg-color, #f0f0f0)',
  color: 'var(--tg-theme-text-color, #000)',
  outline: 'none',
};
