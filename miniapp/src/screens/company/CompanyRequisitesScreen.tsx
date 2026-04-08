import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';

// ─── Types ──────────────────────────────────────────────────────────────────

type ReqType = 'ooo' | 'ip';

interface ReqFields {
  companyName: string;
  inn: string;
  ogrn: string;
  legalAddress: string;
  accountNumber: string;
  corrAccount: string;
  bik: string;
  // ООО only
  kpp: string;
  director: string;
}

const EMPTY: ReqFields = {
  companyName: '', inn: '', ogrn: '', legalAddress: '',
  accountNumber: '', corrAccount: '', bik: '', kpp: '', director: '',
};

// ─── Validation ─────────────────────────────────────────────────────────────

interface FieldError { field: keyof ReqFields; message: string }

function validateRequisites(type: ReqType, fields: ReqFields): FieldError[] {
  const errors: FieldError[] = [];
  const digits = (s: string) => s.replace(/\D/g, '');

  if (fields.inn) {
    const d = digits(fields.inn);
    const expected = type === 'ip' ? 12 : 10;
    if (d.length !== expected) errors.push({ field: 'inn', message: `ИНН должен содержать ${expected} цифр` });
  }
  if (fields.kpp && type === 'ooo') {
    const d = digits(fields.kpp);
    if (d.length !== 9) errors.push({ field: 'kpp', message: 'КПП должен содержать 9 цифр' });
  }
  if (fields.ogrn) {
    const d = digits(fields.ogrn);
    const expected = type === 'ip' ? 15 : 13;
    if (d.length !== expected) errors.push({ field: 'ogrn', message: `ОГРН должен содержать ${expected} цифр` });
  }
  if (fields.accountNumber) {
    const d = digits(fields.accountNumber);
    if (d.length !== 20) errors.push({ field: 'accountNumber', message: 'Номер РС — 20 цифр' });
  }
  if (fields.corrAccount) {
    const d = digits(fields.corrAccount);
    if (d.length !== 20) errors.push({ field: 'corrAccount', message: 'Корр. счёт — 20 цифр' });
  }
  if (fields.bik) {
    const d = digits(fields.bik);
    if (d.length !== 9) errors.push({ field: 'bik', message: 'БИК — 9 цифр' });
    else if (!d.startsWith('04')) errors.push({ field: 'bik', message: 'БИК должен начинаться с 04' });
  }
  return errors;
}

// ─── Field definitions ───────────────────────────────────────────────────────

const OOO_FIELDS: Array<{ key: keyof ReqFields; label: string; numeric?: boolean }> = [
  { key: 'companyName',   label: 'Наименование компании' },
  { key: 'inn',           label: 'ИНН', numeric: true },
  { key: 'kpp',           label: 'КПП', numeric: true },
  { key: 'ogrn',          label: 'ОГРН', numeric: true },
  { key: 'legalAddress',  label: 'Юридический адрес' },
  { key: 'accountNumber', label: 'Номер РС', numeric: true },
  { key: 'corrAccount',   label: 'Корр. счёт', numeric: true },
  { key: 'bik',           label: 'БИК банка', numeric: true },
  { key: 'director',      label: 'Руководитель' },
];

