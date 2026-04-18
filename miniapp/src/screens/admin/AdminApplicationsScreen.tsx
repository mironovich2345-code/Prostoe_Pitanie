import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../api/client';

type App = {
  chatId: string;
  fullName: string | null;
  socialLink: string | null;
  specialization: string | null;
  bio: string | null;
  verificationPhotoData: string | null;
  appliedAt: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ApplicationCard({ app, onAction }: { app: App; onAction: () => void }) {
  const qc = useQueryClient();
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const isCompany = app.specialization === 'Компания';

  const approveMutation = useMutation({
    mutationFn: () => api.adminApprove(app.chatId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-applications'] }); onAction(); },
  });
  const rejectMutation = useMutation({
    mutationFn: () => api.adminReject(app.chatId, rejectNote),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-applications'] }); onAction(); },
  });

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border)', padding: '16px 18px', marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            {app.fullName || '—'}
          </div>
          <div style={{ fontSize: 11, color: isCompany ? '#7EB8F0' : 'var(--accent)', fontWeight: 600, marginTop: 2 }}>
            {isCompany ? 'Компания' : 'Эксперт'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtDate(app.appliedAt)}</div>
      </div>

      {/* Fields */}
      {[
        { label: 'Chat ID', value: app.chatId },
        { label: 'Соцсеть / сайт', value: app.socialLink },
        { label: 'Bio', value: app.bio },
      ].map(({ label, value }) => value ? (
        <div key={label} style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)' }}>{label}</span>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2, wordBreak: 'break-word', lineHeight: 1.4 }}>{value}</div>
        </div>
      ) : null)}

      {/* Photo */}
      {app.verificationPhotoData && (
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={() => setShowPhoto(v => !v)}
            style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showPhoto ? 'Скрыть фото' : 'Показать фото верификации'}
          </button>
          {showPhoto && (
            <img
              src={app.verificationPhotoData}
              alt="Фото верификации"
              style={{ display: 'block', maxWidth: '100%', borderRadius: 10, marginTop: 8, maxHeight: 200, objectFit: 'cover' }}
            />
          )}
        </div>
      )}

      {/* Reject note input */}
      {showReject && (
        <div style={{ marginBottom: 10 }}>
          <input
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            placeholder="Причина отклонения (необязательно)"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 10, fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => approveMutation.mutate()}
          disabled={approveMutation.isPending || rejectMutation.isPending}
          className="btn"
          style={{ flex: 1, fontSize: 13 }}
        >
          {approveMutation.isPending ? '...' : '✓ Подтвердить'}
        </button>
        {showReject ? (
          <button
            onClick={() => rejectMutation.mutate()}
            disabled={rejectMutation.isPending || approveMutation.isPending}
            style={{
              flex: 1, fontSize: 13, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.25)',
              color: 'var(--danger)', cursor: 'pointer', fontWeight: 600,
            }}
          >
            {rejectMutation.isPending ? '...' : 'Отклонить'}
          </button>
        ) : (
          <button
            onClick={() => setShowReject(true)}
            style={{
              flex: 1, fontSize: 13, padding: '10px 12px', borderRadius: 10,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-2)', cursor: 'pointer', fontWeight: 600,
            }}
          >
            ✕ Отклонить
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminApplicationsScreen() {
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-applications'],
    queryFn: api.adminApplications,
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="screen">
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 20 }}>
        Заявки на верификацию
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>}

      {error && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          Ошибка загрузки
        </div>
      )}

      {data?.applications?.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>Нет новых заявок</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Все заявки обработаны</div>
        </div>
      )}

      {data?.applications?.map(app => (
        <ApplicationCard key={app.chatId} app={app} onAction={() => showToast('Готово')} />
      ))}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: '#000', fontWeight: 700,
          padding: '10px 22px', borderRadius: 24, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
