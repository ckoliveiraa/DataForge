import { Handle, Position } from 'reactflow';
import { Key, Link as LinkIcon, Database } from 'lucide-react';
import type { Column } from '../types/schema';

export default function TableNode({ data, selected }: { data: any, selected: boolean }) {
  const { name, rows, columns } = data;

  return (
    <div className="table-node" style={{
      background: selected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(30, 41, 59, 0.85)',
      backdropFilter: 'blur(12px)',
      border: `2px solid ${selected ? '#3b82f6' : 'rgba(148, 163, 184, 0.2)'}`,
      borderRadius: '12px',
      minWidth: '220px',
      color: '#f8fafc',
      fontFamily: 'Inter, sans-serif',
      boxShadow: selected ? '0 0 15px rgba(59,130,246, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
      transition: 'all 0.2s ease',
      padding: '0'
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#3b82f6', width: 10, height: 10, border: '2px solid #1e293b' }} />

      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
          <Database size={16} color="#3b82f6" />
          {name || 'Untitled'}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
          {rows} rows
        </div>
      </div>

      {/* Columns List Visual */}
      <div style={{ padding: '0.5rem' }}>
        {columns.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', padding: '1rem' }}>
            No columns
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {columns.map((col: Column) => (
              <div key={col.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <span style={{ fontWeight: col.isPrimaryKey ? 600 : 400, color: col.isPrimaryKey ? '#eab308' : '#e2e8f0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {col.name || 'untitled'} 
                  {col.isPrimaryKey && <Key size={12} color="#eab308"/>}  
                  {col.isForeignKey && <LinkIcon size={12} color="#ec4899"/>}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{col.dtype}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#ec4899', width: 10, height: 10, border: '2px solid #1e293b' }} />
    </div>
  );
}
