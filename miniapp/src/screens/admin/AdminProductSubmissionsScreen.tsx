import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ProductSubmission } from '../../types';

const STATUS_TABS = [
  { key: 'pending',  label: 'На проверке' },
  { key: 'approved', label: 'Одобрены'    },
  { key: 'rejected', label: 'Отклонены'  },
] as const;

const CONFIDENCE_OPTIONS = [
  { value: 'high',   label: 'Высокая' },
  { value: 'medium', label: 'Средняя' },
  { value: 'low',    label: 'Низкая'  },
] as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function MacroChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
      {label} <span style={{ fontWeight: 600, color }}>{value}</span>г
    </span>
  );
}

// ─── Lazy photo component ────────────────────────────────────────────────────

function SubmissionPhoto({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const [visible, setVisible] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  async function load() {
    if (url || loading) return;
    setLoading(true);
    try {
      const blobUrl = await api.adminProductSubmissionPhoto(id);
      urlRef.current = blobUrl;
      setUrl(blobUrl);
      setVisible(true);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }

  if (!visible && !url) {
    return (
      <button
        onClick={load}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: '4px 0' }}
      >
        {loading ? 'Загрузка...' : err ? 'Ошибка загрузки фото' : 'Показать фото'}
      </button>
    );
  }

  return (
    <>
      {url && (
        <img
          src={url}
          alt="product"
          style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 6 }}
        />
      )}
      <button
        onClick={() => setVisible(false)}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: '4px 0' }}
      >
        Скрыть фото
      </button>
    </>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

