import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BootstrapData } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import RoleSwitcher from '../../components/RoleSwitcher';

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
  // Use trainer avatar; fall back to client profile avatar (display-only, not auto-saved)
  const clientAvatar = bootstrap.profile?.avatarData ?? null;
  const [localAvatar, setLocalAvatar] = useState<string | null>(tp?.avatarData ?? clientAvatar ?? null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const patchMutation = useMutation({
    mutationFn: api.trainerPatchProfile,
    onSuccess: (data) => {
      if (data.fullName !== undefined) setLocalName(data.fullName ?? '');
      if (data.avatarData !== undefined) setLocalAvatar(data.avatarData);
      queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
    },
  });

  const saveName = () => {
    const trimmed = nameVal.trim();
    patchMutation.mutate({ fullName: trimmed || undefined });
    setLocalName(trimmed);
    setEditingName(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setLocalAvatar(base64);
      patchMutation.mutate({ avatarData: base64 });
    };
    reader.readAsDataURL(file);
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
      }}>
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

        {/* Role switcher */}
        {onSwitchToClient && (
          <div style={{ marginTop: 16, width: '100%' }}>
            <RoleSwitcher mode="coach" onChange={(m) => { if (m === 'client') onSwitchToClient(); }} fullWidth />
          </div>
        )}
      </div>

      {/* Finance section */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '12px 4px 8px' }}>
        Финансы
      </div>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12,
      }}>
        <FinanceRow icon={<IconReferral />} label="Рефералы" path="/referrals" navigate={navigate} />
        <div style={{ borderBottom: 'none' }}>
          <FinanceRow icon={<IconPayout />} label="Начисления и вывод" path="/payouts" navigate={navigate} />
        </div>
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
    </div>
  );
}
