import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import dagre from 'dagre';
import ReactFlow, { Background, Controls, ConnectionLineType, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css'; // ReactFlow v11 has no non-dist CSS export — necessary exception
import { Plus, Download, FileJson, Trash2, Key, Link as LinkIcon, X, Network, Play, BookOpen, Search, Sparkles, Clock, History, CheckCircle, XCircle, Loader, ChevronDown, ChevronUp, User, LogOut, Eye, EyeOff, Pencil, Check } from 'lucide-react';

// ── EnvKeyPicker ──────────────────────────────────────────────────────────────
// Renders a select of available profile env-keys.
// value = key NAME (e.g. "AWS_ACCESS_KEY_ID"), not the secret value.
interface EnvKeyPickerProps {
  label: string;
  value: string;
  onChange: (keyName: string) => void;
  envKeys: Record<string, string>;
  onOpenProfile: () => void;
  hint?: string; // expected key name shown as placeholder hint
}

function EnvKeyPicker({ label, value, onChange, envKeys, onOpenProfile, hint }: EnvKeyPickerProps) {
  const { t } = useTranslation();
  const keys = Object.keys(envKeys);
  const resolved = value ? envKeys[value] : undefined;
  const missing = value && !resolved;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <label style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>{label}</label>
        <button type="button" onClick={onOpenProfile}
          style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.7rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <User size={10} /> {keys.length === 0 ? t('profile.addKeysInProfile') : value ? t('profile.manageProfile') : t('profile.pickFromProfile')}
        </button>
      </div>

      {keys.length === 0 ? (
        <div style={{ padding: '0.55rem 0.75rem', borderRadius: '7px', border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-subtle)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Key size={12} />
          {t('profile.noKeysYet')}{' '}
          <button type="button" onClick={onOpenProfile} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.8rem', padding: 0, textDecoration: 'underline' }}>
            {t('profile.addOne')}
          </button>
        </div>
      ) : (
        <>
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
              width: '100%', padding: '0.5rem 0.75rem', borderRadius: '7px',
              border: `1px solid ${missing ? 'rgba(239,68,68,0.4)' : value ? 'rgba(20,184,166,0.35)' : 'rgba(255,255,255,0.12)'}`,
              background: missing ? 'rgba(239,68,68,0.07)' : value ? 'rgba(20,184,166,0.07)' : 'rgba(255,255,255,0.04)',
              color: value ? 'white' : 'var(--text-subtle)', fontSize: '0.83rem', cursor: 'pointer',
            }}
          >
            <option value="" style={{ color: 'black' }}>{hint ? t('profile.selectHint', { hint }) : t('profile.selectKey')}</option>
            {keys.map(k => (
              <option key={k} value={k} style={{ color: 'black' }}>{k}</option>
            ))}
          </select>
          {value && (
            <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', color: resolved ? '#2dd4bf' : '#f87171', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {resolved
                ? <><CheckCircle size={10} /> {t('profile.resolved')} · {resolved.length > 4 ? resolved.slice(0, 4) + '••••' : '••••'}</>
                : <><XCircle size={10} /> {t('profile.keyNotFound', { value })}</>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const AUTH_STORAGE_KEY = 'dataforge_auth';

function loadAuth(): { token: string; username: string } | null {
  try { return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null'); } catch { return null; }
}
function saveAuth(token: string, username: string) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, username }));
}
function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ── LoginScreen ───────────────────────────────────────────────────────────────
function LoginScreen({ onAuth }: { onAuth: (token: string, username: string) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('auth.somethingWentWrong')); return; }
      saveAuth(data.token, data.username);
      onAuth(data.token, data.username);
    } catch (e: any) {
      setError(e.message || t('auth.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div className="glass-panel animated-scale" style={{ width: '380px', maxWidth: '95vw', padding: '2rem', background: 'rgba(9,12,20,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderTopColor: 'rgba(255,255,255,0.14)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img src="/logo-icon.png" alt="Dataforge" style={{ height: '52px', marginBottom: '0.75rem' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Data<span style={{ color: 'var(--primary)' }}>forge</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.2rem' }}>{t('auth.subtitle')}</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.25rem' }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              style={{ flex: 1, padding: '0.45rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.15s',
                background: mode === m ? 'rgba(34,211,238,0.15)' : 'transparent',
                color: mode === m ? 'var(--primary)' : 'var(--text-muted)' }}>
              {m === 'login' ? t('auth.signIn') : t('auth.createAccount')}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-main)' }}>{t('auth.username')}</label>
            <input
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              style={{ width: '100%', padding: '0.6rem 0.75rem' }}
              disabled={loading}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-main)' }}>{t('auth.password')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.75rem' }}
                disabled={loading}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem', display: 'flex' }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.82rem' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !username.trim() || !password}
            className="btn-success"
            style={{ marginTop: '0.25rem', padding: '0.65rem', fontSize: '0.9rem', fontWeight: 700, opacity: (loading || !username.trim() || !password) ? 0.5 : 1, cursor: (loading || !username.trim() || !password) ? 'not-allowed' : 'pointer' }}>
            {loading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : t(mode === 'login' ? 'auth.signIn' : 'auth.createAccount')}
          </button>
        </form>
      </div>
    </div>
  );
}

const FAKER_CATALOG: { category: string; color: string; methods: { name: string; example: string }[] }[] = [
  { category: 'Person', color: '#60a5fa', methods: [
    { name: 'name', example: 'John Smith' },
    { name: 'first_name', example: 'John' },
    { name: 'last_name', example: 'Smith' },
    { name: 'name_female', example: 'Jane Doe' },
    { name: 'name_male', example: 'James Doe' },
    { name: 'prefix', example: 'Mr.' },
    { name: 'suffix', example: 'Jr.' },
  ]},
  { category: 'Internet', color: '#34d399', methods: [
    { name: 'email', example: 'user@example.com' },
    { name: 'safe_email', example: 'user@example.org' },
    { name: 'free_email', example: 'user@gmail.com' },
    { name: 'user_name', example: 'john_doe42' },
    { name: 'domain_name', example: 'example.com' },
    { name: 'url', example: 'https://example.com/path' },
    { name: 'slug', example: 'my-blog-post' },
    { name: 'ipv4', example: '192.168.1.1' },
    { name: 'ipv6', example: '2001:db8::1' },
    { name: 'mac_address', example: '00:1A:2B:3C:4D:5E' },
    { name: 'http_method', example: 'GET' },
    { name: 'http_status_code', example: '200' },
    { name: 'password', example: 'xK9#mP2!' },
    { name: 'hostname', example: 'srv-01.example.com' },
    { name: 'tld', example: '.com' },
  ]},
  { category: 'Address', color: '#f59e0b', methods: [
    { name: 'address', example: '123 Main St, Springfield' },
    { name: 'street_address', example: '123 Main St' },
    { name: 'street_name', example: 'Main Street' },
    { name: 'city', example: 'Springfield' },
    { name: 'postcode', example: '12345' },
    { name: 'country', example: 'United States' },
    { name: 'country_code', example: 'US' },
    { name: 'building_number', example: '42' },
  ]},
  { category: 'Phone', color: '#a78bfa', methods: [
    { name: 'phone_number', example: '+1-555-123-4567' },
    { name: 'msisdn', example: '14155552671' },
    { name: 'country_calling_code', example: '+1' },
  ]},
  { category: 'Company', color: '#fb923c', methods: [
    { name: 'company', example: 'Acme Corp' },
    { name: 'company_suffix', example: 'LLC' },
    { name: 'catch_phrase', example: 'Seamless synergy solutions' },
    { name: 'bs', example: 'leverage core competencies' },
    { name: 'job', example: 'Software Engineer' },
  ]},
  { category: 'Finance', color: '#4ade80', methods: [
    { name: 'iban', example: 'GB82WEST12345698765432' },
    { name: 'bban', example: '20-00-55 73553400' },
    { name: 'bank', example: 'Royal Bank' },
    { name: 'swift', example: 'BOFAUS3N' },
    { name: 'currency_code', example: 'USD' },
    { name: 'currency_name', example: 'US Dollar' },
    { name: 'currency_symbol', example: '$' },
    { name: 'cryptocurrency_code', example: 'BTC' },
    { name: 'pricetag', example: '$12.99' },
  ]},
  { category: 'Date / Time', color: '#f472b6', methods: [
    { name: 'date', example: '2023-04-15' },
    { name: 'date_of_birth', example: '1990-07-22' },
    { name: 'past_date', example: '2022-01-10' },
    { name: 'future_date', example: '2025-09-30' },
    { name: 'iso8601', example: '2023-04-15T10:30:00' },
    { name: 'time', example: '14:30:00' },
    { name: 'year', example: '2023' },
    { name: 'month', example: '04' },
    { name: 'month_name', example: 'April' },
    { name: 'day_of_week', example: 'Monday' },
    { name: 'timezone', example: 'America/New_York' },
    { name: 'unix_time', example: '1681554600' },
  ]},
  { category: 'Text', color: '#94a3b8', methods: [
    { name: 'word', example: 'example' },
    { name: 'words', example: 'foo bar baz' },
    { name: 'sentence', example: 'The quick brown fox.' },
    { name: 'paragraph', example: 'Lorem ipsum dolor sit amet...' },
    { name: 'text', example: 'Lorem ipsum...' },
  ]},
  { category: 'Identity', color: '#e879f9', methods: [
    { name: 'ssn', example: '123-45-6789' },
    { name: 'uuid4', example: '550e8400-e29b-41d4-a716-...' },
    { name: 'md5', example: '5d41402abc4b2a76b9719d...' },
    { name: 'sha1', example: 'aaf4c61ddcc5e8a2d...' },
    { name: 'sha256', example: '2cf24dba5fb0a30e26e8...' },
  ]},
  { category: 'Color', color: '#f87171', methods: [
    { name: 'color_name', example: 'MediumAquaMarine' },
    { name: 'hex_color', example: '#a2b3c4' },
    { name: 'rgb_color', example: '162,179,196' },
    { name: 'safe_color_name', example: 'blue' },
  ]},
  { category: 'File', color: '#64748b', methods: [
    { name: 'file_name', example: 'report.pdf' },
    { name: 'file_extension', example: 'pdf' },
    { name: 'file_path', example: '/home/user/docs/report.pdf' },
    { name: 'mime_type', example: 'application/pdf' },
  ]},
  { category: 'Geo', color: '#2dd4bf', methods: [
    { name: 'latitude', example: '48.8566' },
    { name: 'longitude', example: '2.3522' },
    { name: 'coordinate', example: '48.8566' },
    { name: 'latlng', example: '(48.8566, 2.3522)' },
  ]},
  { category: 'Automotive', color: '#fbbf24', methods: [
    { name: 'license_plate', example: 'ABC-1234' },
    { name: 'vin', example: '1HGCM82633A123456' },
  ]},
  { category: 'Barcode', color: '#a3e635', methods: [
    { name: 'ean13', example: '5901234123457' },
    { name: 'ean8', example: '96385074' },
    { name: 'isbn13', example: '978-3-16-148410-0' },
    { name: 'isbn10', example: '0-306-40615-2' },
  ]},
  { category: 'Credit Card', color: '#818cf8', methods: [
    { name: 'credit_card_number', example: '4111111111111111' },
    { name: 'credit_card_provider', example: 'Visa' },
    { name: 'credit_card_expire', example: '12/26' },
    { name: 'credit_card_security_code', example: '123' },
  ]},
  { category: 'User Agent', color: '#7dd3fc', methods: [
    { name: 'user_agent', example: 'Mozilla/5.0 (Windows...)' },
    { name: 'chrome', example: 'Chrome/114.0...' },
    { name: 'firefox', example: 'Firefox/115.0...' },
    { name: 'safari', example: 'Safari/537.36...' },
  ]},
];

import type { Schema, Table, Column } from './types/schema';
import { SchemaWriter } from './services/SchemaWriter';
import { SchemaReader } from './services/SchemaReader';
import TableNode from './components/TableNode';
const VALID_DTYPES = [
  "int_seq", "uuid", "int", "float", "str", "bool", "date",
  "email", "name", "phone", "address", "city", "country",
  "company", "text", "url", "currency", "iban",
];

const nodeTypes = { tableNode: TableNode };

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID() as string;
  }
  // fallback for non-secure contexts (HTTP via network IP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const DATE_DTYPES = new Set(['date', 'date_of_birth', 'past_date', 'future_date', 'iso8601']);
const DATE_FAKER_METHODS = new Set(['date', 'date_of_birth', 'past_date', 'future_date', 'iso8601', 'date_time', 'date_time_between']);

function isDateColumn(col: Column): boolean {
  return DATE_DTYPES.has(col.dtype) || DATE_FAKER_METHODS.has(col.fakerProvider);
}


