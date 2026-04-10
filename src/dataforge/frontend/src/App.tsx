import React, { useState, useRef, useCallback, useEffect } from 'react';
import dagre from 'dagre';
import ReactFlow, { Background, Controls, ConnectionLineType, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Download, FileJson, Upload, Trash2, Key, Link as LinkIcon, X, Network, Play, BookOpen, Search } from 'lucide-react';

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

import type { Table, Column } from './types/schema';
import { SchemaWriter } from './services/SchemaWriter';
import { SchemaReader } from './services/SchemaReader';
import TableNode from './components/TableNode';
const VALID_DTYPES = [
  "int_seq", "uuid", "int", "float", "str", "bool", "date",
  "email", "name", "phone", "address", "city", "country",
  "company", "text", "url", "currency", "iban",
];

const nodeTypes = { tableNode: TableNode };

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
      alert("Error loading YAML schema: " + err.message);
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
              id: crypto.randomUUID(),
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
    const newId = crypto.randomUUID();
    setTables([
      ...tables,
      {
        id: newId,
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

  const [saveModal, setSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveError, setSaveError] = useState('');

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
  const [runConfig, setRunConfig] = useState<{
    formats: string[],
    outputDir: string,
    rows: string,
    uploadTarget: string,
    bucket: string,
    prefix: string,
    partitionBy: string,
    jsonMode: string,
    seed: string,
    dbUrl: string,
    ifExists: string,
    dbSchema: string,
    recurrence: string,
    count: string,
    tablesToInclude: string[],
    columnsFilter: string,
  }>({
    formats: ['csv'],
    destination: 'local' as 'local' | 'cloud' | 'database',
    outputDir: 'output',
    rows: '',
    uploadTarget: 'gcs',
    bucket: '',
    prefix: 'datasets/',
    partitionBy: '',
    jsonMode: 'flat',
    seed: '',
    dbUrl: '',
    ifExists: 'replace',
    dbSchema: '',
    recurrence: '',
    count: '',
    tablesToInclude: [],
    columnsFilter: '',
  });
  const [runLogs, setRunLogs] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleRunCli = async () => {
    setIsRunning(true);
    setRunLogs('Starting generation...');
    try {
      const yamlStr = SchemaWriter.generateYaml(domain, tables);
      const res = await fetch('/api/run-cli', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          yamlStr,
          formats: runConfig.formats,
          outputDir: runConfig.outputDir,
          rows: runConfig.rows !== '' ? parseInt(runConfig.rows) : undefined,
          uploadTarget: runConfig.destination === 'cloud' ? runConfig.uploadTarget : undefined,
          bucket: runConfig.bucket,
          prefix: runConfig.prefix,
          partitionBy: runConfig.partitionBy || undefined,
          jsonMode: runConfig.jsonMode,
          seed: runConfig.seed !== '' ? parseInt(runConfig.seed) : undefined,
          dbUrl: runConfig.destination === 'database' ? runConfig.dbUrl || undefined : undefined,
          ifExists: runConfig.ifExists,
          dbSchema: runConfig.dbSchema || undefined,
          recurrence: runConfig.recurrence !== '' ? parseFloat(runConfig.recurrence) : undefined,
          count: runConfig.count !== '' ? parseInt(runConfig.count) : undefined,
          tables: runConfig.tablesToInclude.length > 0 ? runConfig.tablesToInclude : undefined,
          columns: runConfig.columnsFilter.trim() ? runConfig.columnsFilter.trim().split('\n').filter(Boolean) : undefined,
        })
      });
      const data = await res.json();
      setRunLogs(`$ ${data.args}\n\n${data.output || data.error || 'Done.'}`);
    } catch (e: any) {
      setRunLogs(`Connection Error: ${e.message || String(e)}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Sync position changes back to tables state dynamically when nodes are dragged
  const onNodeDragStop = (_event: React.MouseEvent, node: Node) => {
    setTables(ts => ts.map(t => t.id === node.id ? { ...t, position: node.position } : t));
  };


  const selectedTable = tables.find(t => t.id === selectedTableId);

  return (
    <div className="container animated" style={{ maxWidth: '100vw', padding: '1rem', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.8rem' }}>Dataforge Canvas Planner</h1>
      </header>

      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1, marginRight: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div>
             <label style={{margin: 0, paddingRight: '0.5rem'}}>Domain:</label>
             <select value={domain} onChange={handleDomainChange} style={{width: 'auto', padding: '0.5rem'}}>
               {validDomains.map((d: string) => <option key={d} value={d}>{d}</option>)}
             </select>
          </div>
          <button className="btn-primary" onClick={addTable} style={{ padding: '0.5rem 1rem' }}>
            <Plus size={16} /> Add Table
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {tables.length > 0 && (
             <button className="btn-secondary" onClick={onLayout} style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} style={{ padding: '0.5rem 1rem' }}>
            <Upload size={16} /> Load YAML
          </button>
          {tables.length > 0 && (
             <button className="btn-secondary" onClick={generateSchema} style={{ padding: '0.5rem 1rem' }}>
               <FileJson size={16} /> Preview YAML
             </button>
          )}
          {tables.length > 0 && (
             <button className="btn-secondary" onClick={() => { setSaveName(domain !== 'custom' ? domain : ''); setSaveError(''); setSaveModal(true); }} style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: '#f59e0b', color: '#f59e0b' }}>
               <Download size={16} /> Save as Default
             </button>
          )}
          {tables.length > 0 && (
             <button className="btn-primary" onClick={() => setShowRunPanel(true)} style={{ padding: '0.5rem 1rem', background: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
            <Background color="#94a3b8" gap={20} size={1} />
            <Controls />
          </ReactFlow>

          {generatedYaml && (
            <div className="glass-panel animated" style={{ position: 'absolute', top: '1rem', right: '1rem', left: '1rem', zIndex: 10, maxHeight: '30vh', overflowY: 'auto', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#60a5fa' }}>YAML Schema Configuration</h3>
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
            background: 'rgba(15, 23, 42, 0.95)', 
            borderLeft: '1px solid rgba(148, 163, 184, 0.2)', 
            padding: '1.5rem', 
            height: '100%', 
            overflowY: 'auto',
            backdropFilter: 'blur(12px)',
            boxShadow: '-4px 0 15px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Edit Table</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => onRemoveTable(selectedTable.id)} style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  <Trash2 size={16}/>
                </button>
                <button onClick={() => setSelectedTableId(null)} style={{ padding: '0.5rem', background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>
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
                        <button onClick={() => onRemoveColumn(selectedTable.id, col.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}>
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
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Nullable (0-1)</label>
                          <input 
                            value={col.nullable} 
                            onChange={(e) => onUpdateColumn(selectedTable.id, col.id, 'nullable', e.target.value)} 
                            placeholder="0"
                            style={{ padding: '0.5rem' }}
                          />
                        </div>
                      </div>

                      {['int', 'float', 'date'].includes(col.dtype) && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Min</label>
                            <input
                              value={col.min}
                              onChange={e => onUpdateColumn(selectedTable.id, col.id, 'min', e.target.value)}
                              placeholder={col.dtype === 'date' ? 'e.g. -1y' : 'e.g. 0'}
                              style={{ padding: '0.5rem' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Max</label>
                            <input
                              value={col.max}
                              onChange={e => onUpdateColumn(selectedTable.id, col.id, 'max', e.target.value)}
                              placeholder={col.dtype === 'date' ? 'e.g. today' : 'e.g. 100'}
                              style={{ padding: '0.5rem' }}
                            />
                          </div>
                        </div>
                      )}

                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <button
                            onClick={() => { onUpdateColumn(selectedTable.id, col.id, 'choices', []); }}
                            style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: 'none', cursor: 'pointer', background: col.choices.length === 0 ? '#3b82f6' : 'rgba(255,255,255,0.07)', color: col.choices.length === 0 ? 'white' : '#94a3b8' }}
                          >
                            Faker Method
                          </button>
                          <button
                            onClick={() => { onUpdateColumn(selectedTable.id, col.id, 'fakerProvider', ''); onUpdateColumn(selectedTable.id, col.id, 'choices', col.choices.length === 0 ? [''] : col.choices); }}
                            style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: 'none', cursor: 'pointer', background: col.choices.length > 0 ? '#8b5cf6' : 'rgba(255,255,255,0.07)', color: col.choices.length > 0 ? 'white' : '#94a3b8' }}
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
                                style={{ padding: '0.4rem 0.6rem', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '6px', color: '#60a5fa', cursor: 'pointer', flexShrink: 0 }}>
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
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: '2.6rem', zIndex: 50, marginTop: '2px', background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                  {hits.map(m => (
                                    <button key={m.name} onMouseDown={() => onUpdateColumn(selectedTable.id, col.id, 'fakerProvider', m.name)}
                                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.45rem 0.75rem', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left' }}>
                                      <span style={{ fontSize: '0.65rem', background: `${m.color}22`, color: m.color, borderRadius: '3px', padding: '0.1rem 0.35rem', flexShrink: 0 }}>{m.category}</span>
                                      <span style={{ fontSize: '0.82rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{m.name}</span>
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

      {/* Run Generator Modal */}
      {showRunPanel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animated" style={{ width: '580px', maxWidth: '95vw', padding: '1.5rem', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(148, 163, 184, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Play size={20} color="#10b981"/> Run CLI Generator</h2>
              <button onClick={() => setShowRunPanel(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.25rem' }}>

              {/* Formats + JSON mode */}
              <div style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Formato</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(['csv', 'json', 'parquet', 'avro'] as const).map(fmt => {
                    const active = runConfig.formats.includes(fmt);
                    return (
                      <button key={fmt} type="button"
                        onClick={() => {
                          const next = active
                            ? runConfig.formats.filter(f => f !== fmt)
                            : [...runConfig.formats, fmt];
                          setRunConfig({ ...runConfig, formats: next.length > 0 ? next : [fmt] });
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
                    <select value={runConfig.jsonMode} onChange={e => setRunConfig({...runConfig, jsonMode: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                      <option value="flat" style={{color: 'black'}}>Flat (NDJSON)</option>
                      <option value="nested" style={{color: 'black'}}>Nested</option>
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Rows Override <span style={{ color: '#64748b' }}>(optional)</span></label>
                    <input type="number" value={runConfig.rows} onChange={e => setRunConfig({...runConfig, rows: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. 5000" min="1" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Partition By <span style={{ color: '#64748b' }}>(optional)</span></label>
                    <input type="text" value={runConfig.partitionBy} onChange={e => setRunConfig({...runConfig, partitionBy: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. transacted_at" />
                  </div>
                </div>
              </div>

              {/* Destination */}
              <div style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Destino</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  {([
                    { key: 'local', label: 'Local', color: '#60a5fa' },
                    { key: 'cloud', label: 'Cloud', color: '#a78bfa' },
                    { key: 'database', label: 'Database', color: '#f59e0b' },
                  ] as const).map(({ key, label, color }) => {
                    const active = runConfig.destination === key;
                    return (
                      <button key={key} type="button"
                        onClick={() => setRunConfig({ ...runConfig, destination: key })}
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
                    <input type="text" value={runConfig.outputDir} onChange={e => setRunConfig({...runConfig, outputDir: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. output" />
                  </div>
                )}

                {/* Cloud */}
                {runConfig.destination === 'cloud' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Provider</label>
                      <select value={runConfig.uploadTarget} onChange={e => setRunConfig({...runConfig, uploadTarget: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                        <option value="gcs" style={{color: 'black'}}>Google Cloud Storage</option>
                        <option value="s3" style={{color: 'black'}}>AWS S3</option>
                        <option value="azure" style={{color: 'black'}}>Azure Blob Storage</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Bucket / Container</label>
                        <input type="text" value={runConfig.bucket} onChange={e => setRunConfig({...runConfig, bucket: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. my-data-lake" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Prefix</label>
                        <input type="text" value={runConfig.prefix} onChange={e => setRunConfig({...runConfig, prefix: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. datasets/" />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Credentials File <span style={{ color: '#64748b' }}>(optional)</span></label>
                      <input type="text" value={runConfig.credentials} onChange={e => setRunConfig({...runConfig, credentials: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. /home/user/.gcp/key.json" />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Local staging directory</label>
                      <input type="text" value={runConfig.outputDir} onChange={e => setRunConfig({...runConfig, outputDir: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. output" />
                    </div>
                  </div>
                )}

                {/* Database */}
                {runConfig.destination === 'database' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>DB URL</label>
                      <input type="text" value={runConfig.dbUrl} onChange={e => setRunConfig({...runConfig, dbUrl: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. postgresql://user:pass@host/db" />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>If Table Exists</label>
                        <select value={runConfig.ifExists} onChange={e => setRunConfig({...runConfig, ifExists: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                          <option value="replace" style={{color: 'black'}}>Replace</option>
                          <option value="append" style={{color: 'black'}}>Append</option>
                          <option value="fail" style={{color: 'black'}}>Fail</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>DB Schema <span style={{ color: '#64748b' }}>(optional)</span></label>
                        <input type="text" value={runConfig.dbSchema} onChange={e => setRunConfig({...runConfig, dbSchema: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. public" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reproducibility */}
              <div style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Reproducibilidade</p>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Random Seed <span style={{ color: '#64748b' }}>(optional)</span></label>
                  <input type="number" value={runConfig.seed} onChange={e => setRunConfig({...runConfig, seed: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. 42" />
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Recurrence</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Interval (seconds) <span style={{ color: '#64748b' }}>(optional)</span></label>
                    <input type="number" value={runConfig.recurrence} onChange={e => setRunConfig({...runConfig, recurrence: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. 60" min="1" />
                  </div>
                  {runConfig.recurrence && (
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Batch Limit <span style={{ color: '#64748b' }}>(0 = infinite)</span></label>
                      <input type="number" value={runConfig.count} onChange={e => setRunConfig({...runConfig, count: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="0" min="0" />
                    </div>
                  )}
                </div>
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
                              setRunConfig({ ...runConfig, tablesToInclude: next });
                            }}
                            style={{ padding: '0.25rem 0.65rem', borderRadius: '5px', border: `1px solid ${active ? '#60a5fa' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)', color: active ? '#60a5fa' : '#64748b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 600 : 400 }}>
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                    {runConfig.tablesToInclude.length > 0 && (
                      <button type="button" onClick={() => setRunConfig({ ...runConfig, tablesToInclude: [] })} style={{ marginTop: '0.35rem', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.75rem' }}>Clear selection (use all)</button>
                    )}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>Column Filters <span style={{ color: '#64748b' }}>(one per line: table:col1,col2)</span></label>
                  <textarea
                    value={runConfig.columnsFilter}
                    onChange={e => setRunConfig({ ...runConfig, columnsFilter: e.target.value })}
                    rows={3}
                    placeholder={"orders:id,status,total\ncustomers:id,email"}
                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', resize: 'vertical', fontSize: '0.82rem', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <button className="btn-primary" onClick={handleRunCli} disabled={isRunning} style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', background: '#10b981', borderColor: '#10b981', fontSize: '1rem' }}>
                {isRunning ? 'Running...' : 'Execute Dataforge CLI'}
              </button>

              {runLogs && (
                <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', maxHeight: '200px', overflowY: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: '#a7f3d0' }}>{runLogs}</pre>
                </div>
              )}
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
              <button onClick={() => setFakerBrowser(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}>
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
    </div>
  );
}
