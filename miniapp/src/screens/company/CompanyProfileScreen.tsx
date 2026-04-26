import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, detectPlatform } from '../../api/client';
import type { BootstrapData } from '../../types';
import StatusBadge from '../../components/StatusBadge';

interface Props {
  bootstrap: BootstrapData;
  onSwitchToClient?: () => void;
}

function IconDocs() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
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

function IconRequisites() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2"/>
      <line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/>
    </svg>
  );
}

function IconPartnership() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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

function ProfileRow({ icon, label, path, navigate }: { icon: React.ReactNode; label: string; path: string; navigate: (p: string) => void }) {
  return (
    <button
      onClick={() => navigate(path)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', padding: '15px 20px',
        background: 'none', border: 'none', cursor: 'pointer',
        borderBottom: '1px solid var(--border)', textAlign: 'left',
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
      <span style={{ fontSize: 18, color: 'var(--accent)' }}>›</span>
    </button>
  );
}

/** Parse company bio to extract contact person and phone */
function parseBio(bio: string | null | undefined): { contact: string | null; phone: string | null } {
  if (!bio) return { contact: null, phone: null };
  let contact: string | null = null;
  let phone: string | null = null;
  for (const line of bio.split('\n')) {
    const l = line.trim();
    if (l.startsWith('Контактное лицо:')) contact = l.slice('Контактное лицо:'.length).trim();
    if (l.startsWith('Телефон:')) phone = l.slice('Телефон:'.length).trim();
  }
  return { contact, phone };
}

export default function CompanyProfileScreen({ bootstrap, onSwitchToClient }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tp = bootstrap.trainerProfile;
  const clientAvatar = bootstrap.profile?.avatarData ?? null;
  const [localAvatar, setLocalAvatar] = useState<string | null>(tp?.avatarData ?? clientAvatar ?? null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const patchMutation = useMutation({
    mutationFn: api.trainerPatchProfile,
    onSuccess: (data) => {
      if (data.avatarData !== undefined) setLocalAvatar(data.avatarData);
      queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
    },
  });

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

  const companyName = tp?.fullName || '';
  const initial = companyName ? companyName.charAt(0).toUpperCase() : '?';
  const { contact, phone } = parseBio(tp?.bio);

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 20 }}>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>
          <span style={{ color: 'var(--text)' }}>EATL</span>
          <span style={{ color: 'var(--accent)' }}>YY</span>
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Company</span>
      </div>
      {/* Hero card — same pattern as client/coach profile */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '24px 20px 20px', marginBottom: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative',
      }}>
        {/* Role toggle — top-right, company is always "on" */}
        {onSwitchToClient && (
          <div style={{
            position: 'absolute', top: 14, right: 16,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--accent)' }}>
              Компания
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
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', left: 23,
                width: 18, height: 18, borderRadius: '50%',
                background: '#000',
                boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
              }} />
            </button>
          </div>
        )}

        {/* Avatar */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{
            width: 112, height: 112, borderRadius: 24,
            background: localAvatar ? 'transparent' : 'var(--accent-soft)',
            border: '2px solid rgba(215,255,63,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 44, fontWeight: 700, color: 'var(--accent)',
            overflow: 'hidden',
          }}>
            {localAvatar
              ? <img src={localAvatar} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

        {/* Company name */}
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', textAlign: 'center', marginBottom: 6, lineHeight: 1.2 }}>
          {companyName || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Название не указано</span>}
        </div>

        <StatusBadge status={tp?.verificationStatus ?? 'pending'} />

        {tp?.socialLink && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
            {tp.socialLink}
          </div>
        )}

      </div>

      {/* Реквизиты section */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '12px 4px 8px' }}>
        Реквизиты
      </div>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '14px 18px', marginBottom: 12,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {[
          { label: 'Компания', value: companyName || '—' },
          { label: 'Сайт / соцсеть', value: tp?.socialLink || '—' },
          { label: 'Контактное лицо', value: contact || '—' },
          { label: 'Телефон', value: phone || '—' },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0 }}>
              {row.label}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text)', textAlign: 'right', wordBreak: 'break-word' }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Management section */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '12px 4px 8px' }}>
        Управление
      </div>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        <ProfileRow icon={<IconRequisites />} label="Реквизиты" path="/requisites" navigate={navigate} />
        <ProfileRow icon={<IconDocs />} label="Документы" path="/documents" navigate={navigate} />
        <ProfileRow icon={<IconPartnership />} label="Партнёрство" path="/partnership" navigate={navigate} />
        <div style={{ borderBottom: 'none' }}>
          <ProfileRow icon={<IconPayout />} label="Вывод средств" path="/payouts" navigate={navigate} />
        </div>
      </div>

      {/* Support */}
      <button
        onClick={() => {
          api.trackEvent('support_clicked');
          const url = detectPlatform() === 'max'
            ? (import.meta.env.VITE_SUPPORT_URL_MAX || 'https://t.me/EATLYY_help')
            : 'https://t.me/EATLYY_help';
          window.open(url, '_blank');
        }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '15px 20px', marginTop: 8,
          background: 'var(--surface)', borderRadius: 'var(--r-xl)',
          border: '1px solid var(--border)', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)' }}>Поддержка</span>
        <span style={{ fontSize: 18, color: 'var(--accent)' }}>›</span>
      </button>
    </div>
  );
}