function AppMain({ auth, onLogout }: { auth: { token: string; username: string }; onLogout: () => void }) {
  const { t, i18n } = useTranslation();
  // ── Profile / env-keys state ───────────────────────────────────────────────
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [envKeys, setEnvKeys] = useState<Record<string, string>>({});
  const [envPreviewVisible, setEnvPreviewVisible] = useState(false);
  const [envKeyForm, setEnvKeyForm] = useState({ key: '', value: '' });
  const [envKeyError, setEnvKeyError] = useState('');
  const [envKeyLoading, setEnvKeyLoading] = useState(false);
  const [showEnvValue, setShowEnvValue] = useState<Record<string, boolean>>({});
  const [editingEnvKey, setEditingEnvKey] = useState<string | null>(null);
  const [editingEnvValue, setEditingEnvValue] = useState('');

  const handleSaveEditEnvKey = async () => {
    if (!editingEnvKey) return;
    setEnvKeyLoading(true);
    try {
      const res = await fetch('/api/profile/env-keys', {
        method: 'POST',
        headers: authHeaders(auth.token),
        body: JSON.stringify({ key: editingEnvKey, value: editingEnvValue }),
      });
      if (res.ok) { setEditingEnvKey(null); setEditingEnvValue(''); await fetchEnvKeys(); }
    } finally {
      setEnvKeyLoading(false);
    }
  };

  const fetchEnvKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/env-keys', { headers: { Authorization: `Bearer ${auth.token}` } });
      if (res.ok) setEnvKeys(await res.json());
    } catch { /* ignore */ }
  }, [auth.token]);

  useEffect(() => { fetchEnvKeys(); }, [fetchEnvKeys]);

  const handleAddEnvKey = async () => {
    setEnvKeyError('');
    const k = envKeyForm.key.trim();
    const v = envKeyForm.value;
    if (!k) { setEnvKeyError('Key name is required.'); return; }
    setEnvKeyLoading(true);
    try {
      const res = await fetch('/api/profile/env-keys', {
        method: 'POST',
        headers: authHeaders(auth.token),
        body: JSON.stringify({ key: k, value: v }),
      });
      const data = await res.json();
      if (!res.ok) { setEnvKeyError(data.error || 'Failed to save key.'); return; }
      setEnvKeyForm({ key: '', value: '' });
      await fetchEnvKeys();
    } catch (e: any) {
      setEnvKeyError(e.message || String(e));
    } finally {
      setEnvKeyLoading(false);
    }
  };

  const handleDeleteEnvKey = async (keyName: string) => {
    await fetch(`/api/profile/env-keys/${encodeURIComponent(keyName)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` },
    });
    await fetchEnvKeys();
  };

  const [domain, setDomain] = useState("custom");
  const [tables, setTables] = useState<Table[]>([]);
  const [generatedYaml, setGeneratedYaml] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [loadedSchemas, setLoadedSchemas] = useState<Record<string, Schema>>({});
  const [validDomains, setValidDomains] = useState<string[]>(['custom']);

  useEffect(() => {
    fetch('/api/schemas')
      .then(r => r.json())
      .then(async (names: string[]) => {
        const schemas: Record<string, Schema> = {};
        await Promise.all(names.map(async name => {
          try {
            const yaml = await fetch(`/api/schemas/${name}`).then(r => r.text());
            schemas[name] = SchemaReader.parseYaml(yaml);
          } catch (e) {
            console.warn('Failed to load schema:', name, e);
          }
        }));
        setLoadedSchemas(schemas);
        setValidDomains(['custom', ...names.sort()]);
      })
      .catch(() => {});
  }, []);

  const handleDomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDomain = e.target.value;
    setDomain(newDomain);

    if (newDomain !== 'custom' && loadedSchemas[newDomain]) {
      const tablesWithPos = loadedSchemas[newDomain].tables.map((t: Table, index: number) => ({
        ...t,
        position: { x: 50 + index * 300, y: 100 + (index % 2) * 200 }
      }));
      setTables(tablesWithPos);
      setGeneratedYaml('');
      setSelectedTableId(null);
    } else {
      setTables([]);
      setGeneratedYaml('');
      setSelectedTableId(null);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedSchema = await SchemaReader.readFromFile(file);
      setDomain(parsedSchema.domain);
      const tablesWithPos = parsedSchema.tables.map((t, index) => ({
        ...t,
        position: t.position || { x: 50 + index * 300, y: 100 + (index % 2) * 200 }
      }));
      setTables(tablesWithPos);
      setGeneratedYaml('');
      setSelectedTableId(null);
    } catch (err: any) {
      showConfirm('Error loading schema', err.message || String(err), () => {});
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onUpdateTable = useCallback((id: string, field: keyof Table, value: any) => {
    setTables(t => t.map(table => table.id === id ? { ...table, [field]: value } : table));
  }, []);

  const onRemoveTable = useCallback((id: string) => {
    setTables(t => t.filter(table => table.id !== id));
    if (selectedTableId === id) setSelectedTableId(null);
  }, [selectedTableId]);

  const onAddColumn = useCallback((tableId: string) => {
    setTables(t => t.map(table => {
      if (table.id === tableId) {
        return {
          ...table,
           columns: [
            ...table.columns,
            {
              id: newId(),
              name: `col_${table.columns.length + 1}`,
              dtype: 'str',
              isPrimaryKey: false,
              fakerProvider: '',
              nullable: '0',
              isForeignKey: false,
              fkTable: '',
              fkColumn: 'id',
              min: '',
              max: '',
              choices: []
            }
          ]
        };
      }
      return table;
    }));
  }, []);

  const onUpdateColumn = useCallback((tableId: string, colId: string, field: keyof Column, value: any) => {
    setTables(t => t.map(table => {
      if (table.id === tableId) {
        return {
          ...table,
          columns: table.columns.map(c => c.id === colId ? { ...c, [field]: value } : c)
        };
      }
      return table;
    }));
  }, []);

  const onRemoveColumn = useCallback((tableId: string, colId: string) => {
    setTables(t => t.map(table => {
      if (table.id === tableId) {
        return { ...table, columns: table.columns.filter(c => c.id !== colId) };
      }
      return table;
    }));
  }, []);

  const addTable = () => {
    const tableId = newId();
    setTables([
      ...tables,
      {
        id: tableId,
        name: `table_${tables.length + 1}`,
        rows: 1000,
        columns: [],
        position: { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 100 }
      }
    ]);
    setSelectedTableId(tableId);
  };

  const generateSchema = () => {
    const yamlStr = SchemaWriter.generateYaml(domain, tables);
    setGeneratedYaml(yamlStr);
  };

  const downloadYaml = () => {
    SchemaWriter.downloadYaml(generatedYaml, `${domain}_schema.yaml`);
  };

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  React.useEffect(() => {
    setNodes(() => {
      return tables.map((t) => {
        const position = t.position || { x: Math.random() * 200, y: Math.random() * 200 };
        
        return {
          id: t.id,
          type: 'tableNode',
          position,
          data: {
            name: t.name,
            rows: t.rows,
            columns: t.columns,
          }
        };
      });
    });

    setEdges(() => {
      const newEdges: Edge[] = [];
      tables.forEach(sourceTable => {
        sourceTable.columns.forEach(col => {
          if (col.isForeignKey && col.fkTable) {
            const targetTable = tables.find(t => t.name === col.fkTable);
            if (targetTable) {
              newEdges.push({
                id: `e-${sourceTable.id}-${col.id}-${targetTable.id}`,
                source: sourceTable.id,
                target: targetTable.id,
                animated: true,
                style: { stroke: 'var(--accent)', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#fb923c' }
              });
            }
          }
        });
      });
      return newEdges;
    });
  }, [tables, setNodes, setEdges]);

  const onLayout = useCallback(() => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    // LR = Left to Right flow. Increased gap values for cleaner look
    dagreGraph.setGraph({ rankdir: 'LR', ranksep: 250, nodesep: 150 });

    tables.forEach((t) => {
      const estimatedHeight = 100 + t.columns.length * 35;
      dagreGraph.setNode(t.id, { width: 300, height: estimatedHeight });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    setTables(currentTables => currentTables.map(t => {
      const nodeWithPosition = dagreGraph.node(t.id);
      if (nodeWithPosition) {
         return {
           ...t,
           position: {
             x: nodeWithPosition.x - 150,
             y: nodeWithPosition.y - 100,
           }
         };
      }
      return t;
    }));
  }, [tables, edges]);

  const [fakerBrowser, setFakerBrowser] = useState<{ tableId: string; colId: string } | null>(null);
  const [fakerSearch, setFakerSearch] = useState('');
  const [fakerDropdown, setFakerDropdown] = useState<{ tableId: string; colId: string } | null>(null);

  const allFakerMethods = FAKER_CATALOG.flatMap(c => c.methods.map(m => ({ ...m, category: c.category, color: c.color })));

  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [dbTestError, setDbTestError] = useState('');
  const [dbAdvanced, setDbAdvanced] = useState(false);
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [dbForm, setDbForm] = useState({
    type: 'postgresql',
    host: '',
    port: '5432',
    database: '',
    user: '',
    password: '',
  });

  const DB_PORT_DEFAULTS: Record<string, string> = { postgresql: '5432', mysql: '3306', sqlite: '' };

  type SavedConn = { name: string; form: typeof dbForm; advancedUrl: string; advanced: boolean };
  const SAVED_CONNS_KEY = 'dataforge_saved_connections';
  const loadSavedConns = (): SavedConn[] => {
    try { return JSON.parse(localStorage.getItem(SAVED_CONNS_KEY) || '[]'); } catch { return []; }
  };
  const [savedConns, setSavedConns] = useState<SavedConn[]>(loadSavedConns);
  const [saveConnName, setSaveConnName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const persistSavedConns = (conns: SavedConn[]) => {
    localStorage.setItem(SAVED_CONNS_KEY, JSON.stringify(conns));
    setSavedConns(conns);
  };

  const handleSaveConn = () => {
    const name = saveConnName.trim();
    if (!name) return;
    const entry: SavedConn = { name, form: { ...dbForm }, advancedUrl: runConfig.dbUrl, advanced: dbAdvanced };
    const existing = savedConns.filter(c => c.name !== name);
    persistSavedConns([entry, ...existing]);
    setSaveConnName('');
    setShowSaveInput(false);
  };

  const handleLoadConn = (conn: SavedConn) => {
    setDbForm(conn.form);
    setDbAdvanced(conn.advanced);
    if (conn.advanced) setRunConfig(r => ({ ...r, dbUrl: conn.advancedUrl }));
    setDbTestStatus('idle');
    setDbTestError('');
  };

  const handleDeleteConn = (name: string) => {
    persistSavedConns(savedConns.filter(c => c.name !== name));
  };

  const buildDbUrl = (form: typeof dbForm): string => {
    if (form.type === 'sqlite') return `sqlite:///${form.database || 'output.db'}`;
    if (!form.host || !form.database) return '';
    const driver = form.type === 'mysql' ? 'mysql+pymysql' : 'postgresql+psycopg2';
    const creds = form.user ? `${encodeURIComponent(form.user)}:${encodeURIComponent(form.password)}@` : '';
    const port = form.port ? `:${form.port}` : '';
    return `${driver}://${creds}${form.host}${port}/${form.database}`;
  };

  const handleTestDbConnection = async () => {
    setDbTestStatus('testing');
    setDbTestError('');
    try {
      const res = await fetch('/api/test-db-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbUrl: computedDbUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setDbTestStatus('ok');
      } else {
        setDbTestStatus('error');
        setDbTestError(data.error || 'Connection failed.');
      }
    } catch (e: any) {
      setDbTestStatus('error');
      setDbTestError(e.message || String(e));
    }
  };

  const [saveModal, setSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveError, setSaveError] = useState('');

  // Generic confirm dialog
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setConfirmModal({ title, message, onConfirm });

  const AI_KEY_STORAGE = 'dataforge_ai_config';
  const loadAiConfig = () => {
    try { return JSON.parse(localStorage.getItem(AI_KEY_STORAGE) || '{}'); } catch { return {}; }
  };

  const AI_PROVIDERS = [
    { key: 'anthropic', label: 'Anthropic',   color: '#f59e0b', keyPlaceholder: 'sk-ant-api03-…',  modelPlaceholder: 'e.g. claude-3-5-haiku-20241022' },
    { key: 'openai',    label: 'OpenAI',       color: '#10b981', keyPlaceholder: 'sk-…',            modelPlaceholder: 'e.g. gpt-4o-mini' },
    { key: 'google',    label: 'Google',       color: '#60a5fa', keyPlaceholder: 'AIza…',           modelPlaceholder: 'e.g. gemini-2.0-flash' },
    { key: 'groq',      label: 'Groq',         color: '#f472b6', keyPlaceholder: 'gsk_…',           modelPlaceholder: 'e.g. llama-3.3-70b-versatile' },
    { key: 'mistral',   label: 'Mistral',      color: '#a78bfa', keyPlaceholder: 'xxxxxxxx…',       modelPlaceholder: 'e.g. mistral-small-latest' },
    { key: 'together',  label: 'Together AI',  color: '#34d399', keyPlaceholder: 'xxxxxxxx…',       modelPlaceholder: 'e.g. meta-llama/Llama-3.3-70B-Instruct-Turbo' },
    { key: 'ollama',    label: 'Ollama',        color: '#94a3b8', keyPlaceholder: '',               modelPlaceholder: 'e.g. llama3.2' },
  ] as const;

  const AI_DEFAULT_PROMPT = t('ai.defaultPrompt');

  const [aiModal, setAiModal] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>(() => loadAiConfig().provider || 'anthropic');
  const [aiApiKeys, setAiApiKeys] = useState<Record<string, string>>(() => loadAiConfig().apiKeys || {});
  const [aiModels, setAiModels] = useState<Record<string, string>>(() => loadAiConfig().models || {});
  const [aiAvailableModels, setAiAvailableModels] = useState<Record<string, string[]>>({});
  const [aiModelsLoading, setAiModelsLoading] = useState(false);
  const [aiModelsError, setAiModelsError] = useState('');
  const [aiPrompt, setAiPrompt] = useState(AI_DEFAULT_PROMPT);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const currentProviderMeta = AI_PROVIDERS.find(p => p.key === aiProvider) ?? AI_PROVIDERS[0];
  const currentApiKeyRef  = aiApiKeys[aiProvider] ?? '';           // env key name selected
  const currentApiKey     = envKeys[currentApiKeyRef] ?? '';       // resolved value
  const currentModel = aiModels[aiProvider] ?? '';
  const availableModels = aiAvailableModels[aiProvider] ?? [];

  const handleLoadModels = async () => {
    setAiModelsError('');
    setAiModelsLoading(true);
    try {
      const res = await fetch('/api/ai-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: aiProvider, apiKey: currentApiKey.trim() }),
      });
      const data = await res.json();
      if (data.error) { setAiModelsError(data.error); return; }
      setAiAvailableModels(prev => ({ ...prev, [aiProvider]: data.models }));
      if (!currentModel && data.models.length > 0) {
        setAiModels(prev => ({ ...prev, [aiProvider]: data.models[0] }));
      }
    } catch (e: any) {
      setAiModelsError(e.message || String(e));
    } finally {
      setAiModelsLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    setAiError('');
    const isOllama = aiProvider === 'ollama';
    if (!currentApiKey.trim() && !isOllama) { setAiError(t('ai.apiKeyRequired')); return; }
    if (!aiPrompt.trim()) { setAiError(t('ai.describeTheDomain')); return; }
    setAiLoading(true);
    try {
      const savedKeys = { ...aiApiKeys }; // stores key NAMES
      const savedModels = { ...aiModels };
      if (currentModel.trim()) savedModels[aiProvider] = currentModel.trim();
      localStorage.setItem(AI_KEY_STORAGE, JSON.stringify({ provider: aiProvider, apiKeys: savedKeys, models: savedModels }));
      const res = await fetch('/api/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: aiProvider, apiKey: currentApiKey.trim(), model: currentModel.trim() || undefined, prompt: `${t('ai.langInstruction')}\n\n${aiPrompt}` }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const errMsg = data.error || 'AI generation failed.';
        // If the backend also returned the raw YAML (e.g. duplicate keys), show it so the user can inspect/fix
        if (data.yaml) {
          setAiError(`${errMsg}\n\nYAML gerado (para referência):\n${data.yaml}`);
        } else {
          setAiError(errMsg);
        }
        return;
      }
      const parsed = SchemaReader.parseYaml(data.yaml);
      setDomain(parsed.domain || 'custom');
      const tablesWithPos = parsed.tables.map((t: Table, index: number) => ({
        ...t,
        position: { x: 50 + index * 320, y: 100 + (index % 3) * 220 }
      }));
      setTables(tablesWithPos);
      setGeneratedYaml('');
      setSelectedTableId(null);
      setAiModal(false);
      setAiPrompt(AI_DEFAULT_PROMPT);
    } catch (e: any) {
      setAiError(e.message || String(e));
    } finally {
      setAiLoading(false);
    }
  };

  const handleDeleteDomain = () => {
    showConfirm(
      t('save.deleteSchema'),
      t('save.deleteConfirm', { domain }),
      async () => {
        await fetch(`/api/schemas/${domain}`, { method: 'DELETE' });
        window.location.reload();
      }
    );
  };

  const handleSaveSchema = async () => {
    setSaveError('');
    const name = saveName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name || !/^[a-z0-9_-]+$/.test(name)) {
      setSaveError('Use only lowercase letters, numbers, hyphens and underscores.');
      return;
    }
    try {
      const yamlStr = SchemaWriter.generateYaml(name, tables);
      const res = await fetch('/api/save-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yamlStr, name }),
      });
      const data = await res.json();
      if (!data.success) { setSaveError(data.error || t('save.saveFailed')); return; }
      setSaveModal(false);
      setSaveName('');
      window.location.reload();
    } catch (e: any) {
      setSaveError(e.message || String(e));
    }
  };

  // ── Schedule types ──────────────────────────────────────────────────────────
  interface ScheduleDef {
    id: string;
    name: string;
    cronExpression: string;
    enabled: boolean;
    config: Record<string, any>;
    createdAt: string;
  }
  interface RunRecord {
    id: string;
    scheduleId: string;
    scheduleName: string;
    triggeredBy: 'cron' | 'manual';
    startedAt: string;
    finishedAt: string | null;
    status: 'running' | 'success' | 'error';
    output: string;
    exitCode: number | null;
  }

  // ── Schedule state ──────────────────────────────────────────────────────────
  const [showSchedulesPanel, setShowSchedulesPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [schedulesLoadError, setSchedulesLoadError] = useState('');
  const [scheduleDefs, setScheduleDefs] = useState<ScheduleDef[]>([]);
  const [runHistory, setRunHistory] = useState<RunRecord[]>([]);
  const [historyOutput, setHistoryOutput] = useState<RunRecord | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleDef | null>(null);

  type SchedDest = 'local' | 'cloud' | 'database';

  // ── Schedule builder mode ───────────────────────────────────────────────────
  const [schedBuilderMode, setSchedBuilderMode] = useState<'visual' | 'cron'>('visual');
  const [schedVisual, setSchedVisual] = useState({ minute: '0', hour: '9', day: '*', month: '*' });

  const visualToCron = (v: typeof schedVisual) =>
    `${v.minute} ${v.hour} ${v.day} ${v.month} *`;

  const applyVisual = (next: Partial<typeof schedVisual>) => {
    const merged = { ...schedVisual, ...next };
    setSchedVisual(merged);
    setSchedForm(f => ({ ...f, cronExpression: visualToCron(merged) }));
  };

  const MONTHS = ['*','1','2','3','4','5','6','7','8','9','10','11','12'];
  const MONTH_NAMES: Record<string,string> = { '*':'Every month','1':'January','2':'February','3':'March','4':'April','5':'May','6':'June','7':'July','8':'August','9':'September','10':'October','11':'November','12':'December' };
  const DAYS_OF_MONTH = ['*', ...Array.from({length:31},(_,i)=>String(i+1))];

  const [schedForm, setSchedForm] = useState<{
    name: string;
    cronExpression: string;
    destination: SchedDest;
    formats: string[];
    outputDir: string;
    rows: string;
    jsonMode: string;
    uploadTarget: string;
    bucket: string;
    prefix: string;
    dbUrl: string;
    ifExists: string;
    dbSchema: string;
    tablesToInclude: string[];
    cloudCreds: { gcsJson: string; s3AccessKey: string; s3SecretKey: string; s3Region: string; azureConnStr: string };
    dateAnchors: { table: string; column: string; offsetDays: string }[];
  }>({
    name: '',
    cronExpression: '0 9 * * *',
    destination: 'local',
    formats: ['csv'],
    outputDir: 'output',
    rows: '',
    jsonMode: 'flat',
    uploadTarget: 'gcs',
    bucket: '',
    prefix: 'datasets/',
    dbUrl: '',
    ifExists: 'append',
    dbSchema: '',
    tablesToInclude: [],
    cloudCreds: { gcsJson: '', s3AccessKey: '', s3SecretKey: '', s3Region: 'us-east-1', azureConnStr: '' },
    dateAnchors: [],
  });
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedError, setSchedError] = useState('');

  const fetchSchedules = async () => {
    setSchedulesLoadError('');
    try {
      const res = await fetch('/api/schedules', { headers: { Authorization: `Bearer ${auth?.token}` } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setScheduleDefs(data);
      } else {
        const msg = data?.error ?? `HTTP ${res.status}`;
        setSchedulesLoadError(msg);
        console.error('[schedules] unexpected response:', data);
      }
    } catch (e: any) {
      setSchedulesLoadError(e?.message ?? 'Network error');
      console.error('[schedules] fetch error:', e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/run-history?limit=100', { headers: { Authorization: `Bearer ${auth?.token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setRunHistory(data);
      else console.error('[run-history] unexpected response:', data);
    } catch (e) {
      console.error('[run-history] fetch error:', e);
    }
  };

  const handleSaveSchedule = async () => {
    setSchedError('');
    setSchedSaving(true);
    try {
      const yamlStr = SchemaWriter.generateYaml(domain, tables);
      const config = {
        yamlStr,
        tables: schedForm.tablesToInclude.length > 0 ? schedForm.tablesToInclude : undefined,
        rows: schedForm.rows !== '' ? parseInt(schedForm.rows) : undefined,
        formats: schedForm.formats,
        outputDir: schedForm.destination === 'local' ? schedForm.outputDir : undefined,
        uploadTarget: schedForm.destination === 'cloud' ? schedForm.uploadTarget : undefined,
        bucket: schedForm.bucket.trim() || undefined,
        prefix: schedForm.prefix.trim() || undefined,
        jsonMode: schedForm.jsonMode,
        dbUrl: schedForm.destination === 'database' ? schedForm.dbUrl.trim() || undefined : undefined,
        ifExists: schedForm.ifExists,
        dbSchema: schedForm.dbSchema.trim() || undefined,
        cloudCreds: schedForm.destination === 'cloud' ? schedForm.cloudCreds : undefined,
        dateAnchors: schedForm.dateAnchors
          .filter(a => a.table && a.column && a.offsetDays !== '')
          .map(a => ({ table: a.table, column: a.column, offsetDays: parseInt(a.offsetDays) })),
      };

      const url = editingSchedule ? `/api/schedules/${editingSchedule.id}` : '/api/schedules';
      const method = editingSchedule ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeaders(auth.token),
        body: JSON.stringify({ name: schedForm.name.trim(), cronExpression: schedForm.cronExpression.trim(), config }),
      });
      const data = await res.json();
      if (!res.ok) { setSchedError(data.error || 'Save failed'); return; }
      setShowScheduleForm(false);
      setEditingSchedule(null);
      fetchSchedules();
    } catch (e: any) {
      setSchedError(e.message || String(e));
    } finally {
      setSchedSaving(false);
    }
  };

  const handleToggleSchedule = async (s: ScheduleDef) => {
    await fetch(`/api/schedules/${s.id}`, {
      method: 'PUT',
      headers: authHeaders(auth.token),
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    fetchSchedules();
  };

  const handleDeleteSchedule = async (s: ScheduleDef) => {
    showConfirm(t('schedule.deleteConfirmTitle', { name: s.name }), t('schedule.deleteConfirmMessage'), async () => {
      await fetch(`/api/schedules/${s.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } });
      fetchSchedules();
    });
  };

  const handleRunNow = async (s: ScheduleDef) => {
    await fetch(`/api/schedules/${s.id}/run`, { method: 'POST', headers: { Authorization: `Bearer ${auth.token}` } });
    setTimeout(() => fetchHistory(), 500);
  };

  type RegistryProvider = 'dockerhub' | 'ghcr' | 'gcr' | 'ecr' | 'acr' | 'custom';
  const [renderImageUrl, setRenderImageUrl] = useState('docker.io/ckoliveira/dataforge:latest');
  const [renderRegistry, setRenderRegistry] = useState<RegistryProvider>('dockerhub');
  const [renderRegistryInputs, setRenderRegistryInputs] = useState({
    dockerhubUser: '',
    dockerhubImage: 'dataforge',
    dockerhubTag: 'latest',
    ghcrUser: '',
    ghcrImage: 'dataforge',
    ghcrTag: 'latest',
    gcrProject: '',
    gcrImage: 'dataforge',
    gcrTag: 'latest',
    ecrAccount: '',
    ecrRegion: 'us-east-1',
    ecrImage: 'dataforge',
    ecrTag: 'latest',
    acrRegistry: '',
    acrImage: 'dataforge',
    acrTag: 'latest',
    customUrl: '',
  });
  const [showRenderExport, setShowRenderExport] = useState<ScheduleDef | null>(null);

  const REGISTRY_META: Record<RegistryProvider, { label: string; color: string; buildUrl: (i: typeof renderRegistryInputs) => string; loginCmd: string; pushCmd: (url: string) => string }> = {
    dockerhub: {
      label: 'Docker Hub',
      color: '#2496ed',
      buildUrl: i => `docker.io/${i.dockerhubUser || '<username>'}/${i.dockerhubImage}:${i.dockerhubTag}`,
      loginCmd: 'docker login',
      pushCmd: url => `docker build -t ${url} .\ndocker push ${url}`,
    },
    ghcr: {
      label: 'GitHub Container Registry',
      color: '#6e5494',
      buildUrl: i => `ghcr.io/${i.ghcrUser || '<github-user>'}/${i.ghcrImage}:${i.ghcrTag}`,
      loginCmd: 'echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin',
      pushCmd: url => `docker build -t ${url} .\ndocker push ${url}`,
    },
    gcr: {
      label: 'Google Container Registry',
      color: '#4285f4',
      buildUrl: i => `gcr.io/${i.gcrProject || '<project-id>'}/${i.gcrImage}:${i.gcrTag}`,
      loginCmd: 'gcloud auth configure-docker',
      pushCmd: url => `docker build -t ${url} .\ndocker push ${url}`,
    },
    ecr: {
      label: 'AWS ECR',
      color: '#ff9900',
      buildUrl: i => `${i.ecrAccount || '<account-id>'}.dkr.ecr.${i.ecrRegion}.amazonaws.com/${i.ecrImage}:${i.ecrTag}`,
      loginCmd: 'aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com',
      pushCmd: url => `docker build -t ${url} .\ndocker push ${url}`,
    },
    acr: {
      label: 'Azure Container Registry',
      color: '#0089d6',
      buildUrl: i => `${i.acrRegistry || '<registry>'}.azurecr.io/${i.acrImage}:${i.acrTag}`,
      loginCmd: 'az acr login --name <registry>',
      pushCmd: url => `docker build -t ${url} .\ndocker push ${url}`,
    },
    custom: {
      label: 'Custom URL',
      color: 'var(--text-muted)',
      buildUrl: i => i.customUrl || '<registry-url>/image:tag',
      loginCmd: 'docker login <registry-host>',
      pushCmd: url => `docker build -t ${url} .\ndocker push ${url}`,
    },
  };

  const computedImageUrl = (): string => {
    const m = REGISTRY_META[renderRegistry];
    return m.buildUrl(renderRegistryInputs);
  };

  const buildRenderYaml = (s: ScheduleDef, imageUrl: string): string => {
    const cfg = s.config;
    const fmt = (cfg.formats ?? ['csv']).join(' --format ');
    const cmdParts = [
      'dataset-gen generate',
      '--domain custom',
      '--config /app/schedule.yaml',
      `--format ${fmt}`,
    ];
    if (cfg.rows) cmdParts.push(`--rows ${cfg.rows}`);
    if (cfg.tables?.length) cmdParts.push(...cfg.tables.map((t: string) => `--tables ${t}`));
    if (cfg.uploadTarget) {
      cmdParts.push(`--upload ${cfg.uploadTarget}`);
      cmdParts.push('--bucket ${CLOUD_BUCKET}');
      cmdParts.push('--prefix ${CLOUD_PREFIX}');
    }
    if (cfg.dbUrl) cmdParts.push('--db-url ${DB_URL}');
    if (cfg.dateAnchors?.length) {
      for (const a of cfg.dateAnchors) {
        cmdParts.push(`--increment ${a.table}:${a.column}:${a.offsetDays}:days`);
      }
    }

    const envVars: string[] = [
      `      - key: PYTHONPATH\n        value: /app/src`,
    ];
    if (cfg.uploadTarget) {
      envVars.push(`      - key: CLOUD_BUCKET\n        value: "${cfg.bucket ?? ''}"`);
      envVars.push(`      - key: CLOUD_PREFIX\n        value: "${cfg.prefix ?? 'datasets/'}"`);
      if (cfg.uploadTarget === 'gcs') {
        envVars.push(`      # GCS: add GOOGLE_APPLICATION_CREDENTIALS via Secret Group`);
      } else if (cfg.uploadTarget === 's3') {
        envVars.push(`      - key: AWS_ACCESS_KEY_ID\n        sync: false`);
        envVars.push(`      - key: AWS_SECRET_ACCESS_KEY\n        sync: false`);
      } else if (cfg.uploadTarget === 'azure') {
        envVars.push(`      - key: AZURE_STORAGE_CONNECTION_STRING\n        sync: false`);
      }
    }
    if (cfg.dbUrl) {
      envVars.push(`      - key: DB_URL\n        sync: false  # set in Render dashboard`);
    }

    return `# Render Blueprint — generated from schedule "${s.name}"
# Docs: https://render.com/docs/blueprint-spec

services:
  - type: cron
    name: ${s.name.toLowerCase().replace(/\s+/g, '-')}
    image:
      url: ${imageUrl}
    schedule: "${s.cronExpression}"
    dockerCommand: >-
      ${cmdParts.join(' \\\n        ')}
    envVars:
${envVars.join('\n')}
`;
  };

  const handleDownloadRenderYaml = (s: ScheduleDef, imageUrl: string) => {
    const content = buildRenderYaml(s, imageUrl);
    const blob = new Blob([content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `render-${s.name.toLowerCase().replace(/\s+/g, '-')}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    setShowRenderExport(null);
  };

  const openEditSchedule = (s: ScheduleDef) => {
    setEditingSchedule(s);
    const cfg = s.config;
    setSchedForm({
      name: s.name,
      cronExpression: s.cronExpression,
      destination: cfg.uploadTarget ? 'cloud' : cfg.dbUrl ? 'database' : 'local',
      formats: cfg.formats ?? ['csv'],
      outputDir: cfg.outputDir ?? 'output',
      rows: cfg.rows != null ? String(cfg.rows) : '',
      jsonMode: cfg.jsonMode ?? 'flat',
      uploadTarget: cfg.uploadTarget ?? 'gcs',
      bucket: cfg.bucket ?? '',
      prefix: cfg.prefix ?? 'datasets/',
      dbUrl: cfg.dbUrl ?? '',
      ifExists: cfg.ifExists ?? 'append',
      dbSchema: cfg.dbSchema ?? '',
      tablesToInclude: cfg.tables ?? [],
      cloudCreds: cfg.cloudCreds ?? { gcsJson: '', s3AccessKey: '', s3SecretKey: '', s3Region: 'us-east-1', azureConnStr: '' },
      dateAnchors: (cfg.dateAnchors ?? []).map((a: any) => ({ ...a, offsetDays: String(a.offsetDays) })),
    });
    setSchedError('');
    // sync visual builder from cron expression
    const parts = s.cronExpression.trim().split(/\s+/);
    if (parts.length >= 4) setSchedVisual({ minute: parts[0], hour: parts[1], day: parts[2], month: parts[3] });
    setSchedBuilderMode('visual');
    setShowScheduleForm(true);
  };

  const openNewSchedule = () => {
    setEditingSchedule(null);
    setSchedVisual({ minute: '0', hour: '9', day: '*', month: '*' });
    setSchedBuilderMode('visual');
    setSchedForm({
      name: '',
      cronExpression: '0 9 * * *',
      destination: 'local',
      formats: ['csv'],
      outputDir: 'output',
      rows: '',
      jsonMode: 'flat',
      uploadTarget: 'gcs',
      bucket: '',
      prefix: 'datasets/',
      dbUrl: '',
      ifExists: 'append',
      dbSchema: '',
      tablesToInclude: [],
      cloudCreds: { gcsJson: '', s3AccessKey: '', s3SecretKey: '', s3Region: 'us-east-1', azureConnStr: '' },
      dateAnchors: [],
    });
    setSchedError('');
    setShowScheduleForm(true);
  };

  const cronDescription = (expr: string): string => {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return '';
    const [min, hr, dom, mon, dow] = parts;
    if (dom === '*' && mon === '*' && dow === '*') {
      if (hr === '*' && min === '*') return 'Every minute';
      if (hr === '*') return `Every hour at :${min.padStart(2,'0')}`;
      const hrN = parseInt(hr); const minN = parseInt(min);
      if (!isNaN(hrN) && !isNaN(minN)) {
        const ap = hrN >= 12 ? 'PM' : 'AM';
        const h = hrN % 12 || 12;
        const m = String(minN).padStart(2,'0');
        return `Every day at ${h}:${m} ${ap} UTC`;
      }
    }
    if (dow !== '*' && dom === '*' && mon === '*') {
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const d = days[parseInt(dow)];
      if (d) {
        const hrN = parseInt(hr); const minN = parseInt(min);
        if (!isNaN(hrN) && !isNaN(minN)) {
          const ap = hrN >= 12 ? 'PM' : 'AM';
          const h = hrN % 12 || 12;
          return `Every ${d} at ${h}:${String(minN).padStart(2,'0')} ${ap} UTC`;
        }
      }
    }
    return '';
  };

  const [showRunPanel, setShowRunPanel] = useState(false);
  const [showRunHelp, setShowRunHelp] = useState(false);
  const [canBrowseFolder, setCanBrowseFolder] = useState(false);
  const [credProfiles, setCredProfiles] = useState<{ name: string; provider: string }[]>([]);
  const [saveCredName, setSaveCredName] = useState('');
  const [showSaveCredInput, setShowSaveCredInput] = useState(false);

  React.useEffect(() => {
    fetch('/api/capabilities').then(r => r.json()).then(d => setCanBrowseFolder(!!d.browseFolder)).catch(() => {});
    fetchCredProfiles();
  }, []);

  const fetchCredProfiles = () => {
    fetch('/api/credential-profiles').then(r => r.json()).then(setCredProfiles).catch(() => {});
  };

  const handleSaveCredProfile = async () => {
    const name = saveCredName.trim();
    if (!name) return;
    await fetch('/api/credential-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, provider: runConfig.uploadTarget, creds: runConfig.cloudCreds }),
    });
    setSaveCredName('');
    setShowSaveCredInput(false);
    fetchCredProfiles();
  };

  const handleLoadCredProfile = async (name: string) => {
    const res = await fetch(`/api/credential-profiles/${encodeURIComponent(name)}`);
    const profile = await res.json();
    setRunConfig(r => ({ ...r, uploadTarget: profile.provider, cloudCreds: profile.creds }));
  };

  const handleDeleteCredProfile = async (name: string) => {
    await fetch(`/api/credential-profiles/${encodeURIComponent(name)}`, { method: 'DELETE' });
    fetchCredProfiles();
  };
  const RUN_CREDS_STORAGE = 'dataforge_run_creds';
  const loadRunCreds = () => { try { return JSON.parse(localStorage.getItem(RUN_CREDS_STORAGE) || '{}'); } catch { return {}; } };

  const [runConfig, setRunConfig] = useState<{
    formats: string[],
    destination: 'local' | 'cloud' | 'database',
    outputDir: string,
    rows: string,
    uploadTarget: string,
    bucket: string,
    prefix: string,
    partitionByTable: Record<string, string>,
    partitionDateGranularity: Record<string, string>,
    jsonMode: string,
    seed: string,
    dbUrl: string,
    ifExists: string,
    dbSchema: string,
    recurrence: string,
    count: string,
    tablesToInclude: string[],
    columnsFilter: string,
    workers: string,
    increments: Array<{ table: string; column: string; step: string; unit: string }>,
    cloudCreds: {
      gcsJson: string,
      s3AccessKey: string,
      s3SecretKey: string,
      s3Region: string,
      azureConnStr: string,
    },
  }>({
    formats: ['csv'],
    destination: 'local' as 'local' | 'cloud' | 'database',
    outputDir: 'output',
    rows: '',
    uploadTarget: 'gcs',
    bucket: '',
    prefix: 'datasets/',
    partitionByTable: {},
    partitionDateGranularity: {},
    jsonMode: 'flat',
    seed: '',
    dbUrl: loadRunCreds().dbUrl ?? '',
    ifExists: 'replace',
    dbSchema: '',
    recurrence: '',
    count: '',
    tablesToInclude: [],
    columnsFilter: '',
    increments: [],
    workers: '16',
    cloudCreds: {
      gcsJson:      loadRunCreds().cloudCreds?.gcsJson      ?? '',
      s3AccessKey:  loadRunCreds().cloudCreds?.s3AccessKey  ?? '',
      s3SecretKey:  loadRunCreds().cloudCreds?.s3SecretKey  ?? '',
      s3Region:     loadRunCreds().cloudCreds?.s3Region     ?? 'us-east-1',
      azureConnStr: loadRunCreds().cloudCreds?.azureConnStr ?? '',
    },
  });
  const computedDbUrl = dbAdvanced ? runConfig.dbUrl : buildDbUrl(dbForm);


  // ── Persist credential key refs to localStorage ────────────────────────────
  useEffect(() => {
    localStorage.setItem(RUN_CREDS_STORAGE, JSON.stringify({ dbUrl: runConfig.dbUrl, cloudCreds: runConfig.cloudCreds }));
  }, [runConfig.dbUrl, runConfig.cloudCreds]);

  // ── Sync env-keys → auto-select key NAMES (not values) in AI / Cloud / DB ───
  // Fields store the env key NAME (e.g. "AWS_ACCESS_KEY_ID"); values resolved at send time.
  useEffect(() => {
    if (Object.keys(envKeys).length === 0) return;

    // AI: auto-select the first matching key name for each provider (only if not already set)
    const aiKeyMap: Record<string, string> = {
      ANTHROPIC_API_KEY: 'anthropic', OPENAI_API_KEY: 'openai',
      GOOGLE_API_KEY: 'google',       GEMINI_API_KEY: 'google',
      GROQ_API_KEY: 'groq',           MISTRAL_API_KEY: 'mistral',
      TOGETHER_API_KEY: 'together',
    };
    setAiApiKeys(prev => {
      const next = { ...prev };
      for (const [envVar, provider] of Object.entries(aiKeyMap)) {
        if (envKeys[envVar] && !next[provider]) next[provider] = envVar; // store the NAME
      }
      return next;
    });

    // Cloud: auto-select key names (only if field is empty)
    const defaultCloudNames: Partial<Record<string, string>> = {
      s3AccessKey: envKeys['AWS_ACCESS_KEY_ID']                    ? 'AWS_ACCESS_KEY_ID'                    : undefined,
      s3SecretKey: envKeys['AWS_SECRET_ACCESS_KEY']                 ? 'AWS_SECRET_ACCESS_KEY'                 : undefined,
      s3Region:    envKeys['AWS_DEFAULT_REGION']                    ? 'AWS_DEFAULT_REGION'
                 : envKeys['AWS_REGION']                            ? 'AWS_REGION'                            : undefined,
      gcsJson:     envKeys['GCS_JSON']                              ? 'GCS_JSON'
                 : envKeys['GOOGLE_APPLICATION_CREDENTIALS_JSON']   ? 'GOOGLE_APPLICATION_CREDENTIALS_JSON'   : undefined,
      azureConnStr: envKeys['AZURE_STORAGE_CONNECTION_STRING']      ? 'AZURE_STORAGE_CONNECTION_STRING'       : undefined,
    };
    setRunConfig(r => {
      const creds = { ...r.cloudCreds };
      for (const [field, name] of Object.entries(defaultCloudNames)) {
        if (name && !(r.cloudCreds as any)[field]) (creds as any)[field] = name;
      }
      const dbUrl = !r.dbUrl && envKeys['DATABASE_URL'] ? 'DATABASE_URL' : r.dbUrl;
      return { ...r, cloudCreds: creds, dbUrl };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envKeys]);

  const [runLogs, setRunLogs] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const runAbortRef = useRef<AbortController | null>(null);

  const handleRunCli = async () => {
    const controller = new AbortController();
    runAbortRef.current = controller;
    setIsRunning(true);
    setRunLogs('');
    try {
      const yamlStr = SchemaWriter.generateYaml(domain, tables);
      const res = await fetch('/api/run-cli', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        signal: controller.signal,
        body: JSON.stringify({
          yamlStr,
          formats: runConfig.formats,
          outputDir: runConfig.outputDir,
          rows: runConfig.rows !== '' ? parseInt(runConfig.rows) : undefined,
          uploadTarget: runConfig.destination === 'cloud' ? runConfig.uploadTarget : undefined,
          bucket: runConfig.bucket.trim(),
          prefix: runConfig.prefix.trim() || domain,
          partitionByTable: Object.keys(runConfig.partitionByTable).length > 0 ? runConfig.partitionByTable : undefined,
          partitionDateGranularity: Object.keys(runConfig.partitionDateGranularity).length > 0 ? runConfig.partitionDateGranularity : undefined,
          jsonMode: runConfig.jsonMode,
          seed: runConfig.seed !== '' ? parseInt(runConfig.seed) : undefined,
          dbUrl: runConfig.destination === 'database'
            ? (dbAdvanced ? (envKeys[runConfig.dbUrl] ?? runConfig.dbUrl) : computedDbUrl) || undefined
            : undefined,
          ifExists: runConfig.ifExists,
          dbSchema: runConfig.dbSchema || undefined,
          recurrence: runConfig.recurrence !== '' ? parseFloat(runConfig.recurrence) : undefined,
          count: runConfig.count !== '' ? parseInt(runConfig.count) : undefined,
          tables: runConfig.tablesToInclude.length > 0 ? runConfig.tablesToInclude : undefined,
          columns: runConfig.columnsFilter.trim() ? runConfig.columnsFilter.trim().split('\n').filter(Boolean) : undefined,
          increments: runConfig.increments.filter(i => i.table && i.column && i.step !== ''),
          workers: runConfig.workers !== '' ? parseInt(runConfig.workers) : 16,
          cloudCreds: runConfig.destination === 'cloud' ? {
            gcsJson:      envKeys[runConfig.cloudCreds.gcsJson]      ?? runConfig.cloudCreds.gcsJson,
            s3AccessKey:  envKeys[runConfig.cloudCreds.s3AccessKey]  ?? '',
            s3SecretKey:  envKeys[runConfig.cloudCreds.s3SecretKey]  ?? '',
            s3Region:     envKeys[runConfig.cloudCreds.s3Region]     ?? runConfig.cloudCreds.s3Region,
            azureConnStr: envKeys[runConfig.cloudCreds.azureConnStr] ?? '',
          } : undefined,
        })
      });

      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE lines are separated by \n\n
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.startsWith('data: ') ? part.slice(6) : part;
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'cmd' || msg.type === 'out') {
              setRunLogs(prev => prev + msg.text);
            } else if (msg.type === 'done') {
              const statusLine = msg.stopped ? '\n' + t('run.stopped') : msg.success ? '\n' + t('run.done') : '\n' + t('run.failed');
              setRunLogs(prev => prev + statusLine);
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if ((e as DOMException).name !== 'AbortError') {
        setRunLogs(prev => prev + `\n${t('run.connectionError')} ${e.message || String(e)}`);
      }
    } finally {
      setIsRunning(false);
      runAbortRef.current = null;
    }
  };

  const handleStopCli = async () => {
    await fetch('/api/stop-cli', { method: 'POST' });
    setRunLogs(prev => prev + '\n' + t('run.stopRequested'));
  };

  // Sync position changes back to tables state dynamically when nodes are dragged
  const onNodeDragStop = (_event: React.MouseEvent, node: Node) => {
    setTables(ts => ts.map(t => t.id === node.id ? { ...t, position: node.position } : t));
  };


  const selectedTable = tables.find(t => t.id === selectedTableId);

  return (
    <div className="container animated" style={{ maxWidth: '100vw', padding: '1rem', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img src="/logo-icon.png" alt="Dataforge icon" style={{ height: '52px', objectFit: 'contain' }} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
            Data<span style={{ color: 'var(--primary)' }}>forge</span>
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>{t('auth.subtitle')}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-subtle)', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.12)', borderRadius: '999px', padding: '0.2rem 0.75rem', letterSpacing: '0.04em' }}>
            v{__APP_VERSION__}
          </span>
          <a href="https://ckoliveiraa.github.io/DataForge/" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', transition: 'color var(--duration-base) var(--ease-out)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-main)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <svg height="18" width="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            {t('nav.docs')}
          </a>
          <a href="https://github.com/ckoliveiraa/DataForge" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', transition: 'color var(--duration-base) var(--ease-out)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-main)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <svg height="18" width="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
                -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
                .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
                .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
                0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            {t('nav.github')}
          </a>

          {/* User badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '1rem', marginLeft: '0.25rem' }}>
            {/* Language toggle */}
            <div
              onClick={() => i18n.changeLanguage(i18n.language === 'pt-BR' ? 'en' : 'pt-BR')}
              title={t('common.language')}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '999px',
                padding: '0.18rem',
                cursor: 'pointer',
                position: 'relative',
                gap: '0.1rem',
                userSelect: 'none',
              }}
            >
              {(['pt-BR', 'en'] as const).map(lang => (
                <span key={lang} style={{
                  position: 'relative',
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: i18n.language === lang ? 'var(--primary)' : 'var(--text-muted)',
                  background: i18n.language === lang ? 'rgba(34,211,238,0.18)' : 'transparent',
                  border: i18n.language === lang ? '1px solid rgba(34,211,238,0.35)' : '1px solid transparent',
                  borderRadius: '999px',
                  transition: 'color 0.2s, background 0.2s',
                  letterSpacing: '0.02em',
                  fontFamily: 'var(--font-display)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ fontSize: '0.75rem', lineHeight: 1 }}>{lang === 'pt-BR' ? '🇧🇷' : '🇺🇸'}</span>
                  {lang === 'pt-BR' ? 'PT-BR' : 'EN'}
                </span>
              ))}
            </div>
            <button
              onClick={() => setShowProfilePanel(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: '999px', padding: '0.3rem 0.7rem', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,211,238,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,211,238,0.08)')}>
              <User size={14} />
              {auth.username}
            </button>
            <button onClick={onLogout} className="btn-icon" title={t('nav.signOut')} aria-label={t('nav.signOut')} style={{ color: 'var(--text-muted)' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1, marginRight: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <label style={{margin: 0, paddingRight: '0.5rem'}}>{t('nav.domain')}</label>
             <select value={domain} onChange={handleDomainChange} style={{width: 'auto', padding: '0.5rem'}}>
               {validDomains.map((d: string) => <option key={d} value={d}>{d}</option>)}
             </select>
             {domain !== 'custom' && (
               <button
                 onClick={handleDeleteDomain}
                 className="btn-icon-danger"
                 aria-label={`Delete schema ${domain}`}
               >
                 <Trash2 size={16} />
               </button>
             )}
          </div>
          <button className="btn-primary" onClick={addTable} style={{ padding: '0.5rem 1rem' }}>
            <Plus size={16} /> {t('nav.addTable')}
          </button>
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} style={{ padding: '0.5rem 1rem' }} title="Load schema from a .yaml/.yml file">
            <BookOpen size={16} /> {t('nav.loadYaml')}
          </button>
          <button
            className="btn-accent"
            onClick={() => { setAiError(''); setAiModal(true); }}
            style={{ padding: '0.5rem 1rem' }}
          >
            <Sparkles size={16} /> {t('nav.aiGenerate')}
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {tables.length > 0 && (
             <button className="btn-secondary" onClick={onLayout} style={{ padding: '0.5rem 1rem' }}>
               <Network size={16} /> {t('nav.autoLayout')}
             </button>
          )}
          <input
            type="file"
            accept=".yaml,.yml"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          {tables.length > 0 && (
             <button className="btn-secondary" onClick={generateSchema} style={{ padding: '0.5rem 1rem' }}>
               <FileJson size={16} /> {t('nav.previewYaml')}
             </button>
          )}
          {tables.length > 0 && (
             <button className="btn-warning" onClick={() => { setSaveName(domain !== 'custom' ? domain : ''); setSaveError(''); setSaveModal(true); }} style={{ padding: '0.5rem 1rem' }}>
               <Download size={16} /> {t('nav.saveAsDefault')}
             </button>
          )}
          {tables.length > 0 && (
             <button className="btn-success" onClick={() => setShowRunPanel(true)} style={{ padding: '0.5rem 1rem' }}>
               <Play size={16} /> {t('nav.runGenerator')}
             </button>
          )}
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button className="btn-secondary" disabled style={{ padding: '0.5rem 1rem', opacity: 0.4, cursor: 'not-allowed' }}>
              <Clock size={16} /> {t('nav.schedules')}
            </button>
            <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--primary)', color: '#000', fontSize: '0.6rem', fontWeight: 700, padding: '2px 5px', borderRadius: '999px', letterSpacing: '0.03em', textTransform: 'uppercase', pointerEvents: 'none', whiteSpace: 'nowrap' }}>{t('nav.comingSoon')}</span>
          </div>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button className="btn-secondary" disabled style={{ padding: '0.5rem 1rem', opacity: 0.4, cursor: 'not-allowed' }}>
              <History size={16} /> {t('nav.history')}
            </button>
            <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--primary)', color: '#000', fontSize: '0.6rem', fontWeight: 700, padding: '2px 5px', borderRadius: '999px', letterSpacing: '0.03em', textTransform: 'uppercase', pointerEvents: 'none', whiteSpace: 'nowrap' }}>{t('nav.comingSoon')}</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-mid)', display: 'flex' }}>

        
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_, node) => setSelectedTableId(node.id)}
            onPaneClick={() => setSelectedTableId(null)}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView
            style={{ width: '100%', height: '100%' }}
          >
            <Background color="rgba(255,255,255,0.06)" gap={24} size={1} />
            <Controls />
          </ReactFlow>

          {generatedYaml && (
            <div className="glass-panel animated" style={{ position: 'absolute', top: '1rem', right: '1rem', left: '1rem', zIndex: 10, maxHeight: '30vh', overflowY: 'auto', border: '1px solid rgba(34, 211, 238, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>YAML Schema</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-secondary" onClick={downloadYaml} style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
                    <Download size={14} /> Download
                  </button>
                  <button className="btn-danger" onClick={() => setGeneratedYaml('')} style={{ padding: '0.25rem 0.5rem' }}>
                    <X size={14} />
                  </button>
                </div>
              </div>
              <pre style={{ margin: 0, padding: '0.5rem', fontSize: '0.8rem' }}>{generatedYaml}</pre>
            </div>
          )}
        </div>

        {/* Edit Sidebar */}
        {selectedTable && (
          <div className="animated" style={{
            width: '400px',
            background: 'rgba(7, 9, 15, 0.97)',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            padding: '1.5rem',
            height: '100%',
            overflowY: 'auto',
            backdropFilter: 'blur(20px)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{t('schema.editTable')}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => onRemoveTable(selectedTable.id)}
                  className="btn-icon-danger"
                  aria-label={t('schema.deleteTable')}
                >
                  <Trash2 size={16}/>
                </button>
                <button onClick={() => setSelectedTableId(null)} className="btn-icon" aria-label={t('schema.closePanel')}>
                  <X size={16}/>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>{t('schema.tableName')}</label>
              <input
                type="text"
                value={selectedTable.name}
                onChange={e => onUpdateTable(selectedTable.id, 'name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>{t('schema.rowsCount')}</label>
              <input 
                type="number" 
                value={selectedTable.rows} 
                onChange={e => onUpdateTable(selectedTable.id, 'rows', parseInt(e.target.value) || 0)} 
                min="1"
              />
            </div>

            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{t('schema.columns')}</h3>
                <button className="btn-secondary" onClick={() => onAddColumn(selectedTable.id)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>
                  <Plus size={14} /> {t('schema.add')}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedTable.columns.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', border: '1px dashed var(--border-mid)', borderRadius: '8px' }}>
                    {t('schema.noColumnsDefined')}
                  </div>
                ) : (
                  selectedTable.columns.map(col => (
                    <div key={col.id} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <input
                          value={col.name}
                          onChange={(e) => onUpdateColumn(selectedTable.id, col.id, 'name', e.target.value)}
                          placeholder={t('schema.columnName')}
                          style={{ flex: 1, marginRight: '0.5rem', padding: '0.5rem' }}
                        />
                        <button
                          onClick={() => onRemoveColumn(selectedTable.id, col.id)}
                          className="btn-icon-danger"
                          aria-label={t('schema.removeColumn')}
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('schema.type')}</label>
                          <select 
                            value={col.dtype} 
                            onChange={(e) => onUpdateColumn(selectedTable.id, col.id, 'dtype', e.target.value)}
                            style={{ padding: '0.5rem' }}
                          >
                            {VALID_DTYPES.map(d => <option key={d} value={d} style={{color: '#000'}}>{d}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('schema.nullable')}</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={parseFloat(col.nullable as any) > 0}
                                onChange={e => onUpdateColumn(selectedTable.id, col.id, 'nullable', e.target.checked ? '0.5' : '0')}
                                style={{ width: '1rem', height: '1rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                              />
                            </label>
                            {parseFloat(col.nullable as any) > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={Math.round(parseFloat(col.nullable as any) * 100)}
                                  onChange={e => {
                                    const pct = Math.min(100, Math.max(1, parseInt(e.target.value) || 1));
                                    onUpdateColumn(selectedTable.id, col.id, 'nullable', String(pct / 100));
                                  }}
                                  style={{ width: '52px', padding: '0.3rem 0.4rem', fontSize: '0.8rem', textAlign: 'center' }}
                                />
                                <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>%</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>{t('schema.no')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {['int', 'float', 'date'].includes(col.dtype) && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('schema.min')}</label>
                            <input
                              value={col.min}
                              onChange={e => onUpdateColumn(selectedTable.id, col.id, 'min', e.target.value)}
                              placeholder={col.dtype === 'date' ? t('schema.datePlaceholderMin') : t('schema.numericPlaceholderMin')}
                              style={{ padding: '0.5rem', width: '100%', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('schema.max')}</label>
                            <input
                              value={col.max}
                              onChange={e => onUpdateColumn(selectedTable.id, col.id, 'max', e.target.value)}
                              placeholder={col.dtype === 'date' ? t('schema.datePlaceholderMax') : t('schema.numericPlaceholderMax')}
                              style={{ padding: '0.5rem', width: '100%', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>
                      )}

                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <button
                            onClick={() => { onUpdateColumn(selectedTable.id, col.id, 'choices', []); }}
                            style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: `1px solid ${col.choices.length === 0 ? 'rgba(34,211,238,0.4)' : 'transparent'}`, cursor: 'pointer', background: col.choices.length === 0 ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.05)', color: col.choices.length === 0 ? 'var(--primary)' : 'var(--text-muted)' }}
                          >
                            {t('schema.fakerMethod')}
                          </button>
                          <button
                            onClick={() => { onUpdateColumn(selectedTable.id, col.id, 'fakerProvider', ''); onUpdateColumn(selectedTable.id, col.id, 'choices', col.choices.length === 0 ? [''] : col.choices); }}
                            style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: `1px solid ${col.choices.length > 0 ? 'rgba(251,146,60,0.4)' : 'transparent'}`, cursor: 'pointer', background: col.choices.length > 0 ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.05)', color: col.choices.length > 0 ? 'var(--accent)' : 'var(--text-muted)' }}
                          >
                            {t('schema.customList')}
                          </button>
                        </div>

                        {col.choices.length === 0 ? (
                          <div style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <div style={{ flex: 1, position: 'relative' }}>
                                <input
                                  type="text"
                                  value={col.fakerProvider}
                                  onChange={e => {
                                    onUpdateColumn(selectedTable.id, col.id, 'fakerProvider', e.target.value);
                                    setFakerDropdown({ tableId: selectedTable.id, colId: col.id });
                                  }}
                                  onFocus={() => setFakerDropdown({ tableId: selectedTable.id, colId: col.id })}
                                  onBlur={() => setTimeout(() => setFakerDropdown(null), 150)}
                                  placeholder={t('schema.fakerMethodPlaceholder')}
                                  style={{ padding: '0.5rem', paddingRight: '1.8rem' }}
                                />
                                {col.fakerProvider && (
                                  <button onClick={() => onUpdateColumn(selectedTable.id, col.id, 'fakerProvider', '')}
                                    style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                              <button
                                title={t('schema.browseAllFakerMethods')}
                                onClick={() => { setFakerSearch(''); setFakerBrowser({ tableId: selectedTable.id, colId: col.id }); }}
                                style={{ padding: '0.4rem 0.6rem', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: '6px', color: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}>
                                <BookOpen size={15} />
                              </button>
                            </div>
                            {fakerDropdown?.tableId === selectedTable.id && fakerDropdown?.colId === col.id && (() => {
                              const q = col.fakerProvider.toLowerCase();
                              const hits = q.length === 0
                                ? allFakerMethods.slice(0, 8)
                                : allFakerMethods.filter(m => m.name.includes(q)).slice(0, 8);
                              if (hits.length === 0) return null;
                              return (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: '2.6rem', zIndex: 50, marginTop: '2px', background: 'rgba(10,13,20,0.98)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}>
                                  {hits.map(m => (
                                    <button key={m.name} onMouseDown={() => onUpdateColumn(selectedTable.id, col.id, 'fakerProvider', m.name)}
                                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.45rem 0.75rem', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left' }}>
                                      <span style={{ fontSize: '0.65rem', background: `${m.color}22`, color: m.color, borderRadius: '3px', padding: '0.1rem 0.35rem', flexShrink: 0 }}>{m.category}</span>
                                      <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{m.name}</span>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginLeft: 'auto', flexShrink: 0 }}>{m.example}</span>
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '6px', padding: '0.5rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                              {col.choices.filter(v => v !== '').map((val, idx) => (
                                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.8rem' }}>
                                  {val}
                                  <button
                                    onClick={() => onUpdateColumn(selectedTable.id, col.id, 'choices', col.choices.filter((_, i) => i !== idx))}
                                    style={{ background: 'transparent', border: 'none', color: '#c4b5fd', cursor: 'pointer', padding: '0', lineHeight: 1, fontSize: '0.9rem' }}
                                  >×</button>
                                </span>
                              ))}
                            </div>
                            <input
                              type="text"
                              placeholder={t('schema.typeValueAndEnter')}
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', background: 'transparent', border: '1px dashed rgba(139,92,246,0.3)', borderRadius: '4px', color: 'white', width: '100%' }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ',') {
                                  e.preventDefault();
                                  const val = (e.target as HTMLInputElement).value.trim();
                                  if (val) {
                                    onUpdateColumn(selectedTable.id, col.id, 'choices', [...col.choices.filter(v => v !== ''), val]);
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }
                              }}
                            />
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('schema.pressEnterOrComma')}</p>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input type="checkbox" checked={col.isPrimaryKey} onChange={(e) => onUpdateColumn(selectedTable.id, col.id, 'isPrimaryKey', e.target.checked)} />
                          <Key size={14} color="#eab308"/> {t('schema.primaryKey')}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input type="checkbox" checked={col.isForeignKey} onChange={(e) => onUpdateColumn(selectedTable.id, col.id, 'isForeignKey', e.target.checked)} />
                          <LinkIcon size={14} color="var(--accent)"/> {t('schema.foreignKey')}
                        </label>
                      </div>

                      {col.isForeignKey && (
                        <div style={{ background: 'var(--accent-glow)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(251,146,60,0.25)' }}>
                          <div style={{ marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>{t('schema.refTableName')}</label>
                            <input
                              type="text"
                              value={col.fkTable}
                              onChange={e => onUpdateColumn(selectedTable.id, col.id, 'fkTable', e.target.value)}
                              style={{ padding: '0.5rem', border: '1px solid rgba(251,146,60,0.3)' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>{t('schema.refColumnName')}</label>
                            <input
                              type="text"
                              value={col.fkColumn}
                              onChange={e => onUpdateColumn(selectedTable.id, col.id, 'fkColumn', e.target.value)}
                              style={{ padding: '0.5rem', border: '1px solid rgba(251,146,60,0.3)' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Run Generator Help Modal */}
      {showRunHelp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowRunHelp(false)}>
          <div style={{ width: '560px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', background: 'rgba(9,12,20,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem' }}>{t('run.fieldReference')}</h3>
              <button onClick={() => setShowRunHelp(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
            </div>
            {([
              { section: 'Format', fields: [
                { name: 'Format (CSV / JSON / Parquet / Avro)', desc: 'Output file format. You can select multiple at once — the generator will write one file per format for each table.' },
                { name: 'JSON Mode', desc: 'Flat (NDJSON): one JSON object per line, ideal for large files and streaming pipelines.\nNested: a single JSON array — easier to read but heavier in memory.' },
                { name: 'Rows Override', desc: 'Override the number of rows defined in the schema for all tables. Leave empty to use the schema defaults.' },
              ]},
              { section: 'Destination', fields: [
                { name: 'Local', desc: 'Save generated files to a folder on this machine. Click the 📁 button to browse and select the folder path.' },
                { name: 'Cloud', desc: 'Upload generated files directly to a cloud bucket (GCS, S3, or Azure Blob Storage). Credentials are auto-loaded from the credentials/ folder in the project root.' },
                { name: 'Bucket / Container', desc: 'Name of the target cloud bucket or container where files will be uploaded.' },
                { name: 'Prefix', desc: 'Remote path prefix inside the bucket. Example: datasets/ → files land at datasets/schema_name/table_name/file.csv.' },
                { name: 'Database', desc: 'Load generated data directly into a database table. Supports PostgreSQL, MySQL and SQLite.' },
                { name: 'Database Type', desc: 'Choose the database engine. The connection form adapts to the selected type.' },
                { name: 'File Path (SQLite)', desc: 'Path to the SQLite .db file. It will be created if it does not exist.' },
                { name: 'Host / Port', desc: 'Address and port of the database server. Defaults are pre-filled per engine (PostgreSQL: 5432, MySQL: 3306).' },
                { name: 'Database', desc: 'Name of the database to connect to.' },
                { name: 'User / Password', desc: 'Credentials for the database connection.' },
                { name: 'If Table Exists', desc: 'Replace: drops and recreates the table.\nAppend: inserts rows without deleting existing data.\nFail: aborts if the table already exists.' },
                { name: 'DB Schema', desc: 'Optional database schema namespace (e.g. public in PostgreSQL). Leave empty to use the default.' },
              ]},
              { section: 'Reproducibility', fields: [
                { name: 'Random Seed', desc: 'Fixed integer seed for the random generator. Using the same seed always produces identical data — useful for testing and reproducible demos.' },
              ]},
              { section: 'Recurrence', fields: [
                { name: 'Interval (seconds)', desc: 'When set, the generator runs continuously, producing a new batch of data every N seconds. Press Stop to end the loop.' },
                { name: 'Batch Limit', desc: 'Maximum number of batches to run. Set to 0 for infinite recurrence (stop manually with the Stop button).' },
                { name: 'Column Increments', desc: 'Shifts a column\'s values forward by a fixed step on each batch — useful to simulate time-series or growing IDs.\nExample: orders › created_at › step 1 › days → each batch adds 1 day to all dates.' },
              ]},
            ] as { section: string; fields: { name: string; desc: string }[] }[]).map(({ section, fields }) => (
              <div key={section} style={{ marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)' }}>{section}</p>
                {fields.map(({ name, desc }) => (
                  <div key={name} style={{ marginBottom: '0.75rem', paddingLeft: '0.75rem', borderLeft: '2px solid rgba(34,211,238,0.2)' }}>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>{name}</p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{desc}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run Generator Modal */}
      {showRunPanel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animated-scale" style={{ width: '580px', maxWidth: '95vw', padding: '1.5rem', background: 'rgba(9, 12, 20, 0.97)', border: '1px solid rgba(255,255,255,0.08)', borderTopColor: 'rgba(255,255,255,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Play size={18} color="var(--success)"/> {t('run.title')}</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => setShowRunHelp(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-mid)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>? Help</button>
                <button onClick={() => setShowRunPanel(false)} className="btn-icon" aria-label="Close run panel"><X size={18}/></button>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.25rem' }}>

              {/* Formats + JSON mode */}
              {runConfig.destination !== 'database' && <div style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)' }}>{t('run.format')}</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(['csv', 'json', 'parquet', 'avro'] as const).map(fmt => {
                    const active = runConfig.formats.includes(fmt);
                    return (
                      <button key={fmt} type="button"
                        onClick={() => {
                          const next = active
                            ? runConfig.formats.filter(f => f !== fmt)
                            : [...runConfig.formats, fmt];
                          setRunConfig(r => ({ ...r, formats: next.length > 0 ? next : [fmt] }));
                        }}
                        style={{ padding: '0.35rem 0.85rem', borderRadius: '6px', border: `1px solid ${active ? 'var(--success)' : 'var(--border-color)'}`, background: active ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)', color: active ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: active ? 600 : 400 }}>
                        {fmt.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                {runConfig.formats.includes('json') && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.jsonMode')}</label>
                    <select value={runConfig.jsonMode} onChange={e => setRunConfig(r => ({...r, jsonMode: e.target.value}))} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                      <option value="flat" style={{color: 'black'}}>{t('run.flat')}</option>
                      <option value="nested" style={{color: 'black'}}>{t('run.nested')}</option>
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.rowsOverride')} <span style={{ color: 'var(--text-muted)' }}>({t('ai.optional')})</span></label>
                    <input type="number" value={runConfig.rows} onChange={e => setRunConfig(r => ({...r, rows: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. 5000" min="1" />
                  </div>
                </div>
              </div>}

              {/* Destination */}
              <div style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)' }}>{t('run.destination')}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  {([
                    { key: 'local', label: t('run.local'), color: '#60a5fa' },
                    { key: 'cloud', label: t('run.cloud'), color: '#a78bfa' },
                    { key: 'database', label: t('run.database'), color: '#f59e0b' },
                  ] as const).map(({ key, label, color }) => {
                    const active = runConfig.destination === key;
                    return (
                      <button key={key} type="button"
                        onClick={() => setRunConfig(r => ({ ...r, destination: key }))}
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: `1px solid ${active ? color : 'var(--border-color)'}`, background: active ? `${color}18` : 'rgba(255,255,255,0.04)', color: active ? color : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: active ? 700 : 400, transition: 'all 0.15s' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Local */}
                {runConfig.destination === 'local' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.outputDirectory')}</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="text" value={runConfig.outputDir} onChange={e => setRunConfig(r => ({...r, outputDir: e.target.value}))} style={{ flex: 1, padding: '0.5rem' }} placeholder="e.g. output" />
                      {canBrowseFolder && <button
                        onClick={async (e) => {
                          const btn = e.currentTarget;
                          if (btn.disabled) return;
                          btn.disabled = true;
                          try {
                            const res = await fetch('/api/browse-folder');
                            const { path } = await res.json();
                            if (path) setRunConfig(r => ({ ...r, outputDir: path }));
                          } catch {
                            // ignore
                          } finally {
                            btn.disabled = false;
                          }
                        }}
                        title="Browse folder"
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', whiteSpace: 'nowrap' }}
                      >
                        📁
                      </button>}
                    </div>
                  </div>
                )}

                {/* Cloud */}
                {runConfig.destination === 'cloud' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                    {/* Saved credential profiles */}
                    {credProfiles.filter(p => p.provider === runConfig.uploadTarget).length > 0 && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.savedCredentials')}</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {credProfiles.filter(p => p.provider === runConfig.uploadTarget).map(p => (
                            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.4rem 0.6rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <button type="button" onClick={() => handleLoadCredProfile(p.name)}
                                style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                                {p.name}
                                <span style={{ marginLeft: '0.5rem', color: 'var(--text-subtle)', fontSize: '0.72rem' }}>{p.provider.toUpperCase()}</span>
                              </button>
                              <button type="button" onClick={() => handleDeleteCredProfile(p.name)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.2rem' }}
                                title="Remove">✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Provider */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.cloudProvider')}</label>
                      <select value={runConfig.uploadTarget} onChange={e => setRunConfig(r => ({...r, uploadTarget: e.target.value}))} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                        <option value="gcs" style={{color: 'black'}}>{t('run.gcs')}</option>
                        <option value="s3" style={{color: 'black'}}>{t('run.s3')}</option>
                        <option value="azure" style={{color: 'black'}}>{t('run.azure')}</option>
                      </select>
                    </div>

                    {/* Bucket + Prefix */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.bucketName')}</label>
                        <input type="text" value={runConfig.bucket} onChange={e => setRunConfig(r => ({...r, bucket: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. my-data-lake" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.prefix')}</label>
                        <input type="text" value={runConfig.prefix} onChange={e => setRunConfig(r => ({...r, prefix: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. datasets/" />
                      </div>
                    </div>

                    {/* Credentials — per provider */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                        <p style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)' }}>Credentials</p>
                        {showSaveCredInput ? (
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={saveCredName}
                              onChange={e => setSaveCredName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveCredProfile(); if (e.key === 'Escape') setShowSaveCredInput(false); }}
                              placeholder="Profile name..."
                              autoFocus
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '5px', color: 'white', width: '130px' }}
                            />
                            <button type="button" onClick={handleSaveCredProfile}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '5px', color: 'var(--success)', cursor: 'pointer' }}>
                              Save
                            </button>
                            <button type="button" onClick={() => setShowSaveCredInput(false)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setShowSaveCredInput(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                            Save credentials
                          </button>
                        )}
                      </div>

                      {runConfig.uploadTarget === 'gcs' && (
                        <EnvKeyPicker
                          label="Service Account JSON"
                          value={runConfig.cloudCreds.gcsJson}
                          onChange={name => setRunConfig(r => ({...r, cloudCreds: {...r.cloudCreds, gcsJson: name}}))}
                          envKeys={envKeys}
                          onOpenProfile={() => setShowProfilePanel(true)}
                          hint="GCS_JSON"
                        />
                      )}

                      {runConfig.uploadTarget === 's3' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div style={{ flex: 1 }}>
                              <EnvKeyPicker label="Access Key ID" value={runConfig.cloudCreds.s3AccessKey}
                                onChange={name => setRunConfig(r => ({...r, cloudCreds: {...r.cloudCreds, s3AccessKey: name}}))}
                                envKeys={envKeys} onOpenProfile={() => setShowProfilePanel(true)} hint="AWS_ACCESS_KEY_ID" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <EnvKeyPicker label="Secret Access Key" value={runConfig.cloudCreds.s3SecretKey}
                                onChange={name => setRunConfig(r => ({...r, cloudCreds: {...r.cloudCreds, s3SecretKey: name}}))}
                                envKeys={envKeys} onOpenProfile={() => setShowProfilePanel(true)} hint="AWS_SECRET_ACCESS_KEY" />
                            </div>
                          </div>
                          <EnvKeyPicker label="Region" value={runConfig.cloudCreds.s3Region}
                            onChange={name => setRunConfig(r => ({...r, cloudCreds: {...r.cloudCreds, s3Region: name}}))}
                            envKeys={envKeys} onOpenProfile={() => setShowProfilePanel(true)} hint="AWS_DEFAULT_REGION" />
                        </div>
                      )}

                      {runConfig.uploadTarget === 'azure' && (
                        <EnvKeyPicker label="Connection String" value={runConfig.cloudCreds.azureConnStr}
                          onChange={name => setRunConfig(r => ({...r, cloudCreds: {...r.cloudCreds, azureConnStr: name}}))}
                          envKeys={envKeys} onOpenProfile={() => setShowProfilePanel(true)} hint="AZURE_STORAGE_CONNECTION_STRING" />
                      )}
                    </div>
                  </div>
                )}

                {/* Database */}
                {runConfig.destination === 'database' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                    {/* Saved connections */}
                    {savedConns.length > 0 && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.savedConnections')}</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {savedConns.map(conn => (
                            <div key={conn.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.4rem 0.6rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <button type="button" onClick={() => handleLoadConn(conn)}
                                style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                                {conn.name}
                                <span style={{ marginLeft: '0.5rem', color: 'var(--text-subtle)', fontSize: '0.72rem' }}>
                                  {conn.advanced ? conn.advancedUrl.replace(/:([^:@]+)@/, ':***@') : `${conn.form.type}://${conn.form.host}/${conn.form.database}`}
                                </span>
                              </button>
                              <button type="button" onClick={() => handleDeleteConn(conn.name)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.2rem', lineHeight: 1 }}
                                title="Remove">✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Toggle Advanced + Save */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {showSaveInput ? (
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flex: 1 }}>
                          <input
                            type="text"
                            value={saveConnName}
                            onChange={e => setSaveConnName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveConn(); if (e.key === 'Escape') setShowSaveInput(false); }}
                            placeholder="Connection name..."
                            autoFocus
                            style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '5px', color: 'white' }}
                          />
                          <button type="button" onClick={handleSaveConn}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '5px', color: 'var(--success)', cursor: 'pointer' }}>
                            Save
                          </button>
                          <button type="button" onClick={() => setShowSaveInput(false)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setShowSaveInput(true)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                          Save connection
                        </button>
                      )}
{/* Advanced connection string toggle disabled */}
                    </div>

                    {!dbAdvanced ? (
                      <>
                        {/* DB Type */}
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.databaseType')}</label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {(['postgresql', 'mysql', 'sqlite'] as const).map(t => {
                              const active = dbForm.type === t;
                              const colors: Record<string, string> = { postgresql: '#60a5fa', mysql: '#f59e0b', sqlite: '#a78bfa' };
                              return (
                                <button key={t} type="button"
                                  onClick={() => { setDbForm(f => ({ ...f, type: t, port: DB_PORT_DEFAULTS[t] })); setDbTestStatus('idle'); }}
                                  style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: `1px solid ${active ? colors[t] : 'var(--border-color)'}`, background: active ? `${colors[t]}18` : 'rgba(255,255,255,0.04)', color: active ? colors[t] : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 700 : 400, transition: 'all 0.15s', textTransform: 'capitalize' }}>
                                  {t === 'postgresql' ? 'PostgreSQL' : t === 'mysql' ? 'MySQL' : 'SQLite'}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* SQLite: apenas caminho do arquivo */}
                        {dbForm.type === 'sqlite' ? (
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>File Path</label>
                            <input type="text" value={dbForm.database}
                              onChange={e => { setDbForm(f => ({ ...f, database: e.target.value })); setDbTestStatus('idle'); }}
                              style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. output/data.db" />
                          </div>
                        ) : (
                          <>
                            {/* Host + Port */}
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <div style={{ flex: 3 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.host')}</label>
                                <input type="text" value={dbForm.host}
                                  onChange={e => { setDbForm(f => ({ ...f, host: e.target.value })); setDbTestStatus('idle'); }}
                                  style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. localhost" />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.port')}</label>
                                <input type="text" value={dbForm.port}
                                  onChange={e => { setDbForm(f => ({ ...f, port: e.target.value })); setDbTestStatus('idle'); }}
                                  style={{ width: '100%', padding: '0.5rem' }} placeholder="5432" />
                              </div>
                            </div>

                            {/* Database name */}
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>Database</label>
                              <input type="text" value={dbForm.database}
                                onChange={e => { setDbForm(f => ({ ...f, database: e.target.value })); setDbTestStatus('idle'); }}
                                style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. mydb" />
                            </div>

                            {/* User + Password */}
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.username')}</label>
                                <input type="text" value={dbForm.user}
                                  onChange={e => { setDbForm(f => ({ ...f, user: e.target.value })); setDbTestStatus('idle'); }}
                                  style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. admin" />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.password')}</label>
                                <div style={{ position: 'relative' }}>
                                  <input
                                    type={showDbPassword ? 'text' : 'password'}
                                    value={dbForm.password}
                                    onChange={e => { setDbForm(f => ({ ...f, password: e.target.value })); setDbTestStatus('idle'); }}
                                    style={{ width: '100%', padding: '0.5rem', paddingRight: '2.2rem', boxSizing: 'border-box' }}
                                    placeholder="••••••••"
                                  />
                                  <button type="button" onClick={() => setShowDbPassword(v => !v)}
                                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
                                    {showDbPassword ? '🙈' : '👁'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Connection string preview */}
                        {computedDbUrl && (
                          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                            {computedDbUrl.replace(/:([^:@]+)@/, ':***@')}
                          </div>
                        )}
                      </>
                    ) : (
                      /* Advanced: connection string via env key ref */
                      <EnvKeyPicker label="Connection String (URL)" value={runConfig.dbUrl}
                        onChange={name => { setRunConfig(r => ({...r, dbUrl: name})); setDbTestStatus('idle'); setDbTestError(''); }}
                        envKeys={envKeys} onOpenProfile={() => setShowProfilePanel(true)} hint="DATABASE_URL" />
                    )}

                    {/* Test Connection */}
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={handleTestDbConnection}
                          disabled={!computedDbUrl.trim() || dbTestStatus === 'testing'}
                          style={{
                            padding: '0.5rem 0.85rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            background: dbTestStatus === 'ok' ? 'rgba(16,185,129,0.15)' : dbTestStatus === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                            color: dbTestStatus === 'ok' ? 'var(--success)' : dbTestStatus === 'error' ? 'var(--danger)' : 'var(--text-muted)',
                            cursor: !computedDbUrl.trim() || dbTestStatus === 'testing' ? 'not-allowed' : 'pointer',
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s',
                            opacity: !computedDbUrl.trim() ? 0.5 : 1,
                          }}
                        >
                          {dbTestStatus === 'testing' ? t('run.testing') : dbTestStatus === 'ok' ? t('run.connected') : dbTestStatus === 'error' ? t('run.failed') : t('run.testConnection')}
                        </button>
                      </div>
                      {dbTestStatus === 'error' && dbTestError && (
                        <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#f87171', wordBreak: 'break-all' }}>{dbTestError}</p>
                      )}
                      {dbTestStatus === 'ok' && (
                        <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#34d399' }}>Connection successful.</p>
                      )}
                    </div>

                    {/* If exists + Schema */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.ifTableExists')}</label>
                        <select value={runConfig.ifExists} onChange={e => setRunConfig(r => ({...r, ifExists: e.target.value}))} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                          <option value="replace" style={{color: 'black'}}>Replace</option>
                          <option value="append" style={{color: 'black'}}>Append</option>
                          <option value="fail" style={{color: 'black'}}>Fail</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.dbSchema')} <span style={{ color: 'var(--text-muted)' }}>({t('common.optional')})</span></label>
                        <input type="text" value={runConfig.dbSchema} onChange={e => setRunConfig(r => ({...r, dbSchema: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. public" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reproducibility */}
              <div style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{t('run.reproducibility')}</p>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.seed')} <span style={{ color: 'var(--text-muted)' }}>({t('common.optional')})</span></label>
                  <input type="number" value={runConfig.seed} onChange={e => setRunConfig(r => ({...r, seed: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder={t('run.seedPlaceholder')} />
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{t('run.recurrence')}</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.intervalSeconds')} <span style={{ color: 'var(--text-muted)' }}>({t('common.optional')})</span></label>
                    <input type="number" value={runConfig.recurrence} onChange={e => setRunConfig(r => ({...r, recurrence: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder={t('run.intervalPlaceholder')} min="1" />
                  </div>
                  {runConfig.recurrence && (
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.batchLimit')} <span style={{ color: 'var(--text-muted)' }}>(0 = {t('run.infinite')})</span></label>
                      <input type="number" value={runConfig.count} onChange={e => setRunConfig(r => ({...r, count: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="0" min="0" />
                    </div>
                  )}
                </div>

                {/* Increment — only relevant in recurrence mode */}
                {runConfig.recurrence && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <label style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.columnIncrements')} <span style={{ color: 'var(--text-muted)' }}>({t('run.shiftPerBatch')})</span></label>
                      <button type="button"
                        onClick={() => setRunConfig(r => ({ ...r, increments: [...r.increments, { table: tables[0]?.name || '', column: '', step: '1', unit: 'days' }] }))}
                        style={{ padding: '0.2rem 0.6rem', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '5px', color: '#60a5fa', cursor: 'pointer', fontSize: '0.78rem' }}>
                        + Add
                      </button>
                    </div>
                    {runConfig.increments.map((inc, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <select value={inc.table} onChange={e => { const next = [...runConfig.increments]; next[idx] = { ...next[idx], table: e.target.value, column: '' }; setRunConfig(r => ({ ...r, increments: next })); }}
                          style={{ flex: '1.2', padding: '0.35rem 0.4rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                          <option value="">table</option>
                          {tables.map(t => <option key={t.id} value={t.name} style={{ color: 'black' }}>{t.name}</option>)}
                        </select>
                        <select value={inc.column} onChange={e => { const next = [...runConfig.increments]; next[idx] = { ...next[idx], column: e.target.value }; setRunConfig(r => ({ ...r, increments: next })); }}
                          style={{ flex: '1.5', padding: '0.35rem 0.4rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: inc.column ? 'var(--text-main)' : 'var(--text-subtle)', fontSize: '0.8rem' }}>
                          <option value="">column</option>
                          {(tables.find(t => t.name === inc.table)?.columns || []).map(c => <option key={c.id} value={c.name} style={{ color: 'black' }}>{c.name}</option>)}
                        </select>
                        <input type="number" value={inc.step} onChange={e => { const next = [...runConfig.increments]; next[idx] = { ...next[idx], step: e.target.value }; setRunConfig(r => ({ ...r, increments: next })); }}
                          style={{ width: '56px', padding: '0.35rem 0.4rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '0.8rem' }} placeholder="step" />
                        <select value={inc.unit} onChange={e => { const next = [...runConfig.increments]; next[idx] = { ...next[idx], unit: e.target.value }; setRunConfig(r => ({ ...r, increments: next })); }}
                          style={{ flex: '1', padding: '0.35rem 0.4rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                          <option value="days" style={{ color: 'black' }}>days</option>
                          <option value="hours" style={{ color: 'black' }}>hours</option>
                          <option value="weeks" style={{ color: 'black' }}>weeks</option>
                          <option value="months" style={{ color: 'black' }}>months</option>
                          <option value="years" style={{ color: 'black' }}>years</option>
                          <option value="value" style={{ color: 'black' }}>value (+N)</option>
                        </select>
                        <button type="button" onClick={() => { const next = runConfig.increments.filter((_, i) => i !== idx); setRunConfig(r => ({ ...r, increments: next })); }}
                          style={{ padding: '0.2rem 0.5rem', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '5px', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Filters */}
              <div style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{t('run.filters')} <span style={{ color: 'var(--text-subtle)', textTransform: 'none', letterSpacing: 0 }}>({t('common.optional')})</span></p>
                {tables.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.includeTables')} <span style={{ color: 'var(--text-muted)' }}>({t('run.defaultAll')})</span></label>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {tables.map(t => {
                        const active = runConfig.tablesToInclude.includes(t.name);
                        return (
                          <button key={t.id} type="button"
                            onClick={() => {
                              const next = active
                                ? runConfig.tablesToInclude.filter(n => n !== t.name)
                                : [...runConfig.tablesToInclude, t.name];
                              setRunConfig(r => ({ ...r, tablesToInclude: next }));
                            }}
                            style={{ padding: '0.25rem 0.65rem', borderRadius: '5px', border: `1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`, background: active ? 'var(--primary-glow)' : 'rgba(255,255,255,0.04)', color: active ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 600 : 400 }}>
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                    {runConfig.tablesToInclude.length > 0 && (
                      <button type="button" onClick={() => setRunConfig(r => ({ ...r, tablesToInclude: [] }))} style={{ marginTop: '0.35rem', background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.75rem' }}>{t('run.clearSelection')}</button>
                    )}
                  </div>
                )}
                {tables.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t('run.partitionBy')} <span style={{ color: 'var(--text-muted)' }}>({t('run.perTableHive')})</span></label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {tables.map(t => {
                        const col = runConfig.partitionByTable[t.name] || '';
                        const gran = runConfig.partitionDateGranularity[t.name] || '';
                        const colObj = t.columns.find(c => c.name === col);
                        const showGranularity = !!col && !!colObj && isDateColumn(colObj);
                        return (
                          <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ width: '120px', fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.name}</span>
                              <select
                                value={col}
                                onChange={e => {
                                  const val = e.target.value;
                                  const next = { ...runConfig.partitionByTable };
                                  if (val) next[t.name] = val; else delete next[t.name];
                                  // clear granularity when column is removed
                                  const nextGran = { ...runConfig.partitionDateGranularity };
                                  if (!val) delete nextGran[t.name];
                                  setRunConfig(r => ({ ...r, partitionByTable: next, partitionDateGranularity: nextGran }));
                                }}
                                style={{ flex: 1, padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: col ? 'var(--text-main)' : 'var(--text-subtle)', fontSize: '0.82rem' }}
                              >
                                <option value="">— no partition —</option>
                                {t.columns.map(c => (
                                  <option key={c.id} value={c.name} style={{ color: 'black' }}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                            {showGranularity && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingLeft: '128px' }}>
                                {[{ value: '', label: 'Full' }, { value: 'year', label: 'YYYY' }, { value: 'month', label: 'YYYY-MM' }].map(opt => (
                                  <button
                                    key={opt.value}
                                    onClick={() => {
                                      const nextGran = { ...runConfig.partitionDateGranularity };
                                      if (opt.value) nextGran[t.name] = opt.value; else delete nextGran[t.name];
                                      setRunConfig(r => ({ ...r, partitionDateGranularity: nextGran }));
                                    }}
                                    style={{
                                      padding: '0.2rem 0.6rem',
                                      borderRadius: '4px',
                                      border: gran === opt.value ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                                      background: gran === opt.value ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                                      color: gran === opt.value ? 'var(--primary)' : 'var(--text-subtle)',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                    }}
                                  >{opt.label}</button>
                                ))}
                                {gran && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontFamily: 'monospace' }}>
                                    {col}={gran === 'year' ? '2024' : '2024-04'}/
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {Object.values(runConfig.partitionByTable).some(v => v) && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>Partition Workers <span style={{ color: 'var(--text-muted)' }}>(parallel threads)</span></label>
                    <input type="number" value={runConfig.workers} onChange={e => setRunConfig(r => ({...r, workers: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="16" min="1" />
                    {(() => {
                      const w = parseInt(runConfig.workers);
                      if (w > 64) return <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#f87171' }}>⚠ Above 64 threads may cause diminishing returns or instability. Recommended: 16–32 for local SSD, up to 64 for network storage.</p>;
                      if (w > 32) return <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#fb923c' }}>⚠ Above 32 threads only helps with slow network storage (Docker volumes, S3). Local SSD saturates earlier.</p>;
                      return null;
                    })()}
                  </div>
                )}
{/* Column Filters disabled */}
              </div>

              {/* Terminal output — always visible, above the run button */}
              <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', minHeight: '80px', maxHeight: '220px', overflowY: 'auto', overflowX: 'hidden', padding: '0.75rem' }}>
                {runLogs
                  ? <pre style={{ margin: 0, fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#a7f3d0', fontFamily: 'monospace' }}>{runLogs}</pre>
                  : <p style={{ margin: 0, fontSize: '0.78rem', color: '#334155', fontFamily: 'monospace' }}>Output will appear here…</p>
                }
              </div>

              {(() => {
                const validationError =
                  runConfig.destination === 'cloud' && !runConfig.bucket.trim()
                    ? t('run.bucketRequired')
                    : null;
                return validationError ? (
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    ⚠ {validationError}
                  </p>
                ) : null;
              })()}

              {(() => {
                const disabled = isRunning || (runConfig.destination === 'cloud' && !runConfig.bucket.trim());
                return (
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button className="btn-primary" onClick={handleRunCli} disabled={disabled}
                  style={{ flex: 1, padding: '0.75rem', background: 'var(--success)', borderColor: 'var(--success)', fontSize: '1rem', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                  {isRunning ? t('run.running') : t('run.execute')}
                </button>
                {isRunning && (
                  <button onClick={handleStopCli}
                    style={{ padding: '0.75rem 1.25rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', color: '#f87171', fontSize: '1rem', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {t('run.stop')}
                  </button>
                )}
              </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Domain Modal */}
      {aiModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => !aiLoading && setAiModal(false)}>
          <div style={{ width: '580px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '14px', padding: '1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <Sparkles size={18} color="#a78bfa" /> {t('ai.title')}
              </h2>
              <button onClick={() => !aiLoading && setAiModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: 'var(--text-subtle)', lineHeight: 1.5 }}>
              {t('ai.description')}
            </p>

            {/* Provider grid */}
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('ai.provider')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                {AI_PROVIDERS.map(({ key, label, color }) => {
                  const active = aiProvider === key;
                  return (
                    <button key={key} type="button" onClick={() => { setAiProvider(key); setAiError(''); }}
                      style={{ padding: '0.5rem 0.3rem', borderRadius: '8px', border: `1px solid ${active ? color : 'var(--border-color)'}`, background: active ? `${color}20` : 'rgba(255,255,255,0.03)', color: active ? color : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 700 : 400, transition: 'all 0.12s', textAlign: 'center' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* API Key */}
            {aiProvider !== 'ollama' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <EnvKeyPicker
                  label="API Key"
                  value={currentApiKeyRef}
                  onChange={name => { setAiApiKeys(prev => ({ ...prev, [aiProvider]: name })); setAiAvailableModels(prev => ({ ...prev, [aiProvider]: [] })); setAiModelsError(''); }}
                  envKeys={envKeys}
                  onOpenProfile={() => { setAiModal(false); setShowProfilePanel(true); }}
                  hint={{ anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', google: 'GOOGLE_API_KEY', groq: 'GROQ_API_KEY', mistral: 'MISTRAL_API_KEY', together: 'TOGETHER_API_KEY' }[aiProvider]}
                />
              </div>
            )}

            {/* Model */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('ai.model')} <span style={{ color: '#334155', textTransform: 'none', letterSpacing: 0 }}>{aiProvider === 'ollama' ? `(${t('ai.required')})` : `(${t('ai.optional')})`}</span>
                </label>
                <button type="button" onClick={handleLoadModels}
                  disabled={aiModelsLoading || (!currentApiKey.trim() && aiProvider !== 'ollama')}
                  style={{ background: 'none', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '5px', color: '#60a5fa', cursor: 'pointer', fontSize: '0.72rem', padding: '0.2rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: (!currentApiKey.trim() && aiProvider !== 'ollama') ? 0.35 : 1, minHeight: 'unset' }}>
                  {aiModelsLoading
                    ? <><span style={{ display: 'inline-block', width: '10px', height: '10px', border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: '#60a5fa', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> {t('ai.loading')}</>
                    : t('ai.loadModels')}
                </button>
              </div>

              {availableModels.length > 0 ? (
                <select
                  value={currentModel}
                  onChange={e => setAiModels(prev => ({ ...prev, [aiProvider]: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '7px', color: 'white', fontSize: '0.85rem', boxSizing: 'border-box' }}
                >
                  <option value="" style={{ color: 'black' }}>{t('ai.selectModel')}</option>
                  {availableModels.map(m => <option key={m} value={m} style={{ color: 'black' }}>{m}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={currentModel}
                  onChange={e => setAiModels(prev => ({ ...prev, [aiProvider]: e.target.value }))}
                  placeholder={currentProviderMeta.modelPlaceholder}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.05)', border: `1px solid ${currentModel ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '7px', color: 'white', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              )}

              {aiModelsError && (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: '#f87171' }}>{aiModelsError}</p>
              )}
            </div>

            {/* Prompt */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('ai.whatDataset')}</label>
                <button type="button" onClick={() => setAiPrompt(AI_DEFAULT_PROMPT)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.72rem', textDecoration: 'underline', padding: 0 }}>
                  {t('ai.resetToExample')}
                </button>
              </div>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                rows={7}
                placeholder={t('ai.promptPlaceholder')}
                style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: 'var(--text-main)', resize: 'vertical', fontSize: '0.84rem', lineHeight: 1.6, boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: 'var(--text-subtle)' }}>⚙</span>
                {t('ai.promptHelp')}
              </p>
            </div>

            {aiError && (
              <div style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#f87171', background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '6px', padding: '0.5rem 0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflowY: 'auto' }}>{aiError}</div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => !aiLoading && setAiModal(false)}
                style={{ flex: 1, padding: '0.65rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', color: 'var(--text-muted)', cursor: aiLoading ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
                {t('common.cancel')}
              </button>
              <button type="button" onClick={handleAiGenerate} disabled={aiLoading}
                style={{ flex: 2, padding: '0.65rem', background: aiLoading ? 'rgba(139,92,246,0.25)' : 'linear-gradient(135deg, #7c3aed, #2563eb)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, cursor: aiLoading ? 'not-allowed' : 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {aiLoading ? (
                  <>
                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    {t('ai.generating')}
                  </>
                ) : (
                  <><Sparkles size={16} /> {t('ai.generateSchema')}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Default Modal */}
      {saveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSaveModal(false)}>
          <div style={{ width: '400px', maxWidth: '90vw', background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} color="#f59e0b" /> {t('save.title')}
              </h2>
              <button onClick={() => setSaveModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('save.description')}
            </p>
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label>{t('save.schemaName')}</label>
              <input
                autoFocus
                type="text"
                value={saveName}
                onChange={e => { setSaveName(e.target.value); setSaveError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSaveSchema()}
                placeholder={t('save.schemaNamePlaceholder')}
                style={{ textTransform: 'lowercase' }}
              />
            </div>
            <p style={{ margin: '0.25rem 0 1rem', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
              {t('save.schemaNameHelp')}
            </p>
            {saveError && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>{saveError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={() => setSaveModal(false)} style={{ flex: 1, padding: '0.6rem' }}>{t('common.cancel')}</button>
              <button onClick={handleSaveSchema} style={{ flex: 2, padding: '0.6rem', background: '#f59e0b', border: 'none', borderRadius: '8px', color: 'black', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                {t('save.saveAndReload')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Faker Method Browser Modal */}
      {fakerBrowser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setFakerBrowser(null)}>
          <div style={{ width: '780px', maxWidth: '95vw', maxHeight: '85vh', background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
              <BookOpen size={18} color="#60a5fa" />
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>{t('faker.title')}</h2>
              <div style={{ flex: 1, position: 'relative', marginLeft: '0.5rem' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  autoFocus
                  value={fakerSearch}
                  onChange={e => setFakerSearch(e.target.value)}
                  placeholder={t('faker.searchPlaceholder')}
                  style={{ width: '100%', padding: '0.4rem 0.75rem 0.4rem 2rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: 'white', fontSize: '0.875rem' }}
                />
              </div>
              <button onClick={() => setFakerBrowser(null)} className="btn-icon" aria-label={t('faker.close')}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {(() => {
                const q = fakerSearch.toLowerCase();
                const filtered = FAKER_CATALOG.map(cat => ({
                  ...cat,
                  methods: cat.methods.filter(m => m.name.includes(q) || cat.category.toLowerCase().includes(q)),
                })).filter(cat => cat.methods.length > 0);
                return filtered.map(cat => (
                  <div key={cat.category}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: cat.color, fontWeight: 600 }}>{cat.category}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {cat.methods.map(m => (
                        <button
                          key={m.name}
                          onClick={() => {
                            onUpdateColumn(fakerBrowser.tableId, fakerBrowser.colId, 'fakerProvider', m.name);
                            setFakerBrowser(null);
                          }}
                          title={m.example}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0.4rem 0.65rem', background: `${cat.color}0f`, border: `1px solid ${cat.color}33`, borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = `${cat.color}22`)}
                          onMouseLeave={e => (e.currentTarget.style.background = `${cat.color}0f`)}
                        >
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontFamily: 'monospace', fontWeight: 500 }}>{m.name}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{m.example}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Schedules Panel ────────────────────────────────────────────────── */}
      {showSchedulesPanel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animated-scale" style={{ width: '660px', maxWidth: '95vw', padding: '1.5rem', background: 'rgba(9,12,20,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderTopColor: 'rgba(255,255,255,0.12)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={18} color="var(--primary)"/> {t('schedule.title')}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-success" onClick={openNewSchedule} style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}><Plus size={14}/> {t('schedule.newSchedule')}</button>
                <button onClick={() => { setShowSchedulesPanel(false); setShowScheduleForm(false); }} className="btn-icon" aria-label="Close"><X size={18}/></button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {/* Schedule Form */}
              {showScheduleForm && (
                <div className="glass-panel" style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: 'var(--primary)' }}>{editingSchedule ? t('schedule.editSchedule') : t('schedule.newSchedule')}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Name */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)', fontSize: '0.82rem' }}>Name</label>
                      <input value={schedForm.name} onChange={e => setSchedForm(f => ({ ...f, name: e.target.value }))} placeholder={t('schedule.namePlaceholder')} style={{ width: '100%', padding: '0.5rem' }} />
                    </div>
                    {/* Schedule builder */}
                    <div>
                      {/* Mode toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <label style={{ color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600 }}>{t('schedule.schedule')}</label>
                        <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', marginLeft: 'auto' }}>
                          {(['visual','cron'] as const).map(m => (
                            <button key={m} type="button"
                              onClick={() => setSchedBuilderMode(m)}
                              style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem', background: schedBuilderMode === m ? 'rgba(34,211,238,0.18)' : 'transparent', color: schedBuilderMode === m ? 'var(--primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', textTransform: 'capitalize' }}>
                              {m === 'cron' ? t('schedule.cron') : t('schedule.visual')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {schedBuilderMode === 'visual' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {/* Hour + Minute */}
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-muted)', fontSize: '0.77rem' }}>{t('schedule.hourUtc')}</label>
                              <input type="number" min="0" max="23" value={schedVisual.hour === '*' ? '' : schedVisual.hour}
                                placeholder="* (any)"
                                onChange={e => applyVisual({ hour: e.target.value === '' ? '*' : e.target.value })}
                                style={{ width: '100%', padding: '0.45rem' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-muted)', fontSize: '0.77rem' }}>{t('schedule.minute')}</label>
                              <input type="number" min="0" max="59" value={schedVisual.minute === '*' ? '' : schedVisual.minute}
                                placeholder="* (any)"
                                onChange={e => applyVisual({ minute: e.target.value === '' ? '*' : e.target.value })}
                                style={{ width: '100%', padding: '0.45rem' }} />
                            </div>
                          </div>
                          {/* Day + Month */}
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-muted)', fontSize: '0.77rem' }}>{t('schedule.day')}</label>
                              <select value={schedVisual.day} onChange={e => applyVisual({ day: e.target.value })}
                                style={{ width: '100%', padding: '0.45rem', background: 'var(--bg-input, #0d1117)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                {DAYS_OF_MONTH.map(d => <option key={d} value={d}>{d === '*' ? '* (every day)' : `Day ${d}`}</option>)}
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-muted)', fontSize: '0.77rem' }}>{t('schedule.month')}</label>
                              <select value={schedVisual.month} onChange={e => applyVisual({ month: e.target.value })}
                                style={{ width: '100%', padding: '0.45rem', background: 'var(--bg-input, #0d1117)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                                {MONTHS.map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
                              </select>
                            </div>
                          </div>
                          {/* Preview */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.65rem', background: 'rgba(34,211,238,0.06)', borderRadius: '6px', border: '1px solid rgba(34,211,238,0.12)' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontSize: '0.82rem' }}>{schedForm.cronExpression}</span>
                            {cronDescription(schedForm.cronExpression) && <span style={{ color: 'var(--success)', fontSize: '0.77rem' }}>— {cronDescription(schedForm.cronExpression)}</span>}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.77rem' }}>Cron Expression (UTC)</label>
                          <input value={schedForm.cronExpression} onChange={e => setSchedForm(f => ({ ...f, cronExpression: e.target.value }))} placeholder="0 9 * * *" style={{ width: '100%', padding: '0.5rem', fontFamily: 'var(--font-mono)' }} />
                          {cronDescription(schedForm.cronExpression) && (
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.77rem', color: 'var(--success)' }}>↳ {cronDescription(schedForm.cronExpression)}</p>
                          )}
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Common: <code style={{color:'var(--primary)'}}>0 9 * * *</code> (daily 9am) · <code style={{color:'var(--primary)'}}>0 * * * *</code> (hourly) · <code style={{color:'var(--primary)'}}>0 9 * * 1</code> (weekly Mon)</p>
                        </div>
                      )}
                    </div>
                    {/* Tables */}
                    {tables.length > 0 && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)', fontSize: '0.82rem' }}>Tables to include <span style={{ color: 'var(--text-muted)' }}>(empty = all)</span></label>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {tables.map(t => {
                            const active = schedForm.tablesToInclude.includes(t.name);
                            return (
                              <button key={t.id} type="button"
                                onClick={() => setSchedForm(f => ({ ...f, tablesToInclude: active ? f.tablesToInclude.filter(n => n !== t.name) : [...f.tablesToInclude, t.name] }))}
                                style={{ padding: '0.25rem 0.65rem', borderRadius: '6px', border: `1px solid ${active ? 'var(--success)' : 'var(--border-color)'}`, background: active ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)', color: active ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Rows */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)', fontSize: '0.82rem' }}>Rows per table <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                      <input type="number" value={schedForm.rows} onChange={e => setSchedForm(f => ({ ...f, rows: e.target.value }))} placeholder="Use schema default" style={{ width: '160px', padding: '0.5rem' }} min="1" />
                    </div>
                    {/* Format */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)', fontSize: '0.82rem' }}>Format</label>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {(['csv','json','parquet','avro'] as const).map(fmt => {
                          const active = schedForm.formats.includes(fmt);
                          return (
                            <button key={fmt} type="button"
                              onClick={() => setSchedForm(f => { const next = active ? f.formats.filter(x => x !== fmt) : [...f.formats, fmt]; return { ...f, formats: next.length > 0 ? next : [fmt] }; })}
                              style={{ padding: '0.25rem 0.65rem', borderRadius: '6px', border: `1px solid ${active ? 'var(--success)' : 'var(--border-color)'}`, background: active ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)', color: active ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                              {fmt.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Destination */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)', fontSize: '0.82rem' }}>Destination</label>
                      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                        {([{key:'local',label:'Local',color:'#60a5fa'},{key:'cloud',label:'Cloud',color:'#a78bfa'},{key:'database',label:'Database',color:'#f59e0b'}] as const).map(({key,label,color}) => {
                          const active = schedForm.destination === key;
                          return <button key={key} type="button" onClick={() => setSchedForm(f => ({...f, destination: key}))} style={{ flex:1, padding:'0.4rem', borderRadius:'6px', border:`1px solid ${active?color:'var(--border-color)'}`, background: active?`${color}18`:'rgba(255,255,255,0.04)', color:active?color:'var(--text-muted)', cursor:'pointer', fontSize:'0.85rem', fontWeight:active?700:400 }}>{label}</button>;
                        })}
                      </div>
                      {schedForm.destination === 'local' && (
                        <input value={schedForm.outputDir} onChange={e => setSchedForm(f => ({...f, outputDir: e.target.value}))} placeholder="./output" style={{ width: '100%', padding: '0.5rem' }} />
                      )}
                      {schedForm.destination === 'cloud' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <select value={schedForm.uploadTarget} onChange={e => setSchedForm(f => ({...f, uploadTarget: e.target.value}))} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                            <option value="gcs" style={{color:'black'}}>Google Cloud Storage</option>
                            <option value="s3" style={{color:'black'}}>Amazon S3</option>
                            <option value="azure" style={{color:'black'}}>Azure Blob Storage</option>
                          </select>
                          <input value={schedForm.bucket} onChange={e => setSchedForm(f => ({...f, bucket: e.target.value}))} placeholder="Bucket name" style={{ padding: '0.5rem' }} />
                          <input value={schedForm.prefix} onChange={e => setSchedForm(f => ({...f, prefix: e.target.value}))} placeholder="Prefix (datasets/)" style={{ padding: '0.5rem' }} />
                          {schedForm.uploadTarget === 'gcs' && (
                            <textarea value={schedForm.cloudCreds.gcsJson} onChange={e => setSchedForm(f => ({...f, cloudCreds: {...f.cloudCreds, gcsJson: e.target.value}}))} placeholder="GCS JSON key (paste content)" rows={3} style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', resize: 'vertical' }} />
                          )}
                          {schedForm.uploadTarget === 's3' && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input value={schedForm.cloudCreds.s3AccessKey} onChange={e => setSchedForm(f => ({...f, cloudCreds: {...f.cloudCreds, s3AccessKey: e.target.value}}))} placeholder="Access Key ID" style={{ flex:1, padding: '0.5rem' }} />
                              <input type="password" value={schedForm.cloudCreds.s3SecretKey} onChange={e => setSchedForm(f => ({...f, cloudCreds: {...f.cloudCreds, s3SecretKey: e.target.value}}))} placeholder="Secret Key" style={{ flex:1, padding: '0.5rem' }} />
                            </div>
                          )}
                          {schedForm.uploadTarget === 'azure' && (
                            <input type="password" value={schedForm.cloudCreds.azureConnStr} onChange={e => setSchedForm(f => ({...f, cloudCreds: {...f.cloudCreds, azureConnStr: e.target.value}}))} placeholder="Connection string" style={{ padding: '0.5rem' }} />
                          )}
                        </div>
                      )}
                      {schedForm.destination === 'database' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <input value={schedForm.dbUrl} onChange={e => setSchedForm(f => ({...f, dbUrl: e.target.value}))} placeholder="postgresql+psycopg2://user:pass@host/db" style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }} />
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select value={schedForm.ifExists} onChange={e => setSchedForm(f => ({...f, ifExists: e.target.value}))} style={{ flex:1, padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                              <option value="append" style={{color:'black'}}>append</option>
                              <option value="replace" style={{color:'black'}}>replace</option>
                              <option value="fail" style={{color:'black'}}>fail</option>
                            </select>
                            <input value={schedForm.dbSchema} onChange={e => setSchedForm(f => ({...f, dbSchema: e.target.value}))} placeholder="DB schema (optional)" style={{ flex:1, padding: '0.5rem' }} />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Date Anchors */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ color: 'var(--text-main)', fontSize: '0.82rem' }}>{t('schedule.dateAnchors')}</label>
                        <button type="button" onClick={() => setSchedForm(f => ({...f, dateAnchors: [...f.dateAnchors, {table:'', column:'', offsetDays:'0'}]}))} style={{ background: 'none', border: '1px solid rgba(34,211,238,0.3)', borderRadius: '4px', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>{t('schedule.addAnchor')}</button>
                      </div>
                      {schedForm.dateAnchors.length === 0 && (
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{t('schedule.noAnchors')}</p>
                      )}
                      {schedForm.dateAnchors.map((anchor, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem', alignItems: 'center' }}>
                          <input value={anchor.table} onChange={e => setSchedForm(f => { const a = [...f.dateAnchors]; a[idx]={...a[idx],table:e.target.value}; return {...f,dateAnchors:a}; })} placeholder="table" style={{ flex:1, padding:'0.4rem', fontSize:'0.8rem' }} list={`anchor-tables-${idx}`} />
                          <datalist id={`anchor-tables-${idx}`}>{tables.map(t => <option key={t.id} value={t.name}/>)}</datalist>
                          <input value={anchor.column} onChange={e => setSchedForm(f => { const a = [...f.dateAnchors]; a[idx]={...a[idx],column:e.target.value}; return {...f,dateAnchors:a}; })} placeholder="date column" style={{ flex:1, padding:'0.4rem', fontSize:'0.8rem' }} />
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace:'nowrap' }}>today +</span>
                          <input type="number" value={anchor.offsetDays} onChange={e => setSchedForm(f => { const a = [...f.dateAnchors]; a[idx]={...a[idx],offsetDays:e.target.value}; return {...f,dateAnchors:a}; })} style={{ width:'60px', padding:'0.4rem', fontSize:'0.8rem' }} />
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>days</span>
                          <button type="button" onClick={() => setSchedForm(f => ({...f, dateAnchors: f.dateAnchors.filter((_,i) => i !== idx)}))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:'0.2rem' }}><X size={14}/></button>
                        </div>
                      ))}
                    </div>
                    {schedError && <p style={{ margin: 0, color: '#ef4444', fontSize: '0.82rem' }}>{schedError}</p>}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="btn-secondary" onClick={() => { setShowScheduleForm(false); setEditingSchedule(null); }} style={{ padding: '0.4rem 1rem' }}>{t('common.cancel')}</button>
                      <button className="btn-success" onClick={handleSaveSchedule} disabled={schedSaving} style={{ padding: '0.4rem 1rem' }}>{schedSaving ? t('schedule.save') + '…' : editingSchedule ? t('schedule.save') : t('schedule.newSchedule')}</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Schedule list */}
              {schedulesLoadError && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', marginBottom: '0.75rem', color: '#f87171', fontSize: '0.85rem' }}>
                  Failed to load schedules: <strong>{schedulesLoadError}</strong>
                  <button onClick={fetchSchedules} style={{ marginLeft: '0.75rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline' }}>Retry</button>
                </div>
              )}
              {scheduleDefs.length === 0 && !showScheduleForm && !schedulesLoadError && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-subtle)' }}>
                  <Clock size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                  <p style={{ margin: 0 }}>No schedules yet. Click "New Schedule" to create one.</p>
                </div>
              )}
              {scheduleDefs.map(s => (
                <div key={s.id} className="glass-panel" style={{ marginBottom: '0.5rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: `1px solid ${s.enabled ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 600, color: s.enabled ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '999px', background: s.enabled ? 'rgba(74,222,128,0.12)' : 'rgba(100,116,139,0.15)', color: s.enabled ? 'var(--success)' : 'var(--text-muted)', border: `1px solid ${s.enabled ? 'var(--success-shadow)' : 'rgba(100,116,139,0.3)'}` }}>{s.enabled ? 'active' : 'paused'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{s.cronExpression}</span>
                      {cronDescription(s.cronExpression) && <span>— {cronDescription(s.cronExpression)}</span>}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.1rem' }}>
                      {s.config.uploadTarget ? `→ ${s.config.uploadTarget.toUpperCase()} · ${s.config.bucket || 'no bucket'}` : s.config.dbUrl ? `→ DB` : `→ Local (${s.config.outputDir || 'output'})`}
                      {s.config.formats && <span> · {s.config.formats.join(', ')}</span>}
                      {s.config.dateAnchors?.length > 0 && <span> · {s.config.dateAnchors.length} date anchor(s)</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    <button title="Run now" onClick={() => handleRunNow(s)} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', color: 'var(--success)', cursor: 'pointer', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><Play size={12}/></button>
                    <button title={s.enabled ? 'Pause' : 'Enable'} onClick={() => handleToggleSchedule(s)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: s.enabled ? 'var(--warning)' : 'var(--success)', cursor: 'pointer', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>{s.enabled ? '⏸' : '▶'}</button>
                    <button title="Edit" onClick={() => openEditSchedule(s)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>✏</button>
                    <button title="Export render.yaml" onClick={() => { setRenderImageUrl('docker.io/ckoliveira/dataforge:latest'); setShowRenderExport(s); }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', color: '#818cf8', cursor: 'pointer', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>⬡ Render</button>
                    <button title="Delete" onClick={() => handleDeleteSchedule(s)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── History Panel ───────────────────────────────────────────────────── */}
      {showHistoryPanel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animated-scale" style={{ width: '720px', maxWidth: '95vw', padding: '1.5rem', background: 'rgba(9,12,20,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderTopColor: 'rgba(255,255,255,0.12)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><History size={18} color="var(--primary)"/> {t('history.title')}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={fetchHistory} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>{t('history.refresh')}</button>
                <button onClick={() => setShowHistoryPanel(false)} className="btn-icon" aria-label="Close"><X size={18}/></button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {runHistory.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-subtle)' }}>
                  <History size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                  <p style={{ margin: 0 }}>No runs yet. Schedule a job or use "Run now".</p>
                </div>
              )}
              {runHistory.map(r => {
                const dur = r.finishedAt ? ((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000).toFixed(1) + 's' : '…';
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => setHistoryOutput(r)}>
                    <div style={{ flexShrink: 0 }}>
                      {r.status === 'success' && <CheckCircle size={16} color="var(--success)"/>}
                      {r.status === 'error' && <XCircle size={16} color="#ef4444"/>}
                      {r.status === 'running' && <Loader size={16} color="#f59e0b"/>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.scheduleName}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        {new Date(r.startedAt).toLocaleString()} · {dur} · <span style={{ color: r.triggeredBy === 'manual' ? '#a78bfa' : '#60a5fa' }}>{r.triggeredBy}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: r.status === 'success' ? 'var(--success)' : r.status === 'error' ? 'var(--danger)' : 'var(--warning)', fontWeight: 600, flexShrink: 0 }}>
                      {r.status}
                    </div>
                    <ChevronDown size={14} color="var(--text-subtle)"/>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Render Export Modal ────────────────────────────────────────────── */}
      {showRenderExport && (() => {
        const meta = REGISTRY_META[renderRegistry];
        const imgUrl = computedImageUrl();
        const ri = renderRegistryInputs;
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel animated-scale" style={{ width: '620px', maxWidth: '95vw', padding: '1.5rem', background: 'rgba(9,12,20,0.99)', border: '1px solid rgba(99,102,241,0.3)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#818cf8', fontSize: '1rem' }}>⬡ Export render.yaml — {showRenderExport.name}</h3>
                <button onClick={() => setShowRenderExport(null)} className="btn-icon" aria-label="Close"><X size={18}/></button>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Registry selector */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.82rem' }}>Container Registry</label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {(Object.keys(REGISTRY_META) as RegistryProvider[]).map(key => {
                      const m = REGISTRY_META[key];
                      const active = renderRegistry === key;
                      return (
                        <button key={key} type="button" onClick={() => setRenderRegistry(key)}
                          style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', border: `1px solid ${active ? m.color : 'var(--border-color)'}`, background: active ? `${m.color}18` : 'rgba(255,255,255,0.04)', color: active ? m.color : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 700 : 400 }}>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Registry-specific fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {renderRegistry === 'dockerhub' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Username</label><input value={ri.dockerhubUser} onChange={e => setRenderRegistryInputs(i => ({...i, dockerhubUser: e.target.value}))} placeholder="myuser" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                      <div style={{ flex: 2 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Image</label><input value={ri.dockerhubImage} onChange={e => setRenderRegistryInputs(i => ({...i, dockerhubImage: e.target.value}))} placeholder="dataforge" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                      <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Tag</label><input value={ri.dockerhubTag} onChange={e => setRenderRegistryInputs(i => ({...i, dockerhubTag: e.target.value}))} placeholder="latest" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                    </div>
                  )}
                  {renderRegistry === 'ghcr' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>GitHub User/Org</label><input value={ri.ghcrUser} onChange={e => setRenderRegistryInputs(i => ({...i, ghcrUser: e.target.value}))} placeholder="myorg" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                      <div style={{ flex: 2 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Image</label><input value={ri.ghcrImage} onChange={e => setRenderRegistryInputs(i => ({...i, ghcrImage: e.target.value}))} placeholder="dataforge" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                      <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Tag</label><input value={ri.ghcrTag} onChange={e => setRenderRegistryInputs(i => ({...i, ghcrTag: e.target.value}))} placeholder="latest" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                    </div>
                  )}
                  {renderRegistry === 'gcr' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 2 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>GCP Project ID</label><input value={ri.gcrProject} onChange={e => setRenderRegistryInputs(i => ({...i, gcrProject: e.target.value}))} placeholder="my-project" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                      <div style={{ flex: 2 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Image</label><input value={ri.gcrImage} onChange={e => setRenderRegistryInputs(i => ({...i, gcrImage: e.target.value}))} placeholder="dataforge" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                      <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Tag</label><input value={ri.gcrTag} onChange={e => setRenderRegistryInputs(i => ({...i, gcrTag: e.target.value}))} placeholder="latest" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                    </div>
                  )}
                  {renderRegistry === 'ecr' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 2 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>AWS Account ID</label><input value={ri.ecrAccount} onChange={e => setRenderRegistryInputs(i => ({...i, ecrAccount: e.target.value}))} placeholder="123456789012" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                        <div style={{ flex: 2 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Region</label><input value={ri.ecrRegion} onChange={e => setRenderRegistryInputs(i => ({...i, ecrRegion: e.target.value}))} placeholder="us-east-1" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 2 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Image</label><input value={ri.ecrImage} onChange={e => setRenderRegistryInputs(i => ({...i, ecrImage: e.target.value}))} placeholder="dataforge" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                        <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Tag</label><input value={ri.ecrTag} onChange={e => setRenderRegistryInputs(i => ({...i, ecrTag: e.target.value}))} placeholder="latest" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                      </div>
                    </div>
                  )}
                  {renderRegistry === 'acr' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 2 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Registry name</label><input value={ri.acrRegistry} onChange={e => setRenderRegistryInputs(i => ({...i, acrRegistry: e.target.value}))} placeholder="myregistry" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                      <div style={{ flex: 2 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Image</label><input value={ri.acrImage} onChange={e => setRenderRegistryInputs(i => ({...i, acrImage: e.target.value}))} placeholder="dataforge" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                      <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Tag</label><input value={ri.acrTag} onChange={e => setRenderRegistryInputs(i => ({...i, acrTag: e.target.value}))} placeholder="latest" style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}/></div>
                    </div>
                  )}
                  {renderRegistry === 'custom' && (
                    <div><label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>Full image URL</label><input value={ri.customUrl} onChange={e => setRenderRegistryInputs(i => ({...i, customUrl: e.target.value}))} placeholder="registry.example.com/org/dataforge:latest" style={{ width: '100%', padding: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}/></div>
                  )}

                  {/* Computed URL + push commands */}
                  <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Image URL</p>
                    <code style={{ fontSize: '0.8rem', color: meta.color, fontFamily: 'var(--font-mono)' }}>{imgUrl}</code>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comandos para publicar</p>
                    <pre style={{ margin: 0, padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', fontSize: '0.76rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
{`# 1. Login
${meta.loginCmd}

# 2. Build e push
${meta.pushCmd(imgUrl)}`}
                    </pre>
                  </div>
                </div>

                {/* render.yaml preview */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)', fontSize: '0.82rem' }}>Preview render.yaml</label>
                  <pre style={{ margin: 0, padding: '0.75rem', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', fontSize: '0.73rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {buildRenderYaml(showRenderExport, imgUrl)}
                  </pre>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button className="btn-secondary" onClick={() => setShowRenderExport(null)} style={{ padding: '0.4rem 1rem' }}>Cancel</button>
                <button
                  style={{ padding: '0.4rem 1rem', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '8px', color: '#818cf8', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
                  onClick={() => handleDownloadRenderYaml(showRenderExport, imgUrl)}
                >
                  ⬇ Download render.yaml
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Run output viewer ──────────────────────────────────────────────── */}
      {historyOutput && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '700px', maxWidth: '95vw', padding: '1.5rem', background: 'rgba(9,12,20,0.99)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem' }}>{historyOutput.scheduleName}</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(historyOutput.startedAt).toLocaleString()} · {historyOutput.triggeredBy} · exit {historyOutput.exitCode ?? '?'}</p>
              </div>
              <button onClick={() => setHistoryOutput(null)} className="btn-icon" aria-label="Close"><X size={18}/></button>
            </div>
            <pre style={{ flex: 1, overflowY: 'auto', margin: 0, padding: '0.75rem', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {historyOutput.output || '(no output)'}
            </pre>
          </div>
        </div>
      )}

      {/* Generic confirm/info dialog */}
      {confirmModal && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="confirm-dialog animated-scale">
            <h3 id="confirm-title">{confirmModal.title}</h3>
            <p>{confirmModal.message}</p>
            <div className="actions">
              <button
                className="btn-secondary"
                onClick={() => setConfirmModal(null)}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                style={{ padding: '0.5rem 1.25rem' }}
                autoFocus
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Panel ──────────────────────────────────────────────────── */}
      {showProfilePanel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animated-scale" style={{ width: '520px', maxWidth: '95vw', padding: '1.5rem', background: 'rgba(9,12,20,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderTopColor: 'rgba(255,255,255,0.12)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} color="var(--primary)" /> Profile
              </h2>
              <button onClick={() => setShowProfilePanel(false)} className="btn-icon" aria-label="Close"><X size={18} /></button>
            </div>

            {/* User info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.14)', borderRadius: '10px', marginBottom: '1.5rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={20} color="var(--primary)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{auth.username}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.1rem' }}>{Object.keys(envKeys).length} key{Object.keys(envKeys).length !== 1 ? 's' : ''} stored</div>
              </div>
              <button onClick={onLogout} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                <LogOut size={14} /> Sign out
              </button>
            </div>

            {/* Env Keys */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Key size={12} /> Environment Keys (.env)
              </p>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', color: 'var(--text-subtle)', lineHeight: 1.5 }}>
                Keys stored here are automatically injected into AI, Cloud, and Database fields.
                Recognized names: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, TOGETHER_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION, GCS_JSON, GOOGLE_APPLICATION_CREDENTIALS_JSON, AZURE_STORAGE_CONNECTION_STRING, DATABASE_URL</span>
              </p>

              {/* Add form */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: '0 0 160px' }}>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>KEY_NAME</label>
                  <input
                    value={envKeyForm.key}
                    onChange={e => setEnvKeyForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                    placeholder="AWS_ACCESS_KEY"
                    style={{ padding: '0.45rem 0.6rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Value</label>
                  <input
                    value={envKeyForm.value}
                    onChange={e => setEnvKeyForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="your-secret-value"
                    style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', width: '100%' }}
                  />
                </div>
                <button onClick={handleAddEnvKey} disabled={envKeyLoading || !envKeyForm.key} className="btn-success" style={{ padding: '0.45rem 0.85rem', flexShrink: 0, opacity: (!envKeyForm.key || envKeyLoading) ? 0.5 : 1 }}>
                  <Plus size={14} />
                </button>
              </div>
              {envKeyError && <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: '#fca5a5' }}>{envKeyError}</p>}

              {/* Keys list */}
              {Object.keys(envKeys).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-subtle)', fontSize: '0.85rem' }}>
                  No keys stored yet. Add your first key above.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {Object.entries(envKeys).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: `1px solid ${editingEnvKey === k ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#22d3ee', flex: '0 0 auto', minWidth: '140px' }}>{k}</span>
                        <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {showEnvValue[k] ? v : '••••••••••••'}
                        </span>
                        <button onClick={() => setShowEnvValue(s => ({ ...s, [k]: !s[k] }))} className="btn-icon" style={{ color: 'var(--text-subtle)', padding: '0.2rem' }} aria-label={showEnvValue[k] ? 'Hide' : 'Show'}>
                          {showEnvValue[k] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button onClick={() => { setEditingEnvKey(editingEnvKey === k ? null : k); setEditingEnvValue(v); }} className="btn-icon" style={{ color: editingEnvKey === k ? 'var(--primary)' : 'var(--text-subtle)', padding: '0.2rem' }} aria-label={`Edit ${k}`}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDeleteEnvKey(k)} className="btn-icon-danger" aria-label={`Delete ${k}`} style={{ padding: '0.2rem' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {editingEnvKey === k && (
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <input
                            autoFocus
                            value={editingEnvValue}
                            onChange={e => setEditingEnvValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEditEnvKey(); if (e.key === 'Escape') setEditingEnvKey(null); }}
                            placeholder="Novo valor"
                            style={{ flex: 1, padding: '0.35rem 0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                          />
                          <button onClick={handleSaveEditEnvKey} disabled={envKeyLoading} className="btn-success" style={{ padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem' }}>
                            <Check size={13} /> Salvar
                          </button>
                          <button onClick={() => setEditingEnvKey(null)} className="btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}>
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* .env preview */}
            {Object.keys(envKeys).length > 0 && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>.env preview</p>
                  <button onClick={() => setEnvPreviewVisible(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', padding: '0.1rem 0.3rem' }}>
                    {envPreviewVisible ? <><EyeOff size={13}/> ocultar</> : <><Eye size={13}/> mostrar</>}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', overflowX: 'auto', maxHeight: '120px', overflowY: 'auto' }}>
                  {Object.entries(envKeys).map(([k, v]) => `${k}=${envPreviewVisible ? v : '•'.repeat(Math.min(v.length, 20))}`).join('\n')}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState<{ token: string; username: string } | null>(loadAuth);

  const handleAuth = (token: string, username: string) => {
    setAuth({ token, username });
  };

  const handleLogout = () => {
    clearAuth();
    setAuth(null);
  };

  if (!auth) return <LoginScreen onAuth={handleAuth} />;
  return <AppMain auth={auth} onLogout={handleLogout} />;
}
