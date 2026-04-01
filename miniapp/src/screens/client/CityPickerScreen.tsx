import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { PageHeader } from '../../ui';

// ── Known cities with timezone ───────────────────────────────────────

interface CityOption {
  name: string;      // display & save value
  tz: string;        // IANA timezone
  offset: string;    // human-readable offset
}

const POPULAR_CITIES: CityOption[] = [
  { name: 'Москва',              tz: 'Europe/Moscow',       offset: 'UTC+3' },
  { name: 'Санкт-Петербург',    tz: 'Europe/Moscow',       offset: 'UTC+3' },
  { name: 'Казань',              tz: 'Europe/Moscow',       offset: 'UTC+3' },
  { name: 'Нижний Новгород',    tz: 'Europe/Moscow',       offset: 'UTC+3' },
  { name: 'Ростов-на-Дону',     tz: 'Europe/Moscow',       offset: 'UTC+3' },
  { name: 'Краснодар',           tz: 'Europe/Moscow',       offset: 'UTC+3' },
  { name: 'Воронеж',             tz: 'Europe/Moscow',       offset: 'UTC+3' },
  { name: 'Волгоград',           tz: 'Europe/Moscow',       offset: 'UTC+3' },
  { name: 'Ставрополь',          tz: 'Europe/Moscow',       offset: 'UTC+3' },
  { name: 'Калининград',         tz: 'Europe/Kaliningrad',  offset: 'UTC+2' },
  { name: 'Самара',              tz: 'Europe/Samara',       offset: 'UTC+4' },
  { name: 'Саратов',             tz: 'Europe/Samara',       offset: 'UTC+4' },
  { name: 'Астрахань',           tz: 'Europe/Astrakhan',    offset: 'UTC+4' },
  { name: 'Екатеринбург',        tz: 'Asia/Yekaterinburg',  offset: 'UTC+5' },
  { name: 'Уфа',                 tz: 'Asia/Yekaterinburg',  offset: 'UTC+5' },
  { name: 'Челябинск',           tz: 'Asia/Yekaterinburg',  offset: 'UTC+5' },
  { name: 'Пермь',               tz: 'Asia/Yekaterinburg',  offset: 'UTC+5' },
  { name: 'Тюмень',              tz: 'Asia/Yekaterinburg',  offset: 'UTC+5' },
  { name: 'Омск',                tz: 'Asia/Omsk',            offset: 'UTC+6' },
  { name: 'Новосибирск',         tz: 'Asia/Novosibirsk',    offset: 'UTC+7' },
  { name: 'Барнаул',             tz: 'Asia/Barnaul',         offset: 'UTC+7' },
  { name: 'Томск',               tz: 'Asia/Tomsk',           offset: 'UTC+7' },
  { name: 'Красноярск',          tz: 'Asia/Krasnoyarsk',    offset: 'UTC+7' },
  { name: 'Иркутск',             tz: 'Asia/Irkutsk',         offset: 'UTC+8' },
  { name: 'Чита',                tz: 'Asia/Chita',           offset: 'UTC+9' },
  { name: 'Якутск',              tz: 'Asia/Yakutsk',         offset: 'UTC+9' },
  { name: 'Хабаровск',           tz: 'Asia/Vladivostok',    offset: 'UTC+10' },
  { name: 'Владивосток',         tz: 'Asia/Vladivostok',    offset: 'UTC+10' },
  { name: 'Магадан',             tz: 'Asia/Magadan',         offset: 'UTC+11' },
  { name: 'Южно-Сахалинск',     tz: 'Asia/Sakhalin',        offset: 'UTC+11' },
  { name: 'Петропавловск-Камчатский', tz: 'Asia/Kamchatka', offset: 'UTC+12' },
  { name: 'Минск',               tz: 'Europe/Minsk',         offset: 'UTC+3' },
  { name: 'Алматы',              tz: 'Asia/Almaty',          offset: 'UTC+5' },
  { name: 'Астана',              tz: 'Asia/Almaty',          offset: 'UTC+5' },
  { name: 'Ташкент',             tz: 'Asia/Tashkent',        offset: 'UTC+5' },
  { name: 'Баку',                tz: 'Asia/Baku',            offset: 'UTC+4' },
  { name: 'Тбилиси',            tz: 'Asia/Tbilisi',         offset: 'UTC+4' },
  { name: 'Ереван',              tz: 'Asia/Yerevan',         offset: 'UTC+4' },
];

// ── Timezone options for manual selection ────────────────────────────

interface TzOption {
  label: string;    // e.g. "Москва, Санкт-Петербург"
  tz: string;
  offset: string;
}

