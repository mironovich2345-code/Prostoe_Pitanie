import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { TrainerReview } from '../../types';

const MAX_CHARS = 500;

// ─── iOS-style toggle ───────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13,
        background: value ? 'var(--accent)' : 'var(--surface-3, #2a2a2a)',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0, padding: 0,
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'white',
        position: 'absolute',
        top: 3, left: value ? 21 : 3,
        transition: 'left 0.18s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

// ─── Star rating ────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onTouchStart={() => setHover(n)}
          onTouchEnd={() => { onChange(n); setHover(0); }}
          style={{
            background: 'none', border: 'none', padding: '4px 2px',
            cursor: 'pointer', lineHeight: 1,
            fontSize: 38,
            color: n <= display ? 'var(--accent)' : 'var(--surface-3, #2a2a2a)',
            transition: 'color 0.12s, transform 0.1s',
            transform: n <= display ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const STAR_LABELS: Record<number, string> = {
  1: 'Не понравилось',
  2: 'Ниже ожиданий',
  3: 'Нормально',
  4: 'Хорошо',
  5: 'Отлично',
};

// ─── Inner form (receives existing review so useState inits correctly) ───────

function ReviewForm({ existing }: { existing: TrainerReview | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.reviewText ?? '');
  const [allowComment, setAllowComment] = useState(existing?.allowTrainerComment ?? true);

  const mutation = useMutation({
    mutationFn: () => api.submitTrainerReview({ rating, reviewText: text, allowTrainerComment: allowComment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-trainer-review'] });
      navigate('/trainer');
    },
  });

  const charsLeft = MAX_CHARS - text.length;
  const canSubmit = rating >= 1 && !mutation.isPending;

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => navigate('/trainer')}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >‹</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
          {existing ? 'Изменить отзыв' : 'Отзыв о специалисте'}
        </div>
      </div>

      {/* Stars card */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '24px 20px 20px',
        marginBottom: 12, textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16, fontWeight: 500 }}>
          Оцените работу тренера
        </div>
        <StarRating value={rating} onChange={setRating} />
        {rating > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
            {STAR_LABELS[rating]}
          </div>
        )}
      </div>

      {/* Text area card */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '16px',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10 }}>
          Комментарий
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
          placeholder="Расскажи, что понравилось или что можно улучшить..."
          rows={5}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--surface-2)', border: '1px solid var(--border-2, var(--border))',
            borderRadius: 10, padding: '11px 12px',
            fontSize: 14, color: 'var(--text)', lineHeight: 1.5,
            resize: 'none', outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <div style={{
          textAlign: 'right', marginTop: 6,
          fontSize: 11, fontWeight: 600,
          color: charsLeft < 50 ? 'var(--danger)' : 'var(--text-3)',
        }}>
          {charsLeft} / {MAX_CHARS}
        </div>
      </div>

      {/* Allow comment toggle */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)', padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
            Тренер может ответить
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            Тренер сможет оставить комментарий к вашему отзыву
          </div>
        </div>
        <Toggle value={allowComment} onChange={setAllowComment} />
      </div>

      {mutation.isError && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
          Ошибка. Попробуй ещё раз.
        </div>
      )}

      <button
        className="btn"
        disabled={!canSubmit}
        onClick={() => mutation.mutate()}
        style={{ opacity: canSubmit ? 1 : 0.45 }}
      >
        {mutation.isPending ? 'Сохраняем...' : existing ? 'Обновить отзыв' : 'Отправить отзыв'}
      </button>
    </div>
  );
}

// ─── Screen wrapper — loads existing review then mounts form ─────────────────

export default function TrainerReviewScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-trainer-review'],
    queryFn: api.myTrainerReview,
  });

  if (isLoading) {
    return (
      <div className="screen" style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
        <div className="spinner" />
      </div>
    );
  }

  // key forces remount with correct initial state once data arrives
  return <ReviewForm key={data?.review?.id ?? 'new'} existing={data?.review ?? null} />;
}
