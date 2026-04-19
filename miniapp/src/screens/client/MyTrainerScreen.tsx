import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { BootstrapData, TrainerRating, TrainerReview } from '../../types';

interface Props { bootstrap: BootstrapData; }

const RATING_LABELS: Record<string, { label: string; color: string }> = {
  excellent: { label: 'Отлично',    color: 'var(--accent)' },
  good:      { label: 'Хорошо',     color: '#7EB8F0' },
  ok:        { label: 'Нормально',  color: 'var(--text-2)' },
  improve:   { label: 'Улучшить',   color: 'var(--warn)' },
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch:     'Обед',
  dinner:    'Ужин',
  snack:     'Перекус',
  unknown:   'Приём',
};

function formatRatingTitle(r: TrainerRating): string {
  if (r.targetType === 'day') {
    // targetId is YYYY-MM-DD — parse at noon to avoid timezone shift
    const dt = new Date(r.targetId + 'T12:00:00');
    return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }
  // meal
  const typeLabel = MEAL_TYPE_LABELS[r.mealType ?? ''] ?? 'Приём';
  if (!r.mealCreatedAt) return typeLabel;
  const dt = new Date(r.mealCreatedAt);
  const date = dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const time = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${typeLabel} ${date}, ${time}`;
}

const HISTORY_OPTIONS = [
  { value: false, label: 'С момента подключения', desc: 'Эксперт видит только новые записи' },
  { value: true,  label: 'Вся история',            desc: 'Эксперт видит все ваши записи' },
];

const PHOTOS_OPTIONS = [
  { value: true,  label: 'С фотографиями', desc: 'Эксперт видит прикреплённые фото' },
  { value: false, label: 'Без фотографий', desc: 'Эксперт видит только текст и данные' },
];

const STAR_LABELS: Record<number, string> = {
  1: 'Не понравилось', 2: 'Ниже ожиданий', 3: 'Нормально', 4: 'Хорошо', 5: 'Отлично',
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ fontSize: 18, color: n <= rating ? 'var(--accent)' : 'var(--surface-3, #2a2a2a)', lineHeight: 1 }}>★</span>
      ))}
      <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 6 }}>{STAR_LABELS[rating] ?? ''}</span>
    </div>
  );
}

function MyReviewBlock({ review }: { review: TrainerReview }) {
  const [expanded, setExpanded] = useState(false);
  const hasReply = !!(review.trainerComment && review.allowTrainerComment);

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border)', marginBottom: 12, overflow: 'hidden',
    }}>
      {/* Header — always visible, tappable */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Ваш отзыв</span>
          <StarRow rating={review.rating} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
          {hasReply && !expanded && (
            <div style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 20, padding: '2px 8px' }}>
              Ответ
            </div>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 18px 18px' }}>
          {review.reviewText && (
            <div style={{
              fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6,
              paddingTop: 12, borderTop: '1px solid var(--border)',
              marginBottom: hasReply ? 14 : 0,
            }}>
              {review.reviewText}
            </div>
          )}
          {!review.reviewText && hasReply && (
            <div style={{ borderTop: '1px solid var(--border)', marginBottom: 14 }} />
          )}
          {hasReply && (
            <div style={{
              background: 'var(--surface-2)', borderRadius: 12,
              border: '1px solid var(--border)', padding: '12px 14px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--accent)', marginBottom: 6 }}>
                Ответ эксперта
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                {review.trainerComment}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyTrainerScreen({ bootstrap }: Props) {
  const navigate = useNavigate();
  const trainer = bootstrap.connectedTrainer;
  const qc = useQueryClient();

  const [showRightsPanel, setShowRightsPanel] = useState(false);
  const [rightsFullHistory, setRightsFullHistory] = useState(false);
  const [rightsCanViewPhotos, setRightsCanViewPhotos] = useState(true);
  const [savedToast, setSavedToast] = useState(false);

  const disconnectMutation = useMutation({
    mutationFn: api.disconnectTrainer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bootstrap'] }),
  });

  const accessMutation = useMutation({
    mutationFn: () => api.setTrainerAccess(rightsFullHistory, rightsCanViewPhotos),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bootstrap'] });
      setShowRightsPanel(false);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    },
  });

  const { data: ratingsData } = useQuery({
    queryKey: ['my-ratings'],
    queryFn: api.myRatings,
    enabled: !!trainer,
  });

  const { data: reviewData } = useQuery({
    queryKey: ['my-trainer-review'],
    queryFn: api.myTrainerReview,
    enabled: !!trainer,
  });

  const isPending = disconnectMutation.isPending || accessMutation.isPending;
  const recentRatings = (ratingsData?.ratings ?? []).slice(0, 5) as TrainerRating[];
  const myReview = reviewData?.review ?? null;

  function handleOpenRights() {
    setRightsFullHistory(trainer?.fullHistoryAccess ?? false);
    setRightsCanViewPhotos(trainer?.canViewPhotos ?? true);
    setShowRightsPanel(true);
  }

  function handleDisconnect() {
    if (!confirm('Отключить эксперта? Он потеряет доступ к вашим данным.')) return;
    disconnectMutation.mutate();
  }

  if (!trainer) {
    return (
      <div className="screen">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}>‹</button>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Мой эксперт</div>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 16px' }}>
          <div style={{ opacity: 0.2, marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Пока без эксперта</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.55, marginBottom: 28, maxWidth: 280, margin: '0 auto 28px' }}>
            С экспертом проще держать режим: меньше срывов, выше дисциплина, быстрее результат. Он видит рацион — и помогает не уходить в сторону.
          </div>
          <button className="btn" style={{ width: 'auto', padding: '13px 32px', display: 'inline-block', fontSize: 15 }} onClick={() => navigate('/connect-trainer')}>
            Подключить эксперта
          </button>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden', marginTop: 16 }}>
          {[
            'Эксперт видит рацион и помогает его корректировать',
            'Меньше срывов — ты не один на один с питанием',
            'Персональная обратная связь по каждому дню',
          ].map((label, i, arr) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const trainerDisplayName = trainer.fullName?.trim() || 'Эксперт';
  const trainerInitial = trainerDisplayName.charAt(0).toUpperCase();
  const connectedDate = new Date(trainer.connectedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}>‹</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Мой эксперт</div>
      </div>

      {/* Expert card */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: 20, border: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: trainer.avatarData ? 'transparent' : 'var(--accent-soft)',
            border: '2px solid rgba(215,255,63,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: 'var(--accent)', overflow: 'hidden',
          }}>
            {trainer.avatarData
              ? <img src={trainer.avatarData} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : trainerInitial
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{trainerDisplayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Подключён с {connectedDate}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'var(--accent-soft)', color: 'var(--accent)' }}>Активен</span>
        </div>

        {/* Access rights */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8 }}>
          Права доступа
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            trainer.fullHistoryAccess ? 'Вся история' : 'С момента подключения',
            trainer.canViewPhotos ? 'Видит фото' : 'Без фото',
            'Нормы и метрики',
          ].map(tag => (
            <div key={tag} style={{ background: 'var(--surface-2)', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              {tag}
            </div>
          ))}
        </div>

        <button
          className="btn btn-secondary"
          style={{ fontSize: 13 }}
          disabled={isPending}
          onClick={handleOpenRights}
        >
          Изменить права
        </button>
      </div>

      {/* My review block (if exists) */}
      {myReview && <MyReviewBlock review={myReview as TrainerReview} />}

      {/* Review button — changes label based on existing review */}
      <button
        className="btn btn-secondary"
        style={{ fontSize: 14, marginBottom: 12 }}
        onClick={() => navigate('/trainer/review')}
      >
        {myReview ? 'Изменить отзыв' : 'Оставить отзыв о специалисте'}
      </button>

      {/* Recent ratings */}
      {recentRatings.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '8px 2px 10px' }}>
            Оценки эксперта
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
            {recentRatings.map((r, i) => {
              const meta = RATING_LABELS[r.rating] ?? { label: r.rating, color: 'var(--text-2)' };
              const title = formatRatingTitle(r);
              const dateLabel = new Date(r.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < recentRatings.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{dateLabel}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {(disconnectMutation.isError || accessMutation.isError) && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>Ошибка. Попробуйте ещё раз.</div>
      )}

      <button
        className="btn btn-secondary"
        style={{ fontSize: 14 }}
        disabled={isPending}
        onClick={handleDisconnect}
      >
        {disconnectMutation.isPending ? 'Отключаем...' : 'Отключить эксперта'}
      </button>

      {/* Rights panel overlay */}
      {showRightsPanel && (
        <>
          <div
            onClick={() => setShowRightsPanel(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200 }}
          />
          <div className="bottom-sheet">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Права доступа</span>
              <button
                onClick={() => setShowRightsPanel(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-3)', cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >×</button>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8 }}>
              История питания
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {HISTORY_OPTIONS.map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setRightsFullHistory(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
                    background: 'var(--surface)', border: `2px solid ${rightsFullHistory === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${rightsFullHistory === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: rightsFullHistory === opt.value ? 'var(--accent)' : 'transparent',
                  }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8 }}>
              Фотографии блюд
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {PHOTOS_OPTIONS.map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setRightsCanViewPhotos(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
                    background: 'var(--surface)', border: `2px solid ${rightsCanViewPhotos === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${rightsCanViewPhotos === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: rightsCanViewPhotos === opt.value ? 'var(--accent)' : 'transparent',
                  }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {accessMutation.isError && (
              <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
                Ошибка. Попробуйте ещё раз.
              </div>
            )}

            <button
              className="btn"
              style={{ fontSize: 15 }}
              disabled={accessMutation.isPending}
              onClick={() => accessMutation.mutate()}
            >
              {accessMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </>
      )}

      {/* Saved toast */}
      {savedToast && (
        <div style={{
          position: 'fixed', bottom: 90, left: 16, right: 16,
          background: 'var(--accent)', color: '#000',
          fontWeight: 700, borderRadius: 12,
          padding: '12px 16px', textAlign: 'center',
          fontSize: 14, zIndex: 300,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          Права обновлены
        </div>
      )}
    </div>
  );
}