const TIMEZONE_OPTIONS: TzOption[] = [
  { label: 'Калининград',                  tz: 'Europe/Kaliningrad',  offset: 'UTC+2' },
  { label: 'Москва, Санкт-Петербург',      tz: 'Europe/Moscow',       offset: 'UTC+3' },
  { label: 'Самара, Саратов',              tz: 'Europe/Samara',       offset: 'UTC+4' },
  { label: 'Астрахань',                    tz: 'Europe/Astrakhan',    offset: 'UTC+4' },
  { label: 'Баку, Тбилиси, Ереван',       tz: 'Asia/Baku',           offset: 'UTC+4' },
  { label: 'Екатеринбург, Уфа, Пермь',    tz: 'Asia/Yekaterinburg',  offset: 'UTC+5' },
  { label: 'Алматы, Ташкент',             tz: 'Asia/Almaty',          offset: 'UTC+5' },
  { label: 'Омск',                         tz: 'Asia/Omsk',            offset: 'UTC+6' },
  { label: 'Новосибирск, Барнаул, Томск', tz: 'Asia/Novosibirsk',    offset: 'UTC+7' },
  { label: 'Красноярск',                   tz: 'Asia/Krasnoyarsk',    offset: 'UTC+7' },
  { label: 'Иркутск',                      tz: 'Asia/Irkutsk',         offset: 'UTC+8' },
  { label: 'Чита',                         tz: 'Asia/Chita',           offset: 'UTC+9' },
  { label: 'Якутск',                       tz: 'Asia/Yakutsk',         offset: 'UTC+9' },
  { label: 'Хабаровск, Владивосток',      tz: 'Asia/Vladivostok',    offset: 'UTC+10' },
  { label: 'Магадан, Сахалин',            tz: 'Asia/Magadan',         offset: 'UTC+11' },
  { label: 'Камчатка',                     tz: 'Asia/Kamchatka',       offset: 'UTC+12' },
];

// ── Screen ───────────────────────────────────────────────────────────

export default function CityPickerScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [query, setQuery] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customTz, setCustomTz] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.toLowerCase().trim();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return POPULAR_CITIES;
    return POPULAR_CITIES.filter(c =>
      c.name.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const hasNoMatch = normalizedQuery.length >= 2 && filtered.length === 0;

  function enterCustomMode() {
    setCustomName(query.trim());
    setCustomMode(true);
    setCustomTz('');
  }

  function exitCustomMode() {
    setCustomMode(false);
    setCustomTz('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function saveCity(cityName: string, tz: string) {
    setSaving(true);
    setError(null);
    try {
      await api.patchProfileData({ city: cityName, timezone: tz });
      await qc.invalidateQueries({ queryKey: ['bootstrap'] });
      await qc.invalidateQueries({ queryKey: ['profile-full'] });
      navigate(-1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
      setSaving(false);
    }
  }

  // ── Custom city mode ─────────────────────────────────────────────

  if (customMode) {
    const canSave = customName.trim().length >= 2 && customTz.length > 0;
    return (
      <div className="screen">
        <PageHeader title="Другой город" onBack={exitCustomMode} />

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6, fontWeight: 500 }}>
            Название города
          </div>
          <input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder="Введите название"
            autoFocus
            style={{
              width: '100%', padding: '12px 14px',
              background: 'var(--surface)', border: '1px solid var(--border-2)',
              borderRadius: 12, fontSize: 16, color: 'var(--text)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, fontWeight: 500 }}>
          Часовой пояс
        </div>
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16,
        }}>
          {TIMEZONE_OPTIONS.map((opt, i) => {
            const active = customTz === opt.tz;
            return (
              <button
                key={opt.tz}
                onClick={() => setCustomTz(opt.tz)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', textAlign: 'left', padding: '13px 16px',
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  border: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 14, color: active ? 'var(--accent)' : 'var(--text-2)', fontWeight: active ? 600 : 400 }}>
                  {opt.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{opt.offset}</span>
                  {active && <span style={{ fontSize: 14, color: 'var(--accent)' }}>✓</span>}
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{
            color: 'var(--danger)', fontSize: 13, marginBottom: 12,
            padding: '10px 14px', background: 'var(--danger-soft)',
            borderRadius: 10, border: '1px solid rgba(255,87,87,0.2)',
          }}>
            {error}
          </div>
        )}

        <button
          className="btn"
          disabled={!canSave || saving}
          onClick={() => saveCity(customName.trim(), customTz)}
        >
          {saving ? 'Сохраняем...' : 'Подтвердить'}
        </button>
      </div>
    );
  }

  // ── City search mode ─────────────────────────────────────────────

  return (
    <div className="screen">
      <PageHeader title="Город" onBack={() => navigate(-1)} />

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          fontSize: 16, color: 'var(--text-3)', pointerEvents: 'none',
        }}>
          🔍
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setCustomMode(false); }}
          placeholder="Поиск города..."
          autoFocus
          style={{
            width: '100%', padding: '13px 14px 13px 42px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, fontSize: 15, color: 'var(--text)',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* City list */}
      {filtered.length > 0 ? (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 10,
        }}>
          {filtered.map((city, i) => (
            <button
              key={city.name}
              onClick={() => saveCity(city.name, city.tz)}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', textAlign: 'left', padding: '14px 16px',
                background: 'transparent', border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>{city.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6,
                border: '1px solid var(--border)',
              }}>
                {city.offset}
              </span>
            </button>
          ))}
        </div>
      ) : hasNoMatch ? (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', padding: '20px 16px',
          textAlign: 'center', marginBottom: 10,
        }}>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 4 }}>
            Город «{query.trim()}» не найден в списке
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Выберите часовой пояс вручную
          </div>
        </div>
      ) : null}

      {/* Custom city entry — always visible if no results, or as footer option */}
      {(hasNoMatch || filtered.length > 0) && (
        <button
          onClick={enterCustomMode}
          className="btn btn-secondary"
          style={{ fontSize: 14 }}
        >
          {hasNoMatch ? `Ввести «${query.trim()}»` : 'Другой город'}
        </button>
      )}

      {error && (
        <div style={{
          color: 'var(--danger)', fontSize: 13, marginTop: 12,
          padding: '10px 14px', background: 'var(--danger-soft)',
          borderRadius: 10, border: '1px solid rgba(255,87,87,0.2)',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
