import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

interface TrainerItem {
  chatId: string;
  fullName: string | null;
  specialization: string | null;
  bio: string | null;
}

function TrainerCard({ trainer }: { trainer: TrainerItem }) {
  const navigate = useNavigate();
  const name = trainer.fullName?.trim() || 'Эксперт';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border)', padding: 20, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: (trainer.specialization || trainer.bio) ? 12 : 0 }}>
        {/* Avatar */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent-soft)', border: '2px solid rgba(215,255,63,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: 'var(--accent)',
        }}>
          {initial}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {name}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--accent-soft)', borderRadius: 20, padding: '2px 9px' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.2 }}>Верифицирован</span>
          </div>
        </div>
      </div>

      {trainer.specialization && (
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: trainer.bio ? 6 : 12 }}>
          <span style={{ color: 'var(--text-3)' }}>Специализация: </span>
          {trainer.specialization}
        </div>
      )}
      {trainer.bio && (
        <div style={{
          fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 12,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        } as React.CSSProperties}>
          {trainer.bio}
        </div>
      )}

      <button
        className="btn"
        style={{ fontSize: 14 }}
        onClick={() => navigate(`/connect-trainer?trainerId=${encodeURIComponent(trainer.chatId)}`)}
      >
        Выбрать эксперта →
      </button>
    </div>
  );
}

export default function TrainerListScreen() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trainer-list'],
    queryFn: api.trainerList,
    staleTime: 60_000,
  });

  const trainers = data?.trainers ?? [];

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >
          ‹
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Найти эксперта
        </h1>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div className="spinner" />
        </div>
      )}

      {isError && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', padding: '32px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
            Не удалось загрузить список экспертов
          </div>
          <button className="btn btn-secondary" style={{ fontSize: 14 }} onClick={() => navigate(-1)}>
            Назад
          </button>
        </div>
      )}

      {!isLoading && !isError && trainers.length === 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-xl)',
          border: '1px solid var(--border)', padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
            Эксперты пока не добавлены
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Подключи эксперта по его коду, если он уже работает на платформе
          </div>
        </div>
      )}

      {!isLoading && !isError && trainers.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 14px' }}>
            {trainers.length} {trainers.length === 1 ? 'эксперт' : trainers.length < 5 ? 'эксперта' : 'экспертов'}
          </div>
          {trainers.map(t => <TrainerCard key={t.chatId} trainer={t} />)}
        </div>
      )}
    </div>
  );
}
