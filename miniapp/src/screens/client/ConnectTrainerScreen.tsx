import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { TrainerLookupResult } from '../../types';

type Step = 'code' | 'preview' | 'rights' | 'done';
type ConnectMode = 'code' | 'direct';  // 'code' = via code, 'direct' = via trainerId from list

const HISTORY_OPTIONS = [
  { value: false, label: 'С момента подключения', desc: 'Эксперт видит только новые записи' },
  { value: true,  label: 'Вся история',            desc: 'Эксперт видит все ваши записи' },
];

const PHOTOS_OPTIONS = [
  { value: true,  label: 'С фотографиями', desc: 'Эксперт видит прикреплённые фото' },
  { value: false, label: 'Без фотографий', desc: 'Эксперт видит только текст и данные' },
];

// ─── QR scanner ────────────────────────────────────────────────────────────

function extractCode(raw: string): string | null {
  // Formats:
  // 1) https://t.me/BOTNAME?start=connect_XXXXXX
  // 2) connect_XXXXXX
  // 3) XXXXXX (raw 6-digit numeric code)
  const startMatch = raw.match(/[?&]start=connect_(\d{6})/i);
  if (startMatch) return startMatch[1];
  const connectMatch = raw.match(/connect_(\d{6})/i);
  if (connectMatch) return connectMatch[1];
  const rawCode = raw.trim().replace(/\D/g, '');
  if (rawCode.length === 6) return rawCode;
  return null;
}

interface QrScannerModalProps {
  onCode: (code: string) => void;
  onClose: () => void;
}

