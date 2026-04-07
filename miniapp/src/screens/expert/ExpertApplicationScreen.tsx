import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useBootstrap } from '../../hooks/useBootstrap';

type ApplicantType = 'expert' | 'company';

export default function ExpertApplicationScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: bootstrap } = useBootstrap();

  const existing = bootstrap?.trainerProfile;
  const isReapply = existing?.verificationStatus === 'rejected';

  // ── applicant type ──
  const [applicantType, setApplicantType] = useState<ApplicantType>('expert');
  const [showTypeInfo, setShowTypeInfo] = useState(false);

  // ── expert fields ──
  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [socialLink, setSocialLink] = useState(existing?.socialLink ?? '');
  const [specialization, setSpecialization] = useState(existing?.specialization ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');

  // ── company fields ──
  const [companyName, setCompanyName] = useState('');
  const [companySocialLink, setCompanySocialLink] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [photoData, setPhotoData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function isValidPhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }

  function normalizePhone(phone: string): string {
    const digits = phone.trim().replace(/\D/g, '');
    if (digits.length === 10) return `+7${digits}`;
    if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) return `+7${digits.slice(1)}`;
    const trimmed = phone.trim();
    return trimmed.startsWith('+') ? trimmed : `+${digits}`;
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoData(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    setPhoneError(null);
    if (applicantType === 'expert') {
      if (!fullName.trim() || !socialLink.trim()) {
        setError('Заполни все обязательные поля');
        return;
      }
    } else {
      if (!companyName.trim() || !companySocialLink.trim()) {
        setError('Заполни все обязательные поля');
        return;
      }
      if (!companyPhone.trim()) {
        setPhoneError('Введи номер телефона');
        return;
      }
      if (!isValidPhone(companyPhone)) {
        setPhoneError('Некорректный номер телефона');
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      if (applicantType === 'company') {
        const phoneLine = `Телефон: ${normalizePhone(companyPhone)}`;
        const companyBio = contactPerson.trim()
          ? `Контактное лицо: ${contactPerson.trim()}\n${phoneLine}`
          : phoneLine;
        await api.expertApply({
          fullName: companyName.trim(),
          socialLink: companySocialLink.trim(),
          specialization: 'Компания',
          bio: companyBio,
        });
      } else {
        await api.expertApply({
          fullName,
          socialLink,
          documentLink: '-',
          specialization,
          bio,
          verificationPhotoData: photoData ?? undefined,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
      navigate('/profile', { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки заявки');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/profile')}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >
          ‹
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
          {isReapply ? 'Повторная заявка' : 'Стать экспертом'}
        </h1>
      </div>

      {/* Type switcher */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '14px 18px', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* Segment control — stretched */}
        <div style={{
          flex: 1, display: 'flex', background: 'var(--surface-2)',
          borderRadius: 10, padding: 3, border: '1px solid var(--border)',
        }}>
          {(['expert', 'company'] as ApplicantType[]).map(t => {
            const active = applicantType === t;
            return (
              <button
                key={t}
                onClick={() => { setApplicantType(t); setError(null); }}
                style={{
                  flex: 1, padding: '7px 8px', fontSize: 13, fontWeight: 600,
                  borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--surface-3)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-3)',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
                  transition: 'background 0.15s, color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {t === 'expert' ? 'Эксперт' : 'Компания'}
              </button>
            );
          })}
        </div>

        {/* Help button — fixed width */}
        <button
          onClick={() => setShowTypeInfo(true)}
          style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-3)', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, padding: 0,
          }}
        >
          ?
        </button>
      </div>

      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '16px 18px', marginBottom: 12,
      }}>
        <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.55, margin: 0 }}>
          {applicantType === 'expert'
            ? 'Заполни анкету — мы проверим её в течение 1–3 рабочих дней. После подтверждения ты сможешь работать с клиентами в режиме Эксперта.'
            : 'Заполни данные компании — мы свяжемся с контактным лицом для подтверждения. После верификации компания получит доступ к работе с клиентами.'}
        </p>
      </div>

      {/* Required fields */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '18px 18px', marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 14 }}>
          Обязательные поля
        </div>

        {applicantType === 'expert' ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Имя и фамилия</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Иван Иванов"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Ссылка на соцсеть или сайт</label>
              <input
                value={socialLink}
                onChange={e => setSocialLink(e.target.value)}
                placeholder="https://instagram.com/..."
                style={inputStyle}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Название компании</label>
              <input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="ООО «Фитнес Плюс»"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Соцсеть или сайт</label>
              <input
                value={companySocialLink}
                onChange={e => setCompanySocialLink(e.target.value)}
                placeholder="https://example.com"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Контактное лицо</label>
              <input
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder="Имя, должность"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Номер телефона</label>
              <input
                value={companyPhone}
                onChange={e => { setCompanyPhone(e.target.value); setPhoneError(null); }}
                placeholder="+7 999 123-45-67"
                inputMode="tel"
                style={{ ...inputStyle, borderColor: phoneError ? 'var(--danger)' : undefined }}
              />
              {phoneError && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 5 }}>
                  {phoneError}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Verification photo — expert only */}
      {applicantType === 'expert' && <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', padding: '18px 18px', marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 14 }}>
          Подтверждение личности
        </div>

        <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 16 }}>
          {applicantType === 'expert'
            ? 'Сделайте фото, чтобы подтвердить сходство с сайтом или соцсетью'
            : 'Сделайте фото представителя компании для верификации'}
        </div>

        {photoData ? (
          <div style={{ position: 'relative', marginBottom: 0 }}>
            <img
              src={photoData}
              alt="Фото верификации"
              style={{
                width: '100%', borderRadius: 12, objectFit: 'cover',
                maxHeight: 220, display: 'block',
                border: '2px solid var(--accent)',
              }}
            />
            <button
              onClick={() => { setPhotoData(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', border: 'none',
                color: '#fff', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%', padding: '20px 16px',
              background: 'var(--surface-2)', border: '1.5px dashed var(--border)',
              borderRadius: 12, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                Сделать фото
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Нажмите, чтобы открыть камеру
              </div>
            </div>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          style={{ display: 'none' }}
          onChange={handlePhotoChange}
        />
      </div>}

      {/* Optional fields — expert only */}
      {applicantType === 'expert' && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-xl)',
          border: '1px solid var(--border)', padding: '18px 18px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 14 }}>
            Дополнительно
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Специализация</label>
            <input
              value={specialization}
              onChange={e => setSpecialization(e.target.value)}
              placeholder="Силовые тренировки, похудение..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>О себе</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Расскажи о своём опыте и подходе..."
              rows={3}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>
        </div>
      )}

      {error && (
        <div style={{
          color: 'var(--danger)', fontSize: 13, marginBottom: 12,
          padding: '10px 14px', background: 'rgba(255,59,48,0.1)',
          borderRadius: 10, border: '1px solid rgba(255,59,48,0.2)',
        }}>
          {error}
        </div>
      )}

      <button className="btn" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Отправляем...' : 'Отправить заявку'}
      </button>

      {/* Type info bottom sheet */}
      {showTypeInfo && (
        <>
          <div
            onClick={() => setShowTypeInfo(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200 }}
          />
          <div className="bottom-sheet">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.3 }}>
                Тип заявки
              </span>
              <button
                onClick={() => setShowTypeInfo(false)}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'var(--surface-2)', border: 'none',
                  color: 'var(--text-3)', fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                }}
              >✕</button>
            </div>
            {[
              {
                title: 'Эксперт',
                desc: 'Частный специалист: тренер, нутрициолог, диетолог и т.д. Работаете лично с клиентами под своим именем.',
              },
              {
                title: 'Компания',
                desc: 'Фитнес-клуб, клиника, студия или другая организация. Подключаете сотрудников и ведёте клиентов от имени бренда.',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                style={{
                  padding: i === 0 ? '0 0 14px' : '14px 0 0',
                  borderTop: i === 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-3)',
  display: 'block',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 15,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};
