import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { PublicTrainerProfile, TrainerDocument } from '../../types';

// ─── In-app document overlay ─────────────────────────────────────────────────
function DocViewOverlay({ url, mimeType, onClose }: { url: string; mimeType: string; onClose: () => void }) {
  const isPdf = mimeType === 'application/pdf';
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.94)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)', border: 'none',
          fontSize: 20, color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
      {isPdf ? (
        <iframe
          src={url}
          title="Документ"
          style={{ width: '92vw', height: '80vh', border: 'none', borderRadius: 8, background: '#fff' }}
        />
      ) : (
        <img
          src={url}
          alt="Документ"
          style={{ maxWidth: '92vw', maxHeight: '80vh', borderRadius: 8, objectFit: 'contain' }}
        />
      )}
    </div>
  );
}

function StarRating({ value }: { value: number }) {
  return (
    <span style={{ fontSize: 14, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= Math.round(value) ? '#f5a623' : 'var(--border)' }}>★</span>
      ))}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

const DOC_TYPE_LABELS: Record<string, string> = {
  diploma: 'Диплом',
  certificate: 'Сертификат',
  other: 'Документ',
};

function DocumentItem({ trainerId, doc, onOpen }: { trainerId: string; doc: TrainerDocument; onOpen: (url: string, mimeType: string) => void }) {
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    if (loading) return;
    setLoading(true);
    try {
      const blobUrl = await api.trainerPublicDocumentFile(trainerId, doc.id);
      onOpen(blobUrl, doc.mimeType);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const label = DOC_TYPE_LABELS[doc.docType] ?? 'Документ';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--surface)', borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)', padding: '10px 14px',
      marginBottom: 8,
    }}>
      <div style={{ fontSize: 20, lineHeight: 1 }}>
        {doc.mimeType === 'application/pdf' ? '📄' : '🖼'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {doc.title || label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
          {label} · {formatDate(doc.createdAt)}
        </div>
      </div>
      <button
        onClick={handleOpen}
        disabled={loading}
        style={{
          background: 'none', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: '5px 12px',
          fontSize: 12, color: 'var(--text-2)', cursor: loading ? 'default' : 'pointer',
          flexShrink: 0,
        }}
      >
        {loading ? '...' : 'Открыть'}
      </button>
    </div>
  );
}

export default function TrainerDetailScreen() {
  const navigate = useNavigate();
  const { trainerId } = useParams<{ trainerId: string }>();
  const [lightbox, setLightbox] = useState(false);
  const [docOverlay, setDocOverlay] = useState<{ url: string; mimeType: string } | null>(null);

  function handleDocOpen(url: string, mimeType: string) {
    setDocOverlay({ url, mimeType });
  }
  function handleDocClose() {
    if (docOverlay) URL.revokeObjectURL(docOverlay.url);
    setDocOverlay(null);
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trainer-profile', trainerId],
    queryFn: () => api.trainerPublicProfile(trainerId!),
    enabled: !!trainerId,
    staleTime: 60_000,
  });

  const trainer: PublicTrainerProfile | undefined = data?.trainer;
  const name = trainer?.fullName?.trim() || 'Эксперт';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="screen">
      {/* Back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >
          ‹
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Профиль эксперта
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
            Не удалось загрузить профиль эксперта
          </div>
          <button className="btn btn-secondary" style={{ fontSize: 14 }} onClick={() => navigate(-1)}>
            Назад
          </button>
        </div>
      )}

      {trainer && (
        <>
          {/* Avatar + name + rating */}
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r-xl)',
            border: '1px solid var(--border)', padding: 20, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
              {/* Large avatar */}
              <div
                onClick={() => trainer.avatarData && setLightbox(true)}
                style={{
                  width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
                  background: trainer.avatarData ? 'transparent' : 'var(--accent-soft)',
                  border: '2px solid rgba(215,255,63,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 30, fontWeight: 700, color: 'var(--accent)',
                  overflow: 'hidden',
                  cursor: trainer.avatarData ? 'pointer' : 'default',
                }}
              >
                {trainer.avatarData
                  ? <img src={trainer.avatarData} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initial
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  {name}
                </div>
                {trainer.specialization && (
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>
                    {trainer.specialization}
                  </div>
                )}
                {trainer.avgRating != null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StarRating value={trainer.avgRating} />
                    <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      {trainer.avgRating.toFixed(1)}
                      {trainer.reviewCount > 0 && (
                        ` · ${trainer.reviewCount} ${
                          trainer.reviewCount === 1 ? 'отзыв' :
                          trainer.reviewCount < 5 ? 'отзыва' : 'отзывов'
                        }`
                      )}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Нет отзывов</div>
                )}
              </div>
            </div>

            {trainer.bio && (
              <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55, marginBottom: 14 }}>
                {trainer.bio}
              </div>
            )}

            <button
              className="btn"
              style={{ width: '100%', fontSize: 15 }}
              onClick={() => navigate(`/connect-trainer?trainerId=${encodeURIComponent(trainerId!)}`)}
            >
              Выбрать эксперта →
            </button>
          </div>

          {/* Documents */}
          {trainer.documents.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 10px' }}>
                Документы и сертификаты
              </div>
              {trainer.documents.map(doc => (
                <DocumentItem key={doc.id} trainerId={trainerId!} doc={doc} onOpen={handleDocOpen} />
              ))}
            </div>
          )}

          {/* Reviews */}
          {trainer.reviews.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 10px' }}>
                Отзывы
              </div>
              {trainer.reviews.map(review => (
                <div key={review.id} style={{
                  background: 'var(--surface)', borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--border)', padding: '12px 14px', marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <StarRating value={review.rating} />
                    <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                  {review.reviewText && (
                    <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: review.trainerComment ? 8 : 0 }}>
                      {review.reviewText}
                    </div>
                  )}
                  {review.trainerComment && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45,
                      background: 'var(--bg)', borderRadius: 'var(--r-md)',
                      padding: '8px 10px', borderLeft: '2px solid var(--accent)',
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>Ответ эксперта: </span>
                      {review.trainerComment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {trainer.reviews.length === 0 && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border)', padding: '24px 20px', textAlign: 'center',
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Отзывов пока нет</div>
            </div>
          )}
        </>
      )}

      {/* Avatar lightbox */}
      {lightbox && trainer?.avatarData && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <img
            src={trainer.avatarData}
            alt={name}
            style={{ maxWidth: '92vw', maxHeight: '80vh', borderRadius: 12, objectFit: 'contain' }}
          />
        </div>
      )}

      {/* Document overlay */}
      {docOverlay && (
        <DocViewOverlay url={docOverlay.url} mimeType={docOverlay.mimeType} onClose={handleDocClose} />
      )}
    </div>
  );
}
