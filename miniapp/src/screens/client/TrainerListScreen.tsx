import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { PublicTrainerListItem } from '../../types';

function StarRating({ value }: { value: number }) {
  return (
    <span style={{ fontSize: 13, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= Math.round(value) ? '#f5a623' : 'var(--border)' }}>★</span>
      ))}
    </span>
  );
}

function TrainerCard({ trainer }: { trainer: PublicTrainerListItem }) {
  const navigate = useNavigate();
  const name = trainer.fullName?.trim() || 'Эксперт';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border)', padding: 20, marginBottom: 10,
    }}>
      {/* Header row: avatar + name + rating */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        {/* Avatar — tappable to open detail */}
        <div
          onClick={() => navigate(`/trainers/${encodeURIComponent(trainer.chatId)}`)}
          style={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            background: trainer.avatarData ? 'transparent' : 'var(--accent-soft)',
            border: '2px solid rgba(215,255,63,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: 'var(--accent)',
            overflow: 'hidden', cursor: 'pointer',
          }}
        >
          {trainer.avatarData
            ? <img src={trainer.avatarData} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initial
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
            {name}
          </div>
          {/* Rating row */}
          {trainer.avgRating != null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <StarRating value={trainer.avgRating} />
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {trainer.avgRating.toFixed(1)}
                {trainer.reviewCount > 0 && ` · ${trainer.reviewCount} ${trainer.reviewCount === 1 ? 'отзыв' : trainer.reviewCount < 5 ? 'отзыва' : 'отзывов'}`}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Нет отзывов</div>
          )}
        </div>
      </div>

      {trainer.specialization && (
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: trainer.bio ? 6 : 10 }}>
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

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-secondary"
          style={{ fontSize: 14, flex: 1 }}
          onClick={() => navigate(`/trainers/${encodeURIComponent(trainer.chatId)}`)}
        >
          Подробнее
        </button>
        <button
          className="btn"
          style={{ fontSize: 14, flex: 1 }}
          onClick={() => navigate(`/connect-trainer?trainerId=${encodeURIComponent(trainer.chatId)}`)}
        >
          Выбрать →
        </button>
      </div>
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
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 20 }}>
        Найти эксперта
      </h1>

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
