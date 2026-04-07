import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { TrainerLookupResult } from '../../types';

type Step = 'code' | 'rights' | 'done';
type ConnectMode = 'code' | 'direct';

const HISTORY_OPTIONS = [
  { value: false, label: 'С момента подключения', desc: 'Эксперт видит только новые записи' },
  { value: true,  label: 'Вся история',            desc: 'Эксперт видит все ваши записи' },
];

const PHOTOS_OPTIONS = [
  { value: true,  label: 'С фотографиями', desc: 'Эксперт видит прикреплённые фото' },
  { value: false, label: 'Без фотографий', desc: 'Эксперт видит только текст и данные' },
];

function extractCode(raw: string): string | null {
  // 1) https://t.me/BOTNAME?start=connect_XXXXXX
  const startMatch = raw.match(/[?&]start=connect_(\d{6})/i);
  if (startMatch) return startMatch[1];
  // 2) connect_XXXXXX
  const connectMatch = raw.match(/connect_(\d{6})/i);
  if (connectMatch) return connectMatch[1];
  // 3) raw 6-digit numeric code
  const rawCode = raw.trim().replace(/\D/g, '');
  if (rawCode.length === 6) return rawCode;
  return null;
}

export default function ConnectTrainerScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>('code');
  const [connectMode, setConnectMode] = useState<ConnectMode>('code');
  const [code, setCode] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [trainer, setTrainer] = useState<TrainerLookupResult | null>(null);
  const [fullHistoryAccess, setFullHistoryAccess] = useState(false);
  const [canViewPhotos, setCanViewPhotos] = useState(true);
  const [lookupError, setLookupError] = useState('');
  const [qrUnavailable, setQrUnavailable] = useState(false);

  useEffect(() => {
    const urlCode = searchParams.get('code');
    const urlTrainerId = searchParams.get('trainerId');
    const sessionCode = sessionStorage.getItem('pendingConnectCode');
    const initial = urlCode ?? sessionCode ?? '';
    if (initial) {
      sessionStorage.removeItem('pendingConnectCode');
      setCode(initial.replace(/\D/g, '').slice(0, 6));
    }
    if (urlTrainerId) {
      setTrainerId(urlTrainerId);
      setConnectMode('direct');
      directLookupMutation.mutate(urlTrainerId);
    }
  }, []);

  const lookupMutation = useMutation({
    mutationFn: () => api.trainerLookup(code),
    onSuccess: (data) => {
      setTrainer(data);
      setLookupError('');
      setStep('rights');
    },
    onError: (err: Error) => {
      setLookupError(err.message.includes('not found') ? 'Код не найден. Попроси эксперта уточнить код.' : err.message);
    },
  });

  const directLookupMutation = useMutation({
    mutationFn: (tid: string) => api.trainerLookupById(tid),
    onSuccess: (data) => {
      setTrainer(data);
      setLookupError('');
      setStep('rights');
    },
    onError: () => {
      setLookupError('Эксперт не найден или недоступен.');
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => connectMode === 'direct'
      ? api.trainerConnectDirect({ trainerId, fullHistoryAccess, canViewPhotos })
      : api.trainerConnect({ code, fullHistoryAccess, canViewPhotos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bootstrap'] });
      setStep('done');
    },
  });

  function handleScanQr() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tg = (window as any).Telegram?.WebApp;
    if (typeof tg?.showScanQrPopup === 'function') {
      setQrUnavailable(false);
      tg.showScanQrPopup(
        { text: 'Наведите камеру на QR-код эксперта' },
        (scannedText: string) => {
          const parsed = extractCode(scannedText);
          if (parsed) {
            tg.closeScanQrPopup?.();
            setCode(parsed);
            setConnectMode('code');
            setLookupError('');
            api.trainerLookup(parsed)
              .then(data => { setTrainer(data); setStep('rights'); })
              .catch(() => setLookupError('Код не найден. Попробуй ввести вручную.'));
            return true;
          }
          return false;
        }
      );
    } else {
      setQrUnavailable(true);
    }
  }

  // ── DONE ──────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Эксперт подключён!</div>
        <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>
          {trainer?.fullName ?? 'Эксперт'} теперь видит ваши данные с выбранными правами доступа.
        </div>
        <button className="btn" style={{ marginTop: 8, padding: '13px 32px' }} onClick={() => navigate('/trainer')}>
          Перейти к эксперту
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => step === 'code' ? navigate(-1) : setStep('code')}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >
          ‹
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
          {step === 'code' ? 'Подключить эксперта' : 'Права доступа'}
        </div>
      </div>

      {/* Step 1: Code entry */}
      {step === 'code' && (
        <div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
            Попросите эксперта показать вам 6-значный код для подключения и введите его ниже.
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              value={code}
              onChange={e => {
                setQrUnavailable(false);
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', padding: '16px', fontSize: 28,
                fontWeight: 700, letterSpacing: 8, textAlign: 'center',
                color: 'var(--text)', outline: 'none', fontFamily: 'monospace',
              }}
            />
          </div>
          {lookupError && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{lookupError}</div>
          )}
          <button
            className="btn"
            disabled={code.length < 6 || lookupMutation.isPending}
            onClick={() => { setConnectMode('code'); lookupMutation.mutate(); }}
            style={{ fontSize: 15, marginBottom: 10 }}
          >
            {lookupMutation.isPending ? 'Поиск...' : 'Найти эксперта →'}
          </button>

          {/* QR scan button */}
          <button
            className="btn btn-secondary"
            style={{ fontSize: 14, marginBottom: qrUnavailable ? 8 : 10 }}
            onClick={handleScanQr}
          >
            Сканировать QR-код
          </button>

          {/* QR unavailable inline hint */}
          {qrUnavailable && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)', padding: '12px 16px',
              marginBottom: 10,
              fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, textAlign: 'center',
            }}>
              Сканирование недоступно в этом браузере — введите код вручную
            </div>
          )}

          {/* Browse expert list */}
          <button
            className="btn btn-ghost"
            style={{ fontSize: 14 }}
            onClick={() => navigate('/trainers')}
          >
            Найти эксперта в каталоге
          </button>
        </div>
      )}

      {/* Step 2: Rights selection */}
      {step === 'rights' && (
        <div>
          {trainer && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border)', padding: '12px 16px',
              marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: 'var(--accent)',
              }}>
                {trainer.fullName?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {trainer.fullName ?? 'Эксперт'}
                </div>
                {trainer.specialization && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{trainer.specialization}</div>
                )}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent-soft)', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>✓ Верифицирован</span>
              </div>
            </div>
          )}

          <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
            Выберите, какой доступ получит эксперт к вашим данным. Вы сможете изменить это позже.
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8 }}>
            История питания
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {HISTORY_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setFullHistoryAccess(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  background: 'var(--surface)', border: `2px solid ${fullHistoryAccess === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${fullHistoryAccess === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: fullHistoryAccess === opt.value ? 'var(--accent)' : 'transparent',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {PHOTOS_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setCanViewPhotos(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  background: 'var(--surface)', border: `2px solid ${canViewPhotos === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${canViewPhotos === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: canViewPhotos === opt.value ? 'var(--accent)' : 'transparent',
                }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {connectMutation.isError && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
              {(connectMutation.error as Error).message.includes('active trainer')
                ? 'У вас уже есть активный эксперт. Сначала отключите его.'
                : (connectMutation.error as Error).message || 'Ошибка подключения. Попробуйте ещё раз.'}
            </div>
          )}

          <button
            className="btn"
            style={{ fontSize: 15 }}
            disabled={connectMutation.isPending}
            onClick={() => connectMutation.mutate()}
          >
            {connectMutation.isPending ? 'Подключаем...' : '✓ Подтвердить подключение'}
          </button>
        </div>
      )}
    </div>
  );
}
