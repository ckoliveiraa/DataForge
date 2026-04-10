import React, { useState, useRef, useCallback } from 'react';
import dagre from 'dagre';
import ReactFlow, { Background, Controls, ConnectionLineType, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Download, FileJson, Upload, Trash2, Key, Link as LinkIcon, X, Network, Play } from 'lucide-react';

import type { Table, Column } from './types/schema';
import { SchemaWriter } from './services/SchemaWriter';
import { SchemaReader } from './services/SchemaReader';
import TableNode from './components/TableNode';
import type { Schema } from './types/schema';

// Auto-load raw YAML strings from the schemas directory
const schemaFiles = import.meta.glob('../../../schemas/*.yaml', { eager: true, query: '?raw', import: 'default' });

const loadedSchemas: Record<string, Schema> = {};
const VALID_DOMAINS: string[] = ['custom'];

Object.entries(schemaFiles).forEach(([filepath, yamlContent]) => {
  const filename = filepath.split('/').pop()?.replace('.yaml', '');
  if (filename && typeof yamlContent === 'string') {
    try {
      const parsed = SchemaReader.parseYaml(yamlContent);
      loadedSchemas[filename] = parsed;
      VALID_DOMAINS.push(filename);
    } catch (e) {
      console.warn('Failed to parse YAML file:', filepath, e);
    }
  }
});
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
  
  const handleDomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDomain = e.target.value;
    setDomain(newDomain);
    
    if (newDomain !== 'custom' && loadedSchemas[newDomain]) {
      const tablesWithPos = loadedSchemas[newDomain].tables.map((t, index) => ({
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
              max: ''
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

  const [showRunPanel, setShowRunPanel] = useState(false);
  const [runConfig, setRunConfig] = useState<{
    format: string, 
    outputDir: string, 
    uploadTarget: string,
    bucket: string,
    prefix: string
  }>({ 
    format: 'csv', 
    outputDir: 'output', 
    uploadTarget: 'none',
    bucket: '',
    prefix: 'datasets/'
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
          format: runConfig.format,
          outputDir: runConfig.outputDir,
          uploadTarget: runConfig.uploadTarget !== 'none' ? runConfig.uploadTarget : undefined,
          bucket: runConfig.bucket,
          prefix: runConfig.prefix
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
               {VALID_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
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

                      <div style={{ marginBottom: '1rem' }}>
                         <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Faker Provider</label>
                         <input 
                           type="text" 
                           value={col.fakerProvider} 
                           onChange={e => onUpdateColumn(selectedTable.id, col.id, 'fakerProvider', e.target.value)} 
                           placeholder="e.g. phone_number"
                           style={{ padding: '0.5rem' }}
                         />
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
          <div className="glass-panel animated" style={{ width: '500px', maxWidth: '90vw', padding: '1.5rem', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(148, 163, 184, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Play size={20} color="#10b981"/> Run CLI Generator</h2>
              <button onClick={() => setShowRunPanel(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Output Format</label>
                <select value={runConfig.format} onChange={e => setRunConfig({...runConfig, format: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                  <option value="csv" style={{color: 'black'}}>CSV</option>
                  <option value="json" style={{color: 'black'}}>JSON</option>
                  <option value="parquet" style={{color: 'black'}}>Parquet</option>
                  <option value="avro" style={{color: 'black'}}>Avro</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Output Directory</label>
                <input type="text" value={runConfig.outputDir} onChange={e => setRunConfig({...runConfig, outputDir: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. ./output" />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Cloud Upload Target</label>
                <select value={runConfig.uploadTarget} onChange={e => setRunConfig({...runConfig, uploadTarget: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                  <option value="none" style={{color: 'black'}}>Local Disk Only</option>
                  <option value="s3" style={{color: 'black'}}>AWS S3</option>
                  <option value="gcs" style={{color: 'black'}}>Google Cloud Storage</option>
                  <option value="azure" style={{color: 'black'}}>Azure Blob Storage</option>
                </select>
              </div>

              {runConfig.uploadTarget !== 'none' && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Bucket / Container</label>
                    <input type="text" value={runConfig.bucket} onChange={e => setRunConfig({...runConfig, bucket: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. my-data-lake" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>Prefix (Folder)</label>
                    <input type="text" value={runConfig.prefix} onChange={e => setRunConfig({...runConfig, prefix: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g. datasets/" />
                  </div>
                </div>
              )}

              <button className="btn-primary" onClick={handleRunCli} disabled={isRunning} style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', background: '#10b981', borderColor: '#10b981', fontSize: '1rem' }}>
                {isRunning ? 'Running...' : 'Execute Dataforge CLI'}
              </button>

              {runLogs && (
                <div style={{ marginTop: '1rem', background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', maxHeight: '200px', overflowY: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: '#a7f3d0' }}>{runLogs}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
