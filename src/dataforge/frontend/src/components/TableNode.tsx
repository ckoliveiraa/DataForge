import { Handle, Position } from 'reactflow';
import { Key, Link as LinkIcon, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Column } from '../types/schema';

export default function TableNode({ data, selected }: { data: any, selected: boolean }) {
  const { t } = useTranslation();
  const { name, rows, columns } = data;

  return (
    <div style={{
      background: selected ? 'rgba(34, 211, 238, 0.08)' : 'var(--bg-card)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: `1px solid ${selected ? 'rgba(34, 211, 238, 0.55)' : 'rgba(255,255,255,0.08)'}`,
      borderTopColor: selected ? 'rgba(34, 211, 238, 0.7)' : 'rgba(255,255,255,0.13)',
      borderRadius: '14px',
      minWidth: '220px',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-body)',
      boxShadow: selected
        ? '0 0 0 1px rgba(34,211,238,0.18), 0 0 20px rgba(34,211,238,0.12), 0 8px 32px rgba(0,0,0,0.5)'
        : '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.4)',
      transition: 'border-color 180ms cubic-bezier(0,0,0.2,1), box-shadow 180ms cubic-bezier(0,0,0.2,1)',
    }}>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'var(--primary)', width: 10, height: 10, border: '2px solid var(--bg-dark)' }}
      />

      {/* Header */}
      <div style={{
        background: 'rgba(0,0,0,0.18)',
        padding: '0.75rem 1rem',
        borderTopLeftRadius: '13px',
        borderTopRightRadius: '13px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-display)' }}>
          <Database size={14} color="var(--primary)" />
          {name || t('schema.untitled')}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
          {rows.toLocaleString()} {t('common.rows')}
        </div>
      </div>

      {/* Columns list */}
      <div style={{ padding: '0.5rem' }}>
        {columns.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', textAlign: 'center', padding: '0.75rem' }}>
            {t('schema.noColumns')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {columns.map((col: Column) => (
              <div key={col.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.78rem',
                padding: '0.3rem 0.5rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '6px',
              }}>
                <span style={{
                  fontWeight: col.isPrimaryKey ? 600 : 400,
                  color: col.isPrimaryKey ? 'var(--warning)' : 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  {col.name || t('schema.untitledColumn')}
                  {col.isPrimaryKey && <Key size={11} color="var(--warning)" />}
                  {col.isForeignKey && <LinkIcon size={11} color="var(--accent)" />}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                  {col.dtype}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'var(--accent)', width: 10, height: 10, border: '2px solid var(--bg-dark)' }}
      />
    </div>
  );
}
