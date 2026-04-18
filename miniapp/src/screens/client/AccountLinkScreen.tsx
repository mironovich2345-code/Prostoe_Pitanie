/**
 * AccountLinkScreen — cross-platform account linking (Telegram ↔ MAX).
 *
 * Two modes in one screen:
 *   "Создать код"  — second account creates a one-time code and waits for confirmation
 *   "Ввести код"   — first (canonical) account enters the code to confirm the link
 *
 * Backend endpoints consumed:
 *   POST   /api/account-link/request   — create / replace pending request, get code
 *   GET    /api/account-link/pending   — poll status of outgoing request
 *   POST   /api/account-link/confirm   — canonical account confirms with code
 *   DELETE /api/account-link/request   — cancel pending outgoing request
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'истёк';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// ─── CreateCodeTab — second account creates code ───────────────────────────

function CreateCodeTab() {
  const qc = useQueryClient();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [confirmedMsg, setConfirmedMsg] = useState<string | null>(null);
  const [wasExpired, setWasExpired] = useState(false);

  // Poll pending status every 5 s while the tab is visible
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['account-link-pending'],
    queryFn: api.accountLinkPending,
    refetchInterval: (query) => {
      // Keep polling while there's a pending code (to detect confirmation)
      return query.state.data?.pending ? 5000 : false;
    },
    refetchIntervalInBackground: false,
  });

  const pending = pendingData?.pending ?? null;

  // Tick the countdown every second while code is live
  useEffect(() => {
    if (!pending) return;
    const update = () => setTimeLeft(formatTimeLeft(pending.expiresAt));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [pending?.expiresAt]);

  // Detect expiry: pending gone after being present → could be confirmed or expired
  const prevPending = useQuery({ queryKey: ['account-link-pending'] });
  useEffect(() => {
    if (!pendingLoading && !pending && !confirmedMsg) {
      // If the request was previously present and is now gone (TTL expired on server side)
      setWasExpired(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, pendingLoading]);

  const requestMutation = useMutation({
    mutationFn: api.accountLinkRequest,
    onSuccess: () => {
      setWasExpired(false);
      setConfirmedMsg(null);
      qc.invalidateQueries({ queryKey: ['account-link-pending'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: api.accountLinkCancel,
    onSuccess: () => {
      setWasExpired(false);
      qc.invalidateQueries({ queryKey: ['account-link-pending'] });
    },
  });

  // Created code from mutation before the pending query has refreshed
  const freshCode = requestMutation.data;
  const displayCode = freshCode?.code ?? pending?.code ?? null;
  const displayExpiry = freshCode?.expiresAt ?? (pending ? pending.expiresAt : null);
  const isExpiredLocally = displayExpiry ? new Date(displayExpiry).getTime() <= Date.now() : false;

  // ── Success: pending confirmed ────────────────────────────────────────────
  // We detect confirmation by polling — when pending is gone after a mutation was run,
  // we show the success message. We can't distinguish confirmed vs expired here without
  // a status field, so we rely on GET /pending returning null when confirmed too.
  // The backend also marks expired on TTL. We show a neutral "code is gone" state
  // and let the user re-create if they haven't seen a success yet.

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
        Используйте этот режим, если вы хотите связать <strong style={{ color: 'var(--text)' }}>этот</strong> аккаунт
        с основным аккаунтом в другой платформе.
      </div>

      {/* ── No active code ── */}
      {!displayCode && !pendingLoading && (
        <div>
          {wasExpired && !requestMutation.isSuccess && (
            <div style={{
              background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.35)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 16,
              fontSize: 13, color: '#FF9500', lineHeight: 1.5,
            }}>
              Код истёк или был отменён. Создайте новый.
            </div>
          )}
          {requestMutation.isError && (
            <div style={{
              background: 'rgba(255,59,48,0.10)', border: '1px solid rgba(255,59,48,0.3)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 16,
              fontSize: 13, color: 'var(--danger)', lineHeight: 1.5,
            }}>
              {(requestMutation.error as Error)?.message || 'Ошибка создания кода. Попробуйте снова.'}
            </div>
          )}
          <div style={{
            background: 'var(--surface-2)', borderRadius: 14, padding: '20px 18px',
            border: '1px solid var(--border)', marginBottom: 16, textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.5 }}>
              Нажмите «Создать код», затем введите его в основном аккаунте
              в разделе <strong style={{ color: 'var(--text-2)' }}>Связать аккаунт → Ввести код</strong>.
            </div>
            <button
              className="btn"
              disabled={requestMutation.isPending}
              onClick={() => requestMutation.mutate()}
              style={{ width: 'auto', padding: '12px 32px', fontSize: 15, display: 'inline-block' }}
            >
              {requestMutation.isPending ? 'Создаём...' : 'Создать код'}
            </button>
          </div>
        </div>
      )}

      {pendingLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div className="spinner" />
        </div>
      )}

      {/* ── Active code display ── */}
      {displayCode && !isExpiredLocally && (
        <div>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '24px 20px',
            border: '1px solid var(--border)', marginBottom: 12, textAlign: 'center',
          }}>
            {/* Code */}
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 10 }}>
              Ваш код
            </div>
            <div style={{
              fontSize: 40, fontWeight: 800, letterSpacing: 8,
              color: 'var(--accent)', fontFamily: 'monospace',
              marginBottom: 8,
            }}>
              {displayCode}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
              Действителен ещё:{' '}
              <span style={{ fontWeight: 700, color: timeLeft === 'истёк' ? 'var(--danger)' : 'var(--text-2)' }}>
                {timeLeft || '...'}
              </span>
            </div>

            {/* Instruction steps */}
            <div style={{
              background: 'var(--surface-2)', borderRadius: 12, padding: '14px 16px',
              border: '1px solid var(--border)', textAlign: 'left',
            }}>
              {[
                'Откройте EATLY в основном аккаунте (другой платформе)',
                'Перейдите в Профиль → Связать аккаунт',
                'Выберите «Ввести код» и введите этот код',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: i < 2 ? 10 : 0 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45, paddingTop: 2 }}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Waiting indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 13, color: 'var(--text-3)', marginBottom: 12,
          }}>
            <div className="spinner" style={{ width: 14, height: 14 }} />
            Ожидаем подтверждения…
          </div>

          {/* Cancel */}
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            style={{
              width: '100%', padding: '12px', borderRadius: 12,
              background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)',
              color: 'var(--danger)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {cancelMutation.isPending ? 'Отменяем...' : 'Отменить запрос'}
          </button>
        </div>
      )}

      {/* ── Code locally expired ── */}
      {displayCode && isExpiredLocally && (
        <div style={{
          background: 'rgba(255,149,0,0.10)', border: '1px solid rgba(255,149,0,0.3)',
          borderRadius: 12, padding: '16px', marginBottom: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#FF9500', marginBottom: 6 }}>Код истёк</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>
            Время действия кода вышло. Создайте новый.
          </div>
          <button
            className="btn"
            disabled={requestMutation.isPending}
            onClick={() => { requestMutation.mutate(); }}
            style={{ width: 'auto', padding: '11px 28px', display: 'inline-block', fontSize: 14 }}
          >
            {requestMutation.isPending ? 'Создаём...' : 'Создать новый код'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ConfirmCodeTab — first (canonical) account enters code ────────────────

function ConfirmCodeTab() {
  const [code, setCode] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const confirmMutation = useMutation({
    mutationFn: (c: string) => api.accountLinkConfirm(c),
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Аккаунты успешно связаны!');
      setErrorMsg(null);
      setCode('');
    },
    onError: (err: Error) => {
      // Backend returns descriptive Russian error messages
      setErrorMsg(err.message || 'Ошибка подтверждения. Проверьте код и попробуйте снова.');
    },
  });

  function handleConfirm() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setErrorMsg('Код должен содержать 6 символов');
      return;
    }
    setErrorMsg(null);
    confirmMutation.mutate(trimmed);
  }

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
        Введите код, который показан в{' '}
        <strong style={{ color: 'var(--text)' }}>другом аккаунте</strong>{' '}
        (в режиме «Создать код»), чтобы связать аккаунты.
      </div>

      {/* Success */}
      {successMsg && (
        <div style={{
          background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.4)',
          borderRadius: 14, padding: '20px 18px', marginBottom: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#4CAF50', marginBottom: 6 }}>
            Аккаунты успешно связаны
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
            {successMsg}
          </div>
        </div>
      )}

      {!successMsg && (
        <>
          {/* Code input */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 8 }}>
              Код подтверждения
            </div>
            <input
              value={code}
              onChange={e => {
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                setErrorMsg(null);
              }}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="A3F2B1"
              maxLength={6}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '14px 16px', fontSize: 28, fontWeight: 800,
                letterSpacing: 8, textAlign: 'center',
                fontFamily: 'monospace',
                borderRadius: 12, background: 'var(--surface-2)',
                border: errorMsg ? '1.5px solid var(--danger)' : '1px solid var(--border)',
                color: 'var(--accent)', outline: 'none',
                textTransform: 'uppercase',
              }}
            />
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{
              background: 'rgba(255,59,48,0.10)', border: '1px solid rgba(255,59,48,0.3)',
              borderRadius: 10, padding: '11px 14px', marginBottom: 14,
              fontSize: 13, color: 'var(--danger)', lineHeight: 1.5,
            }}>
              {errorMsg}
            </div>
          )}

          {/* Confirm button */}
          <button
            className="btn"
            disabled={code.trim().length !== 6 || confirmMutation.isPending}
            onClick={handleConfirm}
            style={{ fontSize: 15 }}
          >
            {confirmMutation.isPending ? 'Подтверждаем...' : 'Подтвердить'}
          </button>

          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
            Код вводится из другого аккаунта (режим «Создать код»)
          </div>
        </>
      )}
    </div>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

type LinkTab = 'create' | 'confirm';

export default function AccountLinkScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<LinkTab>('create');

  return (
    <div className="screen">
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ← Назад
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 4 }}>
        Связать аккаунт
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
        Объедините аккаунты Telegram и MAX, чтобы история питания, эксперт и настройки были одинаковы в обеих платформах.
      </div>

      {/* Tabs */}
      <div className="period-tabs" style={{ marginBottom: 20 }}>
        <button
          onClick={() => setTab('create')}
          className={`period-tab${tab === 'create' ? ' active' : ''}`}
        >
          Создать код
        </button>
        <button
          onClick={() => setTab('confirm')}
          className={`period-tab${tab === 'confirm' ? ' active' : ''}`}
        >
          Ввести код
        </button>
      </div>

      {tab === 'create'  && <CreateCodeTab />}
      {tab === 'confirm' && <ConfirmCodeTab />}
    </div>
  );
}
