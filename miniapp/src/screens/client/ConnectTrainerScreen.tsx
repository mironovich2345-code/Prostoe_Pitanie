import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { TrainerLookupResult } from '../../types';

type Step = 'code' | 'preview' | 'rights' | 'done';

const HISTORY_OPTIONS = [
  { value: false, label: 'С момента подключения', desc: 'Тренер видит только новые записи' },
  { value: true,  label: 'Вся история',            desc: 'Тренер видит все ваши записи' },
];

const PHOTOS_OPTIONS = [
  { value: true,  label: 'С фотографиями', desc: 'Тренер видит прикреплённые фото' },
  { value: false, label: 'Без фотографий', desc: 'Тренер видит только текст и данные' },
];

export default function ConnectTrainerScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [trainer, setTrainer] = useState<TrainerLookupResult | null>(null);
  const [fullHistoryAccess, setFullHistoryAccess] = useState(false);
  const [canViewPhotos, setCanViewPhotos] = useState(true);
  const [lookupError, setLookupError] = useState('');

  // Pre-fill code from URL param or sessionStorage
  useEffect(() => {
    const urlCode = searchParams.get('code');
    const sessionCode = sessionStorage.getItem('pendingConnectCode');
    const initial = urlCode ?? sessionCode ?? '';
    if (initial) {
      sessionStorage.removeItem('pendingConnectCode');
      setCode(initial.toUpperCase());
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
      setLookupError(err.message.includes('not found') ? 'Код не найден или истёк. Попроси тренера обновить код.' : err.message);
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => api.trainerConnect({ code, fullHistoryAccess, canViewPhotos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bootstrap'] });
      setStep('done');
    },
  });

  if (step === 'done') {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', gap: 16 }}>
        <div style={{ fontSize: 64 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Тренер подключён!</div>
        <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>
          {trainer?.fullName ?? 'Тренер'} теперь видит ваши данные с выбранными правами доступа.
        </div>
        <button className="btn" style={{ marginTop: 8, padding: '13px 32px' }} onClick={() => navigate('/trainer')}>
          Перейти к тренеру
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
          {step === 'code' ? 'Подключить тренера' : step === 'preview' ? 'Ваш тренер' : 'Права доступа'}
        </div>
      </div>

      {/* Step 1: Code entry */}
      {step === 'code' && (
        <div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
            Попросите тренера показать вам 5-значный код для подключения и введите его ниже.
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
            disabled={code.length < 5 || lookupMutation.isPending}
            onClick={() => lookupMutation.mutate()}
            style={{ fontSize: 15 }}
          >
            {lookupMutation.isPending ? 'Поиск...' : 'Найти тренера →'}
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
                  {trainer.fullName ?? 'Тренер'}
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
            Это ваш тренер? Нажмите «Продолжить» чтобы выбрать права доступа.
          </div>
          <button className="btn" style={{ fontSize: 15, marginBottom: 10 }} onClick={() => setStep('rights')}>
            Продолжить →
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 14 }} onClick={() => { setStep('code'); setTrainer(null); }}>
            Это не мой тренер
          </button>
        </div>
      )}

      {/* Step 3: Rights selection */}
      {step === 'rights' && (
        <div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
            Выберите, какой доступ получит тренер к вашим данным. Вы сможете изменить это позже.
          </div>

          {/* History scope */}
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

          {/* Photos */}
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
                ? 'У вас уже есть активный тренер. Сначала отключите его.'
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