function QrScannerModal({ onCode, onClose }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);
  const detectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      // Check BarcodeDetector support
      if (!('BarcodeDetector' in window)) {
        setError('Сканирование QR недоступно в этом браузере. Введите код вручную.');
        setStarting(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStarting(false);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });

        async function tick() {
          if (cancelled || detectedRef.current) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
          ctx.drawImage(video, 0, 0);
          try {
            const barcodes = await detector.detect(canvas);
            if (barcodes.length > 0 && !detectedRef.current) {
              const raw = barcodes[0].rawValue as string;
              const code = extractCode(raw);
              if (code) {
                detectedRef.current = true;
                onCode(code);
                return;
              }
            }
          } catch { /* detection frame error — ignore */ }
          rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        const e = err as { name?: string };
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setError('Доступ к камере запрещён. Разрешите доступ в настройках или введите код вручную.');
        } else {
          setError('Не удалось запустить камеру. Введите код вручную.');
        }
        setStarting(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Сканировать QR-код</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
        </div>

        {/* Viewfinder area */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {error ? (
            <div style={{ padding: '0 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: 20 }}>{error}</div>
              <button className="btn btn-secondary" style={{ fontSize: 14 }} onClick={onClose}>
                Закрыть
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {/* Viewfinder frame */}
              <div style={{
                position: 'relative', zIndex: 1,
                width: 220, height: 220,
                border: '2px solid rgba(215,255,63,0.6)',
                borderRadius: 16,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
              }}>
                {/* Corner accents */}
                {(['tl','tr','bl','br'] as const).map(corner => (
                  <div key={corner} style={{
                    position: 'absolute',
                    width: 22, height: 22,
                    borderColor: 'var(--accent)',
                    borderStyle: 'solid',
                    borderWidth: 0,
                    ...(corner === 'tl' ? { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3, borderRadius: '12px 0 0 0' } : {}),
                    ...(corner === 'tr' ? { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3, borderRadius: '0 12px 0 0' } : {}),
                    ...(corner === 'bl' ? { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3, borderRadius: '0 0 0 12px' } : {}),
                    ...(corner === 'br' ? { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3, borderRadius: '0 0 12px 0' } : {}),
                  }} />
                ))}
              </div>
              {starting && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
                  <div className="spinner" style={{ borderTopColor: 'var(--accent)' }} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Hint */}
        {!error && (
          <div style={{ padding: '16px 32px 32px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
              Наведите камеру на QR-код эксперта
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

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
  const [showQr, setShowQr] = useState(false);

  // Pre-fill code from URL param or sessionStorage; handle trainerId param from trainer list
  useEffect(() => {
    const urlCode = searchParams.get('code');
    const urlTrainerId = searchParams.get('trainerId');
    const sessionCode = sessionStorage.getItem('pendingConnectCode');
    const initial = urlCode ?? sessionCode ?? '';
    if (initial) {
      sessionStorage.removeItem('pendingConnectCode');
      setCode(initial.toUpperCase());
    }
    // If trainerId is provided (from trainer list), start a direct lookup
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
      setStep('preview');
    },
    onError: (err: Error) => {
      setLookupError(err.message.includes('not found') ? 'Код не найден или истёк. Попроси эксперта обновить код.' : err.message);
    },
  });

  const directLookupMutation = useMutation({
    mutationFn: (tid: string) => api.trainerLookupById(tid),
    onSuccess: (data) => {
      setTrainer(data);
      setLookupError('');
      setStep('preview');
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

  function handleQrCode(scannedCode: string) {
    setShowQr(false);
    setCode(scannedCode);
    setConnectMode('code');
    setLookupError('');
    // Auto-trigger lookup
    setTimeout(() => {
      api.trainerLookup(scannedCode)
        .then(data => { setTrainer(data); setStep('preview'); })
        .catch(() => setLookupError('Код не найден или истёк.'));
    }, 0);
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
          onClick={() => step === 'code' ? navigate(-1) : setStep(step === 'rights' ? 'preview' : 'code')}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >
          ‹
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
          {step === 'code' ? 'Подключить эксперта' : step === 'preview' ? 'Ваш эксперт' : 'Права доступа'}
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
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5))}
              placeholder="Например: AB3X7"
              maxLength={5}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', padding: '16px', fontSize: 28,
                fontWeight: 700, letterSpacing: 6, textAlign: 'center',
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
            style={{ fontSize: 14, marginBottom: 10 }}
            onClick={() => setShowQr(true)}
          >
            Сканировать QR-код
          </button>

          {/* Browse trainer list */}
          <button
            className="btn btn-ghost"
            style={{ fontSize: 14 }}
            onClick={() => navigate('/trainers')}
          >
            Найти эксперта в каталоге
          </button>
        </div>
      )}

      {/* Step 2: Trainer preview */}
      {step === 'preview' && trainer && (
        <div>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r-xl)',
            padding: 20, border: '1px solid var(--border)', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: trainer.specialization || trainer.bio ? 14 : 0 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-soft)', border: '2px solid rgba(215,255,63,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 700, color: 'var(--accent)',
              }}>
                {trainer.fullName?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                  {trainer.fullName ?? 'Эксперт'}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-soft)', borderRadius: 20, padding: '3px 10px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>✓ Верифицирован</span>
                </div>
              </div>
            </div>
            {trainer.specialization && (
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: trainer.bio ? 8 : 0 }}>
                <span style={{ color: 'var(--text-3)' }}>Специализация: </span>{trainer.specialization}
              </div>
            )}
            {trainer.bio && (
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{trainer.bio}</div>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginBottom: 20 }}>
            Это ваш эксперт? Нажмите «Продолжить» чтобы выбрать права доступа.
          </div>
          <button className="btn" style={{ fontSize: 15, marginBottom: 10 }} onClick={() => setStep('rights')}>
            Продолжить →
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 14 }} onClick={() => { setStep('code'); setTrainer(null); setConnectMode('code'); }}>
            Это не мой эксперт
          </button>
        </div>
      )}

      {/* Step 3: Rights selection */}
      {step === 'rights' && (
        <div>
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

      {/* QR scanner overlay */}
      {showQr && (
        <QrScannerModal
          onCode={handleQrCode}
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}