function SubmissionCard({ sub, onAction }: { sub: ProductSubmission; onAction: () => void }) {
  const qc = useQueryClient();
  const isPending = sub.status === 'pending';

  // Edit form state
  const [showEdit, setShowEdit] = useState(false);
  const [editName,   setEditName]   = useState(sub.name);
  const [editBrand,  setEditBrand]  = useState(sub.brand ?? '');
  const [editCal,    setEditCal]    = useState(String(sub.caloriesPer100g));
  const [editPro,    setEditPro]    = useState(String(sub.proteinPer100g));
  const [editFat,    setEditFat]    = useState(String(sub.fatPer100g));
  const [editCarb,   setEditCarb]   = useState(String(sub.carbsPer100g));
  const [editConf,   setEditConf]   = useState<'high' | 'medium' | 'low'>('medium');

  // Reject state
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-product-submissions'] });
    onAction();
  };

  const approveMutation = useMutation({
    mutationFn: () => api.adminApproveProductSubmission(sub.id, showEdit ? {
      name:            editName.trim(),
      brand:           editBrand.trim() || null,
      caloriesPer100g: parseFloat(editCal),
      proteinPer100g:  parseFloat(editPro),
      fatPer100g:      parseFloat(editFat),
      carbsPer100g:    parseFloat(editCarb),
      confidence:      editConf,
    } : { confidence: editConf }),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.adminRejectProductSubmission(sub.id, rejectReason.trim() || undefined),
    onSuccess: invalidate,
  });

  const borderColor = sub.status === 'approved'
    ? 'rgba(100,210,80,0.3)'
    : sub.status === 'rejected'
    ? 'rgba(255,87,87,0.3)'
    : 'var(--border)';

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-xl)',
      border: `1px solid ${borderColor}`,
      padding: '16px 18px', marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{sub.name}</div>
          {sub.brand && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{sub.brand}</div>}
          {sub.barcode && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, letterSpacing: 0.5 }}>Штрихкод: {sub.barcode}</div>}
          {sub.displayName && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>от {sub.displayName}</div>}
          {sub.source && sub.source !== 'user' && (
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Источник: {sub.source}</div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtDate(sub.createdAt)}</div>
          <div style={{
            marginTop: 4, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
            background: sub.status === 'approved' ? 'rgba(100,210,80,0.15)' : sub.status === 'rejected' ? 'rgba(255,87,87,0.12)' : 'rgba(255,159,10,0.12)',
            color: sub.status === 'approved' ? '#64D250' : sub.status === 'rejected' ? 'var(--danger)' : '#FF9F0A',
          }}>
            {sub.status === 'approved' ? 'Одобрено' : sub.status === 'rejected' ? 'Отклонено' : 'На проверке'}
          </div>
        </div>
      </div>

      {/* Similar product warning */}
      {sub.similarProduct && (
        <div style={{
          fontSize: 12, color: '#FF9F0A', background: 'rgba(255,159,10,0.08)',
          border: '1px solid rgba(255,159,10,0.25)', borderRadius: 8,
          padding: '6px 10px', marginBottom: 8,
        }}>
          Конфликт штрихкода: в базе уже есть «{sub.similarProduct.name}»
        </div>
      )}

      {/* Macros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{sub.caloriesPer100g}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}> ккал</span>
        </span>
        <MacroChip label="Б" value={sub.proteinPer100g} color="#7EB8F0" />
        <MacroChip label="Ж" value={sub.fatPer100g}     color="#F0A07A" />
        <MacroChip label="У" value={sub.carbsPer100g}   color="#90C860" />
        {sub.packageWeightG != null && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Упак. {sub.packageWeightG} г</span>
        )}
        {sub.isHighSugar && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'rgba(255,87,87,0.12)', color: 'var(--danger)', border: '1px solid rgba(255,87,87,0.25)' }}>
            Высокий сахар
          </span>
        )}
      </div>

      {/* Admin comment */}
      {sub.adminComment && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
          Комментарий: {sub.adminComment}
        </div>
      )}

      {/* Lazy photo */}
      {sub.hasPhoto && (
        <div style={{ marginBottom: 8 }}>
          <SubmissionPhoto id={sub.id} />
        </div>
      )}

      {/* Edit form */}
      {isPending && showEdit && (
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, fontWeight: 700 }}>РЕДАКТИРОВАТЬ ПЕРЕД ОДОБРЕНИЕМ</div>
          {([
            { label: 'Название', value: editName, set: setEditName, type: 'text'   },
            { label: 'Бренд',    value: editBrand, set: setEditBrand, type: 'text' },
            { label: 'Ккал',     value: editCal,  set: setEditCal,  type: 'number' },
            { label: 'Белки',    value: editPro,  set: setEditPro,  type: 'number' },
            { label: 'Жиры',     value: editFat,  set: setEditFat,  type: 'number' },
            { label: 'Углеводы', value: editCarb, set: setEditCarb, type: 'number' },
          ] as { label: string; value: string; set: (v: string) => void; type: string }[]).map(({ label, value, set, type }) => (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>{label}</div>
              <input
                type={type}
                value={value}
                onChange={e => set(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface)', border: '1px solid var(--border-2)',
                  borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text)', outline: 'none',
                }}
              />
            </div>
          ))}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Достоверность</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {CONFIDENCE_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setEditConf(o.value)}
                  style={{
                    flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 600,
                    borderRadius: 8, border: '1px solid var(--border-2)', cursor: 'pointer',
                    background: editConf === o.value ? 'var(--accent-soft)' : 'var(--surface)',
                    color: editConf === o.value ? 'var(--accent)' : 'var(--text-3)',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reject reason input */}
      {isPending && showReject && (
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Причина отклонения (необязательно)"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface)', border: '1px solid var(--border-2)',
              borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none',
            }}
          />
        </div>
      )}

      {/* Actions for pending */}
      {isPending && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            disabled={approveMutation.isPending}
            onClick={() => approveMutation.mutate()}
            style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)',
              border: 'none', cursor: 'pointer',
              background: approveMutation.isPending ? 'var(--surface)' : 'rgba(100,210,80,0.15)',
              color: '#64D250',
            }}
          >
            {approveMutation.isPending ? '...' : '✓ Одобрить'}
          </button>
          <button
            onClick={() => setShowEdit(v => !v)}
            style={{
              padding: '10px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', cursor: 'pointer',
              background: showEdit ? 'var(--accent-soft)' : 'var(--surface)',
              color: showEdit ? 'var(--accent)' : 'var(--text-3)',
            }}
          >
            ✎ Правки
          </button>
          <button
            disabled={rejectMutation.isPending}
            onClick={() => {
              if (!showReject) { setShowReject(true); return; }
              rejectMutation.mutate();
            }}
            style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)',
              border: 'none', cursor: 'pointer',
              background: rejectMutation.isPending ? 'var(--surface)' : 'rgba(255,87,87,0.12)',
              color: 'var(--danger)',
            }}
          >
            {rejectMutation.isPending ? '...' : showReject ? '✕ Подтвердить' : '✕ Отклонить'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AdminProductSubmissionsScreen() {
  const [statusTab, setStatusTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on tab change
  useEffect(() => { setPage(1); }, [statusTab]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-product-submissions', statusTab, debouncedQ, page],
    queryFn: () => api.adminProductSubmissions({ status: statusTab, q: debouncedQ || undefined, page, pageSize: 20 }),
    placeholderData: prev => prev,
  });

  const submissions = data?.submissions ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div className="screen">
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        Заявки на продукты
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
        Предложения пользователей{data?.total != null ? ` · ${data.total}` : ''}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по названию, бренду, штрихкоду..."
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--surface)', border: '1px solid var(--border-2)',
          borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 14,
          color: 'var(--text)', outline: 'none', marginBottom: 12,
        }}
      />

      {/* Status tabs */}
      <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 3, marginBottom: 16 }}>
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setStatusTab(t.key)}
            style={{
              flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 600, borderRadius: 10,
              border: 'none', cursor: 'pointer',
              background: statusTab === t.key ? 'var(--accent-soft)' : 'transparent',
              color: statusTab === t.key ? 'var(--accent)' : 'var(--text-3)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div className="spinner" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && submissions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: 14 }}>
          {debouncedQ ? 'По запросу ничего не найдено' : `Нет заявок со статусом «${STATUS_TABS.find(t => t.key === statusTab)?.label ?? statusTab}»`}
        </div>
      )}

      {/* Cards */}
      <div style={{ opacity: isFetching && !isLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
        {submissions.map(sub => (
          <SubmissionCard
            key={sub.id}
            sub={sub}
            onAction={() => qc.invalidateQueries({ queryKey: ['admin-product-submissions'] })}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8, paddingBottom: 20 }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', cursor: page <= 1 ? 'default' : 'pointer',
              background: 'var(--surface)', color: page <= 1 ? 'var(--text-3)' : 'var(--accent)',
              opacity: page <= 1 ? 0.4 : 1,
            }}
          >
            ‹ Назад
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', cursor: page >= totalPages ? 'default' : 'pointer',
              background: 'var(--surface)', color: page >= totalPages ? 'var(--text-3)' : 'var(--accent)',
              opacity: page >= totalPages ? 0.4 : 1,
            }}
          >
            Вперёд ›
          </button>
        </div>
      )}
    </div>
  );
}
