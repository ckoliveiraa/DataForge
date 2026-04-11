import React, { useState, useRef, useCallback, useEffect } from 'react';
import dagre from 'dagre';
import ReactFlow, { Background, Controls, ConnectionLineType, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css'; // ReactFlow v11 has no non-dist CSS export — necessary exception
import { Plus, Download, FileJson, Trash2, Key, Link as LinkIcon, X, Network, Play, BookOpen, Search, Sparkles } from 'lucide-react';

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


export default function App() {
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
    setSelectedTableId(newId);
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
                style: { stroke: '#ec4899', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#ec4899' }
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

  const AI_DEFAULT_PROMPT = `E-commerce with 4 tables:
- customers: full name, email, phone, city, country, registration date
- products: name, category (Electronics/Clothing/Books/Home/Sports), price (10–2000), stock quantity
- orders: linked to customer, order date (last 2 years), status (pending/processing/shipped/delivered/cancelled), total amount
- order_items: linked to order and product, quantity (1–10), unit price`;

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
  const currentApiKey = aiApiKeys[aiProvider] ?? '';
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
    if (!currentApiKey.trim() && !isOllama) { setAiError('API key is required.'); return; }
    if (!aiPrompt.trim()) { setAiError('Describe the domain you want to generate.'); return; }
    setAiLoading(true);
    try {
      const savedKeys = { ...aiApiKeys };
      const savedModels = { ...aiModels };
      if (currentApiKey.trim()) savedKeys[aiProvider] = currentApiKey.trim();
      if (currentModel.trim()) savedModels[aiProvider] = currentModel.trim();
      localStorage.setItem(AI_KEY_STORAGE, JSON.stringify({ provider: aiProvider, apiKeys: savedKeys, models: savedModels }));
      const res = await fetch('/api/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: aiProvider, apiKey: currentApiKey.trim(), model: currentModel.trim() || undefined, prompt: aiPrompt }),
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
      'Delete schema',
      `Remove "${domain}" permanently? This cannot be undone.`,
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
      if (!data.success) { setSaveError(data.error || 'Save failed.'); return; }
      setSaveModal(false);
      setSaveName('');
      window.location.reload();
    } catch (e: any) {
      setSaveError(e.message || String(e));
    }
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
    dbUrl: '',
    ifExists: 'replace',
    dbSchema: '',
    recurrence: '',
    count: '',
    tablesToInclude: [],
    columnsFilter: '',
    increments: [],
    workers: '16',
    cloudCreds: {
      gcsJson: '',
      s3AccessKey: '',
      s3SecretKey: '',
      s3Region: 'us-east-1',
      azureConnStr: '',
    },
  });
  const computedDbUrl = dbAdvanced ? runConfig.dbUrl : buildDbUrl(dbForm);

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
          dbUrl: runConfig.destination === 'database' ? computedDbUrl || undefined : undefined,
          ifExists: runConfig.ifExists,
          dbSchema: runConfig.dbSchema || undefined,
          recurrence: runConfig.recurrence !== '' ? parseFloat(runConfig.recurrence) : undefined,
          count: runConfig.count !== '' ? parseInt(runConfig.count) : undefined,
          tables: runConfig.tablesToInclude.length > 0 ? runConfig.tablesToInclude : undefined,
          columns: runConfig.columnsFilter.trim() ? runConfig.columnsFilter.trim().split('\n').filter(Boolean) : undefined,
          increments: runConfig.increments.filter(i => i.table && i.column && i.step !== ''),
          workers: runConfig.workers !== '' ? parseInt(runConfig.workers) : 16,
          cloudCreds: runConfig.destination === 'cloud' ? runConfig.cloudCreds : undefined,
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
              const statusLine = msg.stopped ? '\n⏹ Stopped.' : msg.success ? '\n✓ Done.' : '\n✗ Failed.';
              setRunLogs(prev => prev + statusLine);
              setIsRunning(false);
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if ((e as DOMException).name !== 'AbortError') {
        setRunLogs(prev => prev + `\nConnection Error: ${e.message || String(e)}`);
      }
      setIsRunning(false);
    } finally {
      runAbortRef.current = null;
    }
  };

  const handleStopCli = async () => {
    await fetch('/api/stop-cli', { method: 'POST' });
    setRunLogs(prev => prev + '\n⏹ Stop requested…');
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
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Synthetic Dataset Generator</span>
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
            Docs
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
            GitHub
          </a>
        </div>
      </header>

      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1, marginRight: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <label style={{margin: 0, paddingRight: '0.5rem'}}>Domain:</label>
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
            <Plus size={16} /> Add Table
          </button>
          <button
            className="btn-accent"
            onClick={() => { setAiError(''); setAiModal(true); }}
            style={{ padding: '0.5rem 1rem' }}
          >
            <Sparkles size={16} /> AI Generate
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {tables.length > 0 && (
             <button className="btn-secondary" onClick={onLayout} style={{ padding: '0.5rem 1rem' }}>
               <Network size={16} /> Auto Layout
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
               <FileJson size={16} /> Preview YAML
             </button>
          )}
          {tables.length > 0 && (
             <button className="btn-warning" onClick={() => { setSaveName(domain !== 'custom' ? domain : ''); setSaveError(''); setSaveModal(true); }} style={{ padding: '0.5rem 1rem' }}>
               <Download size={16} /> Save as Default
             </button>
          )}
          {tables.length > 0 && (
             <button className="btn-success" onClick={() => setShowRunPanel(true)} style={{ padding: '0.5rem 1rem' }}>
               <Play size={16} /> Run Generator
             </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(148, 163, 184, 0.2)', display: 'flex' }}>

        
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
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Edit Table</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => onRemoveTable(selectedTable.id)}
                  className="btn-icon-danger"
                  aria-label="Delete table"
                >
                  <Trash2 size={16}/>
                </button>
                <button onClick={() => setSelectedTableId(null)} className="btn-icon" aria-label="Close panel">
                  <X size={16}/>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Table Name</label>
              <input 
                type="text" 
                value={selectedTable.name} 
                onChange={e => onUpdateTable(selectedTable.id, 'name', e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label>Rows Count</label>
              <input 
                type="number" 
                value={selectedTable.rows} 
                onChange={e => onUpdateTable(selectedTable.id, 'rows', parseInt(e.target.value) || 0)} 
                min="1"
              />
            </div>

            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Columns</h3>
                <button className="btn-secondary" onClick={() => onAddColumn(selectedTable.id)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>
                  <Plus size={14} /> Add
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedTable.columns.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', border: '1px dashed rgba(148, 163, 184, 0.2)', borderRadius: '8px' }}>
                    No columns defined.
                  </div>
                ) : (
                  selectedTable.columns.map(col => (
                    <div key={col.id} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: '8px', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <input 
                          value={col.name} 
                          onChange={(e) => onUpdateColumn(selectedTable.id, col.id, 'name', e.target.value)}
                          placeholder="Column Name"
                          style={{ flex: 1, marginRight: '0.5rem', padding: '0.5rem' }}
                        />
                        <button
                          onClick={() => onRemoveColumn(selectedTable.id, col.id)}
                          className="btn-icon-danger"
                          aria-label="Remove column"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Type</label>
                          <select 
                            value={col.dtype} 
                            onChange={(e) => onUpdateColumn(selectedTable.id, col.id, 'dtype', e.target.value)}
                            style={{ padding: '0.5rem' }}
                          >
                            {VALID_DTYPES.map(d => <option key={d} value={d} style={{color: '#000'}}>{d}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <label style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Nullable</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={parseFloat(col.nullable as any) > 0}
                                onChange={e => onUpdateColumn(selectedTable.id, col.id, 'nullable', e.target.checked ? '0.5' : '0')}
                                style={{ width: '1rem', height: '1rem', accentColor: '#38bdf8', cursor: 'pointer' }}
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
                                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>%</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: '#475569' }}>No</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {['int', 'float', 'date'].includes(col.dtype) && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Min</label>
                            <input
                              value={col.min}
                              onChange={e => onUpdateColumn(selectedTable.id, col.id, 'min', e.target.value)}
                              placeholder={col.dtype === 'date' ? 'e.g. -1y' : 'e.g. 0'}
                              style={{ padding: '0.5rem', width: '100%', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Max</label>
                            <input
                              value={col.max}
                              onChange={e => onUpdateColumn(selectedTable.id, col.id, 'max', e.target.value)}
                              placeholder={col.dtype === 'date' ? 'e.g. today' : 'e.g. 100'}
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
                            Faker Method
                          </button>
                          <button
                            onClick={() => { onUpdateColumn(selectedTable.id, col.id, 'fakerProvider', ''); onUpdateColumn(selectedTable.id, col.id, 'choices', col.choices.length === 0 ? [''] : col.choices); }}
                            style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: `1px solid ${col.choices.length > 0 ? 'rgba(251,146,60,0.4)' : 'transparent'}`, cursor: 'pointer', background: col.choices.length > 0 ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.05)', color: col.choices.length > 0 ? 'var(--accent)' : 'var(--text-muted)' }}
                          >
                            Custom List
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
                                  placeholder="e.g. phone_number"
                                  style={{ padding: '0.5rem', paddingRight: '1.8rem' }}
                                />
                                {col.fakerProvider && (
                                  <button onClick={() => onUpdateColumn(selectedTable.id, col.id, 'fakerProvider', '')}
                                    style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                              <button
                                title="Browse all faker methods"
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
                                      <span style={{ fontSize: '0.72rem', color: '#475569', marginLeft: 'auto', flexShrink: 0 }}>{m.example}</span>
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
                              placeholder="Type a value and press Enter"
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
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>Press Enter or comma to add</p>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input type="checkbox" checked={col.isPrimaryKey} onChange={(e) => onUpdateColumn(selectedTable.id, col.id, 'isPrimaryKey', e.target.checked)} />
                          <Key size={14} color="#eab308"/> Primary Key
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input type="checkbox" checked={col.isForeignKey} onChange={(e) => onUpdateColumn(selectedTable.id, col.id, 'isForeignKey', e.target.checked)} />
                          <LinkIcon size={14} color="#ec4899"/> Foreign Key
                        </label>
                      </div>

                      {col.isForeignKey && (
                        <div style={{ background: 'rgba(236, 72, 153, 0.05)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                          <div style={{ marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.75rem', color: '#ec4899' }}>Reference Table Name</label>
                            <input 
                              type="text" 
                              value={col.fkTable} 
                              onChange={e => onUpdateColumn(selectedTable.id, col.id, 'fkTable', e.target.value)} 
                              style={{ padding: '0.5rem', border: '1px solid rgba(236, 72, 153, 0.3)' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', color: '#ec4899' }}>Reference Column Name</label>
                            <input 
                              type="text" 
                              value={col.fkColumn} 
                              onChange={e => onUpdateColumn(selectedTable.id, col.id, 'fkColumn', e.target.value)} 
                              style={{ padding: '0.5rem', border: '1px solid rgba(236, 72, 153, 0.3)' }}
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
              <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1rem' }}>Run Generator — Field Reference</h3>
              <button onClick={() => setShowRunHelp(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
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
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>{section}</p>
                {fields.map(({ name, desc }) => (
                  <div key={name} style={{ marginBottom: '0.75rem', paddingLeft: '0.75rem', borderLeft: '2px solid rgba(96,165,250,0.2)' }}>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.82rem', color: '#93c5fd', fontWeight: 600 }}>{name}</p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{desc}</p>
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
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Play size={18} color="var(--success)"/> Run Generator</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => setShowRunHelp(true)} style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>? Help</button>
                <button onClick={() => setShowRunPanel(false)} className="btn-icon" aria-label="Close run panel"><X size={18}/></button>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.25rem' }}>

              {/* Formats + JSON mode */}
              {runConfig.destination !== 'database' && <div style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Format</p>
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
                        style={{ padding: '0.35rem 0.85rem', borderRadius: '6px', border: `1px solid ${active ? '#10b981' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: active ? '#10b981' : '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', fontWeight: active ? 600 : 400 }}>
                        {fmt.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                {runConfig.formats.includes('json') && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>JSON Mode</label>
                    <select value={runConfig.jsonMode} onChange={e => setRunConfig(r => ({...r, jsonMode: e.target.value}))} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                      <option value="flat" style={{color: 'black'}}>Flat (NDJSON)</option>
                      <option value="nested" style={{color: 'black'}}>Nested</option>
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Rows Override <span style={{ color: '#64748b' }}>(optional)</span></label>
                    <input type="number" value={runConfig.rows} onChange={e => setRunConfig(r => ({...r, rows: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. 5000" min="1" />
                  </div>
                </div>
              </div>}

              {/* Destination */}
              <div style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Destination</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  {([
                    { key: 'local', label: 'Local', color: '#60a5fa' },
                    { key: 'cloud', label: 'Cloud', color: '#a78bfa' },
                    { key: 'database', label: 'Database', color: '#f59e0b' },
                  ] as const).map(({ key, label, color }) => {
                    const active = runConfig.destination === key;
                    return (
                      <button key={key} type="button"
                        onClick={() => setRunConfig(r => ({ ...r, destination: key }))}
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`, background: active ? `${color}18` : 'rgba(255,255,255,0.04)', color: active ? color : '#64748b', cursor: 'pointer', fontSize: '0.9rem', fontWeight: active ? 700 : 400, transition: 'all 0.15s' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Local */}
                {runConfig.destination === 'local' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Output Directory</label>
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
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', whiteSpace: 'nowrap' }}
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
                        <label style={{ display: 'block', marginBottom: '0.4rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Saved Credentials</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {credProfiles.filter(p => p.provider === runConfig.uploadTarget).map(p => (
                            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.4rem 0.6rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <button type="button" onClick={() => handleLoadCredProfile(p.name)}
                                style={{ flex: 1, background: 'none', border: 'none', color: '#e2e8f0', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                                {p.name}
                                <span style={{ marginLeft: '0.5rem', color: '#475569', fontSize: '0.72rem' }}>{p.provider.toUpperCase()}</span>
                              </button>
                              <button type="button" onClick={() => handleDeleteCredProfile(p.name)}
                                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.2rem' }}
                                title="Remove">✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Provider */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Provider</label>
                      <select value={runConfig.uploadTarget} onChange={e => setRunConfig(r => ({...r, uploadTarget: e.target.value}))} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                        <option value="gcs" style={{color: 'black'}}>Google Cloud Storage</option>
                        <option value="s3" style={{color: 'black'}}>AWS S3</option>
                        <option value="azure" style={{color: 'black'}}>Azure Blob Storage</option>
                      </select>
                    </div>

                    {/* Bucket + Prefix */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Bucket / Container</label>
                        <input type="text" value={runConfig.bucket} onChange={e => setRunConfig(r => ({...r, bucket: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. my-data-lake" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Prefix</label>
                        <input type="text" value={runConfig.prefix} onChange={e => setRunConfig(r => ({...r, prefix: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. datasets/" />
                      </div>
                    </div>

                    {/* Credentials — per provider */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                        <p style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>Credentials</p>
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
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '5px', color: '#10b981', cursor: 'pointer' }}>
                              Save
                            </button>
                            <button type="button" onClick={() => setShowSaveCredInput(false)}
                              style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setShowSaveCredInput(true)}
                            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                            Save credentials
                          </button>
                        )}
                      </div>

                      {runConfig.uploadTarget === 'gcs' && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Service Account JSON</label>
                          <textarea
                            value={runConfig.cloudCreds.gcsJson}
                            onChange={e => setRunConfig(r => ({...r, cloudCreds: {...r.cloudCreds, gcsJson: e.target.value}}))}
                            rows={5}
                            placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
                            style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', resize: 'vertical', fontSize: '0.78rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
                          />
                        </div>
                      )}

                      {runConfig.uploadTarget === 's3' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '0.4rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Access Key ID</label>
                              <input type="text" value={runConfig.cloudCreds.s3AccessKey} onChange={e => setRunConfig(r => ({...r, cloudCreds: {...r.cloudCreds, s3AccessKey: e.target.value}}))} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} placeholder="AKIA..." />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '0.4rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Secret Access Key</label>
                              <input type="password" value={runConfig.cloudCreds.s3SecretKey} onChange={e => setRunConfig(r => ({...r, cloudCreds: {...r.cloudCreds, s3SecretKey: e.target.value}}))} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} placeholder="••••••••" />
                            </div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Region</label>
                            <input type="text" value={runConfig.cloudCreds.s3Region} onChange={e => setRunConfig(r => ({...r, cloudCreds: {...r.cloudCreds, s3Region: e.target.value}}))} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} placeholder="us-east-1" />
                          </div>
                        </div>
                      )}

                      {runConfig.uploadTarget === 'azure' && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Connection String</label>
                          <input type="password" value={runConfig.cloudCreds.azureConnStr} onChange={e => setRunConfig(r => ({...r, cloudCreds: {...r.cloudCreds, azureConnStr: e.target.value}}))} style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }} placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net" />
                        </div>
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
                        <label style={{ display: 'block', marginBottom: '0.4rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Saved Connections</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {savedConns.map(conn => (
                            <div key={conn.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.4rem 0.6rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <button type="button" onClick={() => handleLoadConn(conn)}
                                style={{ flex: 1, background: 'none', border: 'none', color: '#e2e8f0', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                                {conn.name}
                                <span style={{ marginLeft: '0.5rem', color: '#475569', fontSize: '0.72rem' }}>
                                  {conn.advanced ? conn.advancedUrl.replace(/:([^:@]+)@/, ':***@') : `${conn.form.type}://${conn.form.host}/${conn.form.database}`}
                                </span>
                              </button>
                              <button type="button" onClick={() => handleDeleteConn(conn.name)}
                                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.2rem', lineHeight: 1 }}
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
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '5px', color: '#10b981', cursor: 'pointer' }}>
                            Save
                          </button>
                          <button type="button" onClick={() => setShowSaveInput(false)}
                            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setShowSaveInput(true)}
                          style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                          Save connection
                        </button>
                      )}
{/* Advanced connection string toggle disabled */}
                    </div>

                    {!dbAdvanced ? (
                      <>
                        {/* DB Type */}
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Database Type</label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {(['postgresql', 'mysql', 'sqlite'] as const).map(t => {
                              const active = dbForm.type === t;
                              const colors: Record<string, string> = { postgresql: '#60a5fa', mysql: '#f59e0b', sqlite: '#a78bfa' };
                              return (
                                <button key={t} type="button"
                                  onClick={() => { setDbForm(f => ({ ...f, type: t, port: DB_PORT_DEFAULTS[t] })); setDbTestStatus('idle'); }}
                                  style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: `1px solid ${active ? colors[t] : 'rgba(255,255,255,0.1)'}`, background: active ? `${colors[t]}18` : 'rgba(255,255,255,0.04)', color: active ? colors[t] : '#64748b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 700 : 400, transition: 'all 0.15s', textTransform: 'capitalize' }}>
                                  {t === 'postgresql' ? 'PostgreSQL' : t === 'mysql' ? 'MySQL' : 'SQLite'}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* SQLite: apenas caminho do arquivo */}
                        {dbForm.type === 'sqlite' ? (
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>File Path</label>
                            <input type="text" value={dbForm.database}
                              onChange={e => { setDbForm(f => ({ ...f, database: e.target.value })); setDbTestStatus('idle'); }}
                              style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. output/data.db" />
                          </div>
                        ) : (
                          <>
                            {/* Host + Port */}
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <div style={{ flex: 3 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Host</label>
                                <input type="text" value={dbForm.host}
                                  onChange={e => { setDbForm(f => ({ ...f, host: e.target.value })); setDbTestStatus('idle'); }}
                                  style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. localhost" />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Port</label>
                                <input type="text" value={dbForm.port}
                                  onChange={e => { setDbForm(f => ({ ...f, port: e.target.value })); setDbTestStatus('idle'); }}
                                  style={{ width: '100%', padding: '0.5rem' }} placeholder="5432" />
                              </div>
                            </div>

                            {/* Database name */}
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Database</label>
                              <input type="text" value={dbForm.database}
                                onChange={e => { setDbForm(f => ({ ...f, database: e.target.value })); setDbTestStatus('idle'); }}
                                style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. mydb" />
                            </div>

                            {/* User + Password */}
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>User</label>
                                <input type="text" value={dbForm.user}
                                  onChange={e => { setDbForm(f => ({ ...f, user: e.target.value })); setDbTestStatus('idle'); }}
                                  style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. admin" />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Password</label>
                                <div style={{ position: 'relative' }}>
                                  <input
                                    type={showDbPassword ? 'text' : 'password'}
                                    value={dbForm.password}
                                    onChange={e => { setDbForm(f => ({ ...f, password: e.target.value })); setDbTestStatus('idle'); }}
                                    style={{ width: '100%', padding: '0.5rem', paddingRight: '2.2rem', boxSizing: 'border-box' }}
                                    placeholder="••••••••"
                                  />
                                  <button type="button" onClick={() => setShowDbPassword(v => !v)}
                                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
                                    {showDbPassword ? '🙈' : '👁'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Connection string preview */}
                        {computedDbUrl && (
                          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.72rem', color: '#64748b', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                            {computedDbUrl.replace(/:([^:@]+)@/, ':***@')}
                          </div>
                        )}
                      </>
                    ) : (
                      /* Advanced: connection string manual */
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Connection String</label>
                        <input
                          type="text"
                          value={runConfig.dbUrl}
                          onChange={e => { setRunConfig(r => ({...r, dbUrl: e.target.value})); setDbTestStatus('idle'); setDbTestError(''); }}
                          style={{ width: '100%', padding: '0.5rem' }}
                          placeholder="postgresql+psycopg2://user:pass@host:5432/db"
                        />
                      </div>
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
                            color: dbTestStatus === 'ok' ? '#10b981' : dbTestStatus === 'error' ? '#ef4444' : '#94a3b8',
                            cursor: !computedDbUrl.trim() || dbTestStatus === 'testing' ? 'not-allowed' : 'pointer',
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s',
                            opacity: !computedDbUrl.trim() ? 0.5 : 1,
                          }}
                        >
                          {dbTestStatus === 'testing' ? '...' : dbTestStatus === 'ok' ? '✓ Connected' : dbTestStatus === 'error' ? '✗ Failed' : 'Test Connection'}
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
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>If Table Exists</label>
                        <select value={runConfig.ifExists} onChange={e => setRunConfig(r => ({...r, ifExists: e.target.value}))} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                          <option value="replace" style={{color: 'black'}}>Replace</option>
                          <option value="append" style={{color: 'black'}}>Append</option>
                          <option value="fail" style={{color: 'black'}}>Fail</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>DB Schema <span style={{ color: '#64748b' }}>(optional)</span></label>
                        <input type="text" value={runConfig.dbSchema} onChange={e => setRunConfig(r => ({...r, dbSchema: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. public" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reproducibility */}
              <div style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Reproducibility</p>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Random Seed <span style={{ color: '#64748b' }}>(optional)</span></label>
                  <input type="number" value={runConfig.seed} onChange={e => setRunConfig(r => ({...r, seed: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. 42" />
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Recurrence</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Interval (seconds) <span style={{ color: '#64748b' }}>(optional)</span></label>
                    <input type="number" value={runConfig.recurrence} onChange={e => setRunConfig(r => ({...r, recurrence: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. 60" min="1" />
                  </div>
                  {runConfig.recurrence && (
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Batch Limit <span style={{ color: '#64748b' }}>(0 = infinite)</span></label>
                      <input type="number" value={runConfig.count} onChange={e => setRunConfig(r => ({...r, count: e.target.value}))} style={{ width: '100%', padding: '0.5rem' }} placeholder="0" min="0" />
                    </div>
                  )}
                </div>

                {/* Increment — only relevant in recurrence mode */}
                {runConfig.recurrence && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <label style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Column Increments <span style={{ color: '#64748b' }}>(shift values per batch)</span></label>
                      <button type="button"
                        onClick={() => setRunConfig(r => ({ ...r, increments: [...r.increments, { table: tables[0]?.name || '', column: '', step: '1', unit: 'days' }] }))}
                        style={{ padding: '0.2rem 0.6rem', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '5px', color: '#60a5fa', cursor: 'pointer', fontSize: '0.78rem' }}>
                        + Add
                      </button>
                    </div>
                    {runConfig.increments.map((inc, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <select value={inc.table} onChange={e => { const next = [...runConfig.increments]; next[idx] = { ...next[idx], table: e.target.value, column: '' }; setRunConfig(r => ({ ...r, increments: next })); }}
                          style={{ flex: '1.2', padding: '0.35rem 0.4rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.8rem' }}>
                          <option value="">table</option>
                          {tables.map(t => <option key={t.id} value={t.name} style={{ color: 'black' }}>{t.name}</option>)}
                        </select>
                        <select value={inc.column} onChange={e => { const next = [...runConfig.increments]; next[idx] = { ...next[idx], column: e.target.value }; setRunConfig(r => ({ ...r, increments: next })); }}
                          style={{ flex: '1.5', padding: '0.35rem 0.4rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: inc.column ? '#e2e8f0' : '#475569', fontSize: '0.8rem' }}>
                          <option value="">column</option>
                          {(tables.find(t => t.name === inc.table)?.columns || []).map(c => <option key={c.id} value={c.name} style={{ color: 'black' }}>{c.name}</option>)}
                        </select>
                        <input type="number" value={inc.step} onChange={e => { const next = [...runConfig.increments]; next[idx] = { ...next[idx], step: e.target.value }; setRunConfig(r => ({ ...r, increments: next })); }}
                          style={{ width: '56px', padding: '0.35rem 0.4rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.8rem' }} placeholder="step" />
                        <select value={inc.unit} onChange={e => { const next = [...runConfig.increments]; next[idx] = { ...next[idx], unit: e.target.value }; setRunConfig(r => ({ ...r, increments: next })); }}
                          style={{ flex: '1', padding: '0.35rem 0.4rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.8rem' }}>
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
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Filters <span style={{ color: '#475569', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></p>
                {tables.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Include Tables <span style={{ color: '#64748b' }}>(default: all)</span></label>
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
                            style={{ padding: '0.25rem 0.65rem', borderRadius: '5px', border: `1px solid ${active ? '#60a5fa' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)', color: active ? '#60a5fa' : '#64748b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 600 : 400 }}>
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                    {runConfig.tablesToInclude.length > 0 && (
                      <button type="button" onClick={() => setRunConfig(r => ({ ...r, tablesToInclude: [] }))} style={{ marginTop: '0.35rem', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.75rem' }}>Clear selection (use all)</button>
                    )}
                  </div>
                )}
                {tables.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Partition By <span style={{ color: '#64748b' }}>(per table — Hive-style)</span></label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {tables.map(t => {
                        const col = runConfig.partitionByTable[t.name] || '';
                        const gran = runConfig.partitionDateGranularity[t.name] || '';
                        const colObj = t.columns.find(c => c.name === col);
                        const showGranularity = !!col && !!colObj && isDateColumn(colObj);
                        return (
                          <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ width: '120px', fontSize: '0.8rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.name}</span>
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
                                style={{ flex: 1, padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: col ? '#e2e8f0' : '#475569', fontSize: '0.82rem' }}
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
                                      color: gran === opt.value ? '#a5b4fc' : '#475569',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                    }}
                                  >{opt.label}</button>
                                ))}
                                {gran && (
                                  <span style={{ fontSize: '0.72rem', color: '#475569', fontFamily: 'monospace' }}>
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
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Partition Workers <span style={{ color: '#64748b' }}>(parallel threads)</span></label>
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
                    ? 'Bucket / Container is required for cloud upload.'
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
                  style={{ flex: 1, padding: '0.75rem', background: '#10b981', borderColor: '#10b981', fontSize: '1rem', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                  {isRunning ? 'Running…' : 'Execute Dataforge CLI'}
                </button>
                {isRunning && (
                  <button onClick={handleStopCli}
                    style={{ padding: '0.75rem 1.25rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', color: '#f87171', fontSize: '1rem', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ⏹ Stop
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
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <Sparkles size={18} color="#a78bfa" /> AI Generate Domain
              </h2>
              <button onClick={() => !aiLoading && setAiModal(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
              Describe the domain you need — the AI generates a full YAML schema with tables, types, and relationships.
            </p>

            {/* Provider grid */}
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Provider</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                {AI_PROVIDERS.map(({ key, label, color }) => {
                  const active = aiProvider === key;
                  return (
                    <button key={key} type="button" onClick={() => { setAiProvider(key); setAiError(''); }}
                      style={{ padding: '0.5rem 0.3rem', borderRadius: '8px', border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`, background: active ? `${color}20` : 'rgba(255,255,255,0.03)', color: active ? color : '#64748b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 700 : 400, transition: 'all 0.12s', textAlign: 'center' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* API Key */}
            {aiProvider !== 'ollama' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  API Key <span style={{ color: '#334155', textTransform: 'none', letterSpacing: 0 }}>(saved in browser)</span>
                </label>
                <input
                  type="password"
                  value={currentApiKey}
                  onChange={e => {
                    setAiApiKeys(prev => ({ ...prev, [aiProvider]: e.target.value }));
                    setAiAvailableModels(prev => ({ ...prev, [aiProvider]: [] }));
                    setAiModelsError('');
                  }}
                  placeholder={currentProviderMeta.keyPlaceholder}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.05)', border: `1px solid ${currentApiKey ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '7px', color: 'white', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Model */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Model <span style={{ color: '#334155', textTransform: 'none', letterSpacing: 0 }}>{aiProvider === 'ollama' ? '(required)' : '(optional)'}</span>
                </label>
                <button type="button" onClick={handleLoadModels}
                  disabled={aiModelsLoading || (!currentApiKey.trim() && aiProvider !== 'ollama')}
                  style={{ background: 'none', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '5px', color: '#60a5fa', cursor: 'pointer', fontSize: '0.72rem', padding: '0.2rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: (!currentApiKey.trim() && aiProvider !== 'ollama') ? 0.35 : 1, minHeight: 'unset' }}>
                  {aiModelsLoading
                    ? <><span style={{ display: 'inline-block', width: '10px', height: '10px', border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: '#60a5fa', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Loading…</>
                    : '⟳ Load available models'}
                </button>
              </div>

              {availableModels.length > 0 ? (
                <select
                  value={currentModel}
                  onChange={e => setAiModels(prev => ({ ...prev, [aiProvider]: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '7px', color: 'white', fontSize: '0.85rem', boxSizing: 'border-box' }}
                >
                  <option value="" style={{ color: 'black' }}>— select a model —</option>
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
                <label style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>What dataset do you need?</label>
                <button type="button" onClick={() => setAiPrompt(AI_DEFAULT_PROMPT)}
                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.72rem', textDecoration: 'underline', padding: 0 }}>
                  Reset to example
                </button>
              </div>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                rows={7}
                placeholder="Describe your domain in plain language — table names, columns, relationships, value ranges, categories..."
                style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#e2e8f0', resize: 'vertical', fontSize: '0.84rem', lineHeight: 1.6, boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#475569' }}>⚙</span>
                The YAML format specification and a reference example are automatically sent to the AI — you only need to describe the data.
              </p>
            </div>

            {aiError && (
              <div style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#f87171', background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '6px', padding: '0.5rem 0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflowY: 'auto' }}>{aiError}</div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => !aiLoading && setAiModal(false)}
                style={{ flex: 1, padding: '0.65rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', color: '#64748b', cursor: aiLoading ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
                Cancel
              </button>
              <button type="button" onClick={handleAiGenerate} disabled={aiLoading}
                style={{ flex: 2, padding: '0.65rem', background: aiLoading ? 'rgba(139,92,246,0.25)' : 'linear-gradient(135deg, #7c3aed, #2563eb)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, cursor: aiLoading ? 'not-allowed' : 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {aiLoading ? (
                  <>
                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Generating…
                  </>
                ) : (
                  <><Sparkles size={16} /> Generate Schema</>
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
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} color="#f59e0b" /> Save as Default Schema
              </h2>
              <button onClick={() => setSaveModal(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              The schema will be saved to <code style={{ color: '#f59e0b', fontSize: '0.8rem' }}>src/dataforge/schemas/</code> and appear in the Domain selector after reload.
            </p>
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label>Schema Name</label>
              <input
                autoFocus
                type="text"
                value={saveName}
                onChange={e => { setSaveName(e.target.value); setSaveError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSaveSchema()}
                placeholder="e.g. my_schema"
                style={{ textTransform: 'lowercase' }}
              />
            </div>
            <p style={{ margin: '0.25rem 0 1rem', fontSize: '0.72rem', color: '#475569' }}>
              Lowercase letters, numbers, hyphens and underscores only.
            </p>
            {saveError && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>{saveError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={() => setSaveModal(false)} style={{ flex: 1, padding: '0.6rem' }}>Cancel</button>
              <button onClick={handleSaveSchema} style={{ flex: 2, padding: '0.6rem', background: '#f59e0b', border: 'none', borderRadius: '8px', color: 'black', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                Save & Reload
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
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#e2e8f0' }}>Faker Method Browser</h2>
              <div style={{ flex: 1, position: 'relative', marginLeft: '0.5rem' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  autoFocus
                  value={fakerSearch}
                  onChange={e => setFakerSearch(e.target.value)}
                  placeholder="Search methods..."
                  style={{ width: '100%', padding: '0.4rem 0.75rem 0.4rem 2rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', color: 'white', fontSize: '0.875rem' }}
                />
              </div>
              <button onClick={() => setFakerBrowser(null)} className="btn-icon" aria-label="Close browser">
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
                          <span style={{ fontSize: '0.8rem', color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 500 }}>{m.name}</span>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem' }}>{m.example}</span>
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
    </div>
  );
}