const IP_FIELDS: Array<{ key: keyof ReqFields; label: string; numeric?: boolean }> = [
  { key: 'companyName',   label: 'Наименование предприятия' },
  { key: 'inn',           label: 'ИНН', numeric: true },
  { key: 'ogrn',          label: 'ОГРН', numeric: true },
  { key: 'legalAddress',  label: 'Юридический адрес' },
  { key: 'accountNumber', label: 'Номер РС', numeric: true },
  { key: 'corrAccount',   label: 'Корр. счёт', numeric: true },
  { key: 'bik',           label: 'БИК банка', numeric: true },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CompanyRequisitesScreen() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reqType, setReqType] = useState<ReqType>('ooo');
  const [fields, setFields] = useState<ReqFields>(EMPTY);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeNote, setRecognizeNote] = useState<string | null>(null);

  // Load saved requisites
  const { data: savedData, isLoading } = useQuery({
    queryKey: ['company-requisites'],
    queryFn: api.companyRequisites,
  });

  useEffect(() => {
    if (savedData?.requisites) {
      const r = savedData.requisites as Partial<ReqFields> & { type?: ReqType };
      if (r.type) setReqType(r.type);
      setFields({ ...EMPTY, ...r });
    }
  }, [savedData]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.companySaveRequisites(data),
    onSuccess: () => showToast('Реквизиты сохранены'),
    onError: () => showToast('Ошибка сохранения'),
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function handleField(key: keyof ReqFields, value: string) {
    setFields(f => ({ ...f, [key]: value }));
    setErrors(e => e.filter(er => er.field !== key));
  }

  function handleSave() {
    const errs = validateRequisites(reqType, fields);
    setErrors(errs);
    if (errs.length > 0) {
      showToast('Проверьте формат данных');
      return;
    }
    saveMutation.mutate({ ...fields, type: reqType } as unknown as Record<string, string>);
  }

  // Photo/document upload + AI recognition
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setRecognizing(true);
    setRecognizeNote(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const imageData = reader.result as string;
      try {
        const res = await api.companyRecognizeRequisites(imageData);
        const rec = res.recognized ?? {};
        const filled: Partial<ReqFields> = {};
        let count = 0;
        for (const [k, v] of Object.entries(rec)) {
          if (k in EMPTY && typeof v === 'string' && v) {
            (filled as Record<string, string>)[k] = v;
            count++;
          }
        }
        if ((rec as Record<string, unknown>).type === 'ip') setReqType('ip');
        else if ((rec as Record<string, unknown>).type === 'ooo') setReqType('ooo');
        setFields(f => ({ ...f, ...filled }));
        setRecognizeNote(
          count > 0
            ? `Распознано ${count} ${count === 1 ? 'поле' : count < 5 ? 'поля' : 'полей'}. Проверьте и дополните вручную.`
            : 'Не удалось распознать реквизиты. Заполните поля вручную.'
        );
      } catch {
        setRecognizeNote('Ошибка распознавания. Заполните поля вручную.');
      } finally {
        setRecognizing(false);
      }
    };
    reader.readAsDataURL(file);
  }

  const currentFields = reqType === 'ooo' ? OOO_FIELDS : IP_FIELDS;
  const errorMap = Object.fromEntries(errors.map(e => [e.field, e.message]));

  if (isLoading) {
    return (
      <div className="screen">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >‹</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Реквизиты</div>
      </div>

      {/* Type switcher */}
      <div style={{
        display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 11, padding: 3,
        border: '1px solid var(--border)', marginBottom: 20, width: '100%',
      }}>
        {(['ooo', 'ip'] as ReqType[]).map(t => (
          <button
            key={t}
            onClick={() => { setReqType(t); setErrors([]); }}
            style={{
              flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, borderRadius: 8,
              border: 'none', cursor: 'pointer',
              background: reqType === t ? 'var(--surface-3)' : 'transparent',
              color: reqType === t ? 'var(--text)' : 'var(--text-3)',
              boxShadow: reqType === t ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {t === 'ooo' ? 'ООО' : 'ИП'}
          </button>
        ))}
      </div>

      {/* Upload from photo/document */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
        padding: '14px 16px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Заполнить по фото или документу
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 12 }}>
          Загрузите фото документа с реквизитами — поля будут заполнены автоматически. Формат данных проверяется, но юридическая верификация реквизитов не выполняется.
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={recognizing}
          style={{
            width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 600,
            borderRadius: 10, border: '1px dashed var(--border)',
            background: 'var(--surface-2)', color: 'var(--text-2)',
            cursor: recognizing ? 'not-allowed' : 'pointer', opacity: recognizing ? 0.6 : 1,
          }}
        >
          {recognizing ? 'Распознаю...' : '📎 Выбрать фото или документ'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {recognizeNote && (
          <div style={{
            marginTop: 10, fontSize: 12, color: recognizeNote.startsWith('Не удалось') || recognizeNote.startsWith('Ошибка') ? 'var(--danger)' : 'var(--accent)',
            lineHeight: 1.4,
          }}>
            {recognizeNote}
          </div>
        )}
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {currentFields.map(({ key, label, numeric }) => (
          <div key={key}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 6 }}>
              {label}
            </div>
            <input
              value={fields[key]}
              onChange={e => handleField(key, e.target.value)}
              inputMode={numeric ? 'numeric' : undefined}
              placeholder={label}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '11px 14px',
                background: 'var(--surface)', border: `1px solid ${errorMap[key] ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 12, fontSize: 14, color: 'var(--text)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            {errorMap[key] && (
              <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errorMap[key]}</div>
            )}
          </div>
        ))}
      </div>

      {/* Save */}
      <button
        className="btn"
        onClick={handleSave}
        disabled={saveMutation.isPending}
        style={{ width: '100%', fontSize: 15 }}
      >
        {saveMutation.isPending ? 'Сохранение...' : 'Сохранить реквизиты'}
      </button>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: '#000', fontWeight: 700,
          padding: '10px 22px', borderRadius: 24, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
