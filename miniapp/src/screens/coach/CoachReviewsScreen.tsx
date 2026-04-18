import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { TrainerReviewWithClient } from '../../types';

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 1, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= rating ? '#F5A623' : 'var(--border)' }}>★</span>
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: TrainerReviewWithClient }) {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState(review.trainerComment ?? '');
  const [editing, setEditing] = useState(false);

  const commentMutation = useMutation({
    mutationFn: (text: string) => api.trainerPatchReviewComment(review.id, text),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['trainer-reviews'] });
    },
  });

  const clientLabel = review.clientName || `Клиент`;
  const date = new Date(review.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 10,
    }}>
      {/* Header: name + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{clientLabel}</div>
          <StarDisplay rating={review.rating} size={15} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0, marginLeft: 12, paddingTop: 2 }}>{date}</div>
      </div>

      {/* Review text */}
      {review.reviewText && (
        <div style={{
          fontSize: 14, color: 'var(--text-2)', lineHeight: 1.55,
          background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px',
          marginBottom: review.allowTrainerComment ? 12 : 0,
        }}>
          {review.reviewText}
        </div>
      )}

      {/* Trainer comment section */}
      {review.allowTrainerComment && (
        <div>
          {editing ? (
            <div>
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ваш ответ клиенту..."
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-2)', border: '1px solid var(--accent)',
                  borderRadius: 10, padding: '10px 12px',
                  fontSize: 14, color: 'var(--text)', resize: 'none', outline: 'none',
                  fontFamily: 'inherit', lineHeight: 1.5,
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  className="btn"
                  style={{ fontSize: 13, flex: 1 }}
                  disabled={commentMutation.isPending}
                  onClick={() => commentMutation.mutate(commentText)}
                >
                  {commentMutation.isPending ? 'Сохраняю...' : 'Сохранить'}
                </button>
                <button
                  onClick={() => { setCommentText(review.trainerComment ?? ''); setEditing(false); }}
                  style={{
                    fontSize: 13, padding: '10px 16px',
                    background: 'var(--surface-3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-lg)', cursor: 'pointer', color: 'var(--text-2)',
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : review.trainerComment ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Ваш ответ
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{review.trainerComment}</div>
              </div>
              <button
                onClick={() => setEditing(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '2px 4px', flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              style={{
                background: 'none', border: '1px dashed var(--border)',
                borderRadius: 10, padding: '8px 14px',
                fontSize: 13, color: 'var(--text-3)', cursor: 'pointer', width: '100%',
                textAlign: 'left',
              }}
            >
              + Ответить клиенту
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoachReviewsScreen() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trainer-reviews'],
    queryFn: api.trainerReviews,
    staleTime: 30_000,
  });

  const reviews = data?.reviews ?? [];
  const avg = data?.avgRating ?? null;

  return (
    <div className="screen">
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 20 }}>Мои отзывы</h1>

      {/* Average rating banner */}
      {avg !== null && reviews.length > 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-xl)',
          border: '1px solid var(--border)', padding: '20px 24px',
          marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
              {avg.toFixed(1)}
            </div>
            <div style={{ marginTop: 4 }}>
              <StarDisplay rating={Math.round(avg)} size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
              Средняя оценка
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {reviews.length} {reviews.length === 1 ? 'отзыв' : reviews.length < 5 ? 'отзыва' : 'отзывов'}
            </div>
          </div>
        </div>
      )}

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
          <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>Не удалось загрузить отзывы</div>
        </div>
      )}

      {!isLoading && !isError && reviews.length === 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-xl)',
          border: '1px solid var(--border)', padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', opacity: 0.25 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Отзывов пока нет</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Клиенты смогут оставить отзыв после работы с вами
          </div>
        </div>
      )}

      {!isLoading && !isError && reviews.length > 0 && (
        <div>
          {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}
    </div>
  );
}
