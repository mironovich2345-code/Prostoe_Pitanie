import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BootstrapData } from '../../types';

/** Resize image to max 600px on longest side, JPEG 75% — keeps avatar under 512 KB backend limit */
async function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxSide = 600;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('load failed')); };
    img.src = objectUrl;
  });
}

/** Open a blob URL reliably in Telegram WebApp (avoids window.open popup blocking) */
function openBlobUrl(blobUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
import StatusBadge from '../../components/StatusBadge';

interface Props {
  bootstrap: BootstrapData;
  onSwitchToClient?: () => void;
}

// ─── SVG icons ────────────────────────────────────────────────────────────────
function IconReferral() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}
function IconPayout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  );
}
function IconReviews() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}
function IconCamera() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  diploma:     'Диплом',
  certificate: 'Сертификат',
  other:       'Другое',
};

// ─── Finance row ──────────────────────────────────────────────────────────────
function FinanceRow({ icon, label, path, navigate }: { icon: React.ReactNode; label: string; path: string; navigate: (p: string) => void }) {
  return (
    <button
      onClick={() => navigate(path)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', padding: '15px 20px',
        background: 'none', border: 'none', cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        textAlign: 'left',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: 'var(--accent-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)',
      }}>
        {icon}
      </div>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
      <span style={{ fontSize: 18, color: 'var(--text-3)' }}>›</span>
    </button>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CoachProfileScreen({ bootstrap, onSwitchToClient }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tp = bootstrap.trainerProfile;

  // ── Name editing ──
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(tp?.fullName ?? '');
  const [localName, setLocalName] = useState(tp?.fullName ?? '');

  // ── Bio / socialLink editing ──
  const [editingAbout, setEditingAbout] = useState(false);
  const [bioVal, setBioVal] = useState(tp?.bio ?? '');
  const [socialLinkVal, setSocialLinkVal] = useState(tp?.socialLink ?? '');
  const [localBio, setLocalBio] = useState<string | null>(tp?.bio ?? null);
  const [localSocialLink, setLocalSocialLink] = useState<string | null>(tp?.socialLink ?? null);
  // Use trainer avatar; fall back to client profile avatar (display-only, not auto-saved)
  const clientAvatar = bootstrap.profile?.avatarData ?? null;
  const [localAvatar, setLocalAvatar] = useState<string | null>(tp?.avatarData ?? clientAvatar ?? null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // ── Documents ──
  const [showDocSheet, setShowDocSheet] = useState(false);
  const [docType, setDocType] = useState<'diploma' | 'certificate' | 'other'>('diploma');
  const [docTitle, setDocTitle] = useState('');
  const [docFileData, setDocFileData] = useState<string | null>(null);
  const [docFileMime, setDocFileMime] = useState('');
  const [docFileError, setDocFileError] = useState<string | null>(null);

  const docsQuery = useQuery({
    queryKey: ['trainer-documents'],
    queryFn: api.trainerDocuments,
    enabled: tp?.verificationStatus === 'verified',
  });
  const documents = docsQuery.data?.documents ?? [];

  const uploadDocMutation = useMutation({
    mutationFn: () => api.trainerDocumentUpload({ docType, title: docTitle.trim() || undefined, fileData: docFileData! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-documents'] });
      setShowDocSheet(false);
      setDocFileData(null);
      setDocTitle('');
      setDocType('diploma');
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: number) => api.trainerDocumentDelete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainer-documents'] }),
  });

  function handleDocFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFileError(null);
    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024) {
      setDocFileError(`Файл слишком большой (макс. ${MAX_MB} МБ)`);
      e.target.value = '';
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setDocFileError('Поддерживаются: JPG, PNG, WEBP, PDF');
      e.target.value = '';
      return;
    }
    setDocFileMime(file.type);
    const reader = new FileReader();
    reader.onload = () => setDocFileData(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleDocView(id: number, filename: string) {
    try {
      const url = await api.trainerDocumentFile(id);
      openBlobUrl(url, filename);
    } catch { /* ignore */ }
  }

  const patchMutation = useMutation({
    mutationFn: api.trainerPatchProfile,
    onSuccess: (data) => {
      if (data.fullName !== undefined) setLocalName(data.fullName ?? '');
      if (data.avatarData !== undefined) {
        setLocalAvatar(data.avatarData);
        // Write avatarData into the bootstrap cache immediately so remount sees the new value
        queryClient.setQueryData<BootstrapData>(['bootstrap'], old =>
          old?.trainerProfile
            ? { ...old, trainerProfile: { ...old.trainerProfile, avatarData: data.avatarData ?? null } }
            : old
        );
      }
      if (data.bio !== undefined) setLocalBio(data.bio);
      if (data.socialLink !== undefined) setLocalSocialLink(data.socialLink);
      queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
    },
    onError: (err: Error, variables) => {
      // Revert local avatar if save failed
      if (variables.avatarData !== undefined) {
        setLocalAvatar(tp?.avatarData ?? clientAvatar ?? null);
        setAvatarError(err.message.includes('Invalid') ? 'Фото слишком большое или неверный формат' : 'Не удалось сохранить фото');
      }
    },
  });

  const saveName = () => {
    const trimmed = nameVal.trim();
    patchMutation.mutate({ fullName: trimmed || undefined });
    setLocalName(trimmed);
    setEditingName(false);
  };

  const saveAbout = () => {
    patchMutation.mutate({ bio: bioVal, socialLink: socialLinkVal });
    setLocalBio(bioVal.trim() || null);
    setLocalSocialLink(socialLinkVal.trim() || null);
    setEditingAbout(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    try {
      const base64 = await resizeAvatar(file);
      setLocalAvatar(base64);
      patchMutation.mutate({ avatarData: base64 });
    } catch {
      setAvatarError('Не удалось обработать фото');
    }
    e.target.value = '';
  };

  const displayName = localName || tp?.fullName || '';
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

  return (
    <div className="screen">
      {/* Hero card — same pattern as client profile */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '24px 20px 20px', marginBottom: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative',
      }}>
        {/* Role toggle — top-right, coach is always "on" */}
        {onSwitchToClient && (
          <div style={{
            position: 'absolute', top: 14, right: 16,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--accent)' }}>
              Эксперт
            </span>
            <button
              onClick={onSwitchToClient}
              aria-label="Переключить на Клиент"
              style={{
                width: 44, height: 26, borderRadius: 13,
                background: 'var(--accent)',
                border: 'none',
                padding: 0, cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', left: 23,
                width: 18, height: 18, borderRadius: '50%',
                background: '#000',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
              }} />
            </button>
          </div>
        )}

        {/* Avatar */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{
            width: 112, height: 112, borderRadius: '50%',
            background: localAvatar ? 'transparent' : 'var(--accent-soft)',
            border: '2px solid rgba(215,255,63,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 44, fontWeight: 700, color: 'var(--accent)',
            overflow: 'hidden',
          }}>
            {localAvatar
              ? <img src={localAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initial
            }
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--accent)', border: '2px solid var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#000', padding: 0,
            }}
          >
            <IconCamera />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
        {avatarError && (
          <div style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center', marginBottom: 8 }}>
            {avatarError}
          </div>
        )}

        {/* Name + edit */}
        {editingName ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            <input
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              autoFocus
              placeholder="Ваше имя"
              style={{
                width: '100%', boxSizing: 'border-box', textAlign: 'center',
                fontSize: 16, fontWeight: 600,
                background: 'var(--surface-2)', border: '1px solid var(--accent)',
                borderRadius: 8, padding: '8px 10px', color: 'var(--text)', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveName} disabled={patchMutation.isPending} className="btn" style={{ flex: 1, fontSize: 14 }}>
                {patchMutation.isPending ? '...' : 'Сохранить'}
              </button>
              <button
                onClick={() => { setNameVal(localName); setEditingName(false); }}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', fontSize: 14, color: 'var(--text-2)', cursor: 'pointer' }}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', textAlign: 'center' }}>
              {displayName || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Имя не указано</span>}
            </span>
            <button
              onClick={() => { setNameVal(displayName); setEditingName(true); }}
              style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0 }}
            >
              <IconEdit />
            </button>
          </div>
        )}

        {/* Status + specialization */}
        <div style={{ marginBottom: tp?.specialization ? 4 : 0 }}>
          <StatusBadge status={tp?.verificationStatus ?? 'pending'} />
        </div>
        {tp?.specialization && (
          <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginBottom: 4 }}>
            {tp.specialization}
          </div>
        )}

      </div>

      {/* About section */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '12px 4px 8px' }}>
        О себе
      </div>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 12,
      }}>
        {editingAbout ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={bioVal}
              onChange={e => setBioVal(e.target.value)}
              placeholder="Расскажите о себе и своём подходе"
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                background: 'var(--surface-2)', border: '1px solid var(--accent)',
                borderRadius: 8, padding: '10px 12px', fontSize: 14,
                color: 'var(--text)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
            <input
              value={socialLinkVal}
              onChange={e => setSocialLinkVal(e.target.value)}
              placeholder="Ссылка (Instagram, VK, сайт…)"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 12px', fontSize: 14,
                color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveAbout} disabled={patchMutation.isPending} className="btn" style={{ flex: 1, fontSize: 14 }}>
                {patchMutation.isPending ? '...' : 'Сохранить'}
              </button>
              <button
                onClick={() => { setBioVal(localBio ?? ''); setSocialLinkVal(localSocialLink ?? ''); setEditingAbout(false); }}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', fontSize: 14, color: 'var(--text-2)', cursor: 'pointer' }}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1 }}>
              {localBio ? (
                <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: localSocialLink ? 8 : 0 }}>
                  {localBio}
                </div>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text-3)', fontStyle: 'italic' }}>Расскажите о себе</div>
              )}
              {localSocialLink && (
                <div style={{ fontSize: 13, color: 'var(--accent)' }}>{localSocialLink}</div>
              )}
            </div>
            <button
              onClick={() => { setBioVal(localBio ?? ''); setSocialLinkVal(localSocialLink ?? ''); setEditingAbout(true); }}
              style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0 }}
            >
              <IconEdit />
            </button>
          </div>
        )}
      </div>

      {/* Documents section — visible for verified experts */}
      {tp?.verificationStatus === 'verified' && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '12px 4px 8px' }}>
            Документы
          </div>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r-xl)',
            border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12,
          }}>
            {docsQuery.isLoading ? (
              <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            ) : documents.length === 0 ? (
              <div style={{ padding: '18px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
                  Дипломы и сертификаты будут показаны в вашей карточке для клиентов
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 14 }}
                  onClick={() => { setShowDocSheet(true); setDocFileError(null); setDocFileData(null); setDocTitle(''); setDocType('diploma'); }}
                >
                  + Добавить документ
                </button>
              </div>
            ) : (
              <>
                {documents.map((doc, i) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 18px',
                      borderBottom: i < documents.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: 'var(--accent-soft)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {doc.mimeType === 'application/pdf' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.title || DOC_TYPE_LABELS[doc.docType] || doc.docType}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {DOC_TYPE_LABELS[doc.docType]} · {new Date(doc.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDocView(doc.id, doc.title || DOC_TYPE_LABELS[doc.docType] || 'document')}
                      style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: 'var(--accent)', flexShrink: 0 }}
                      aria-label="Открыть"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </button>
                    <button
                      onClick={() => deleteDocMutation.mutate(doc.id)}
                      disabled={deleteDocMutation.isPending}
                      style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: 'var(--danger)', flexShrink: 0 }}
                      aria-label="Удалить"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                ))}
                {documents.length < 10 && (
                  <button
                    onClick={() => { setShowDocSheet(true); setDocFileError(null); setDocFileData(null); setDocTitle(''); setDocType('diploma'); }}
                    style={{
                      width: '100%', padding: '13px 20px', fontSize: 14, fontWeight: 600,
                      background: 'transparent', border: 'none', borderTop: '1px solid var(--border)',
                      color: 'var(--accent)', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    + Добавить документ
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Finance section */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '12px 4px 8px' }}>
        Финансы
      </div>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12,
      }}>
        <FinanceRow icon={<IconReferral />} label="Рефералы" path="/referrals" navigate={navigate} />
      </div>

      {/* Reviews section */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '12px 4px 8px' }}>
        Репутация
      </div>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        <button
          onClick={() => navigate('/reviews')}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            width: '100%', padding: '15px 20px',
            background: 'none', border: 'none', cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'var(--accent-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            <IconReviews />
          </div>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>Мои отзывы</span>
          <span style={{ fontSize: 18, color: 'var(--text-3)' }}>›</span>
        </button>
      </div>

      {/* Document upload bottom sheet */}
      {showDocSheet && (
        <>
          <div
            onClick={() => setShowDocSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200 }}
          />
          <div className="bottom-sheet">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Добавить документ</span>
              <button
                onClick={() => setShowDocSheet(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-3)', cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >×</button>
            </div>

            {/* Type selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['diploma', 'certificate', 'other'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setDocType(t)}
                  style={{
                    flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600,
                    borderRadius: 8, border: `1.5px solid ${docType === t ? 'var(--accent)' : 'var(--border)'}`,
                    background: docType === t ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: docType === t ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer',
                  }}
                >
                  {DOC_TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Optional title */}
            <input
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              placeholder="Название (необязательно)"
              style={{
                width: '100%', boxSizing: 'border-box', marginBottom: 12,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '11px 13px', fontSize: 14,
                color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
              }}
            />

            {/* File picker */}
            {docFileData ? (
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 14px' }}>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {docFileMime === 'application/pdf' ? '📄 PDF выбран' : '🖼 Изображение выбрано'}
                </div>
                <button
                  onClick={() => { setDocFileData(null); if (docFileInputRef.current) docFileInputRef.current.value = ''; }}
                  style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-3)', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                >×</button>
              </div>
            ) : (
              <button
                onClick={() => docFileInputRef.current?.click()}
                style={{
                  width: '100%', padding: '14px 16px', marginBottom: 12,
                  background: 'var(--surface-2)', border: '1.5px dashed var(--border)',
                  borderRadius: 10, cursor: 'pointer', fontSize: 14,
                  color: 'var(--accent)', fontWeight: 600,
                }}
              >
                Выбрать файл (JPG / PNG / PDF)
              </button>
            )}

            {docFileError && (
              <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10, textAlign: 'center' }}>
                {docFileError}
              </div>
            )}

            {uploadDocMutation.isError && (
              <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10, textAlign: 'center' }}>
                {(uploadDocMutation.error as Error).message || 'Ошибка загрузки'}
              </div>
            )}

            <button
              className="btn"
              disabled={!docFileData || uploadDocMutation.isPending}
              onClick={() => uploadDocMutation.mutate()}
              style={{ fontSize: 15 }}
            >
              {uploadDocMutation.isPending ? 'Загружаем...' : 'Загрузить'}
            </button>

            <input
              ref={docFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={handleDocFileChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
