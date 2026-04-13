import { describe, it, expect, vi, beforeEach } from 'vitest'
import YAML from 'yaml'
import { SchemaWriter } from './SchemaWriter'
import type { Table } from '../types/schema'

const makeTable = (overrides: Partial<Table> = {}): Table => ({
  id: 'table-1',
  name: 'users',
  rows: 1000,
  columns: [],
  ...overrides,
})

const makeColumn = (overrides = {}) => ({
  id: 'col-1',
  name: 'id',
  dtype: 'int',
  isPrimaryKey: false,
  fakerProvider: '',
  nullable: '0',
  isForeignKey: false,
  fkTable: '',
  fkColumn: '',
  min: '',
  max: '',
  choices: [],
  ...overrides,
})

describe('SchemaWriter.generateYaml', () => {
  it('inclui o domínio no YAML gerado', () => {
    const yaml = SchemaWriter.generateYaml('finance', [])
    const parsed = YAML.parse(yaml)
    expect(parsed.domain).toBe('finance')
  })

  it('gera tabela com rows correto', () => {
    const table = makeTable({ rows: 500 })
    const yaml = SchemaWriter.generateYaml('test', [table])
    const parsed = YAML.parse(yaml)
    expect(parsed.tables.users.rows).toBe(500)
  })

  it('inclui dtype na coluna', () => {
    const col = makeColumn({ name: 'email', dtype: 'str' })
    const table = makeTable({ columns: [col] })
    const yaml = SchemaWriter.generateYaml('test', [table])
    const parsed = YAML.parse(yaml)
    expect(parsed.tables.users.columns.email.dtype).toBe('str')
  })

  it('emite primary_key quando isPrimaryKey=true', () => {
    const col = makeColumn({ isPrimaryKey: true })
    const table = makeTable({ columns: [col] })
    const yaml = SchemaWriter.generateYaml('test', [table])
    const parsed = YAML.parse(yaml)
    expect(parsed.tables.users.columns.id.primary_key).toBe(true)
  })

  it('não emite primary_key quando isPrimaryKey=false', () => {
    const col = makeColumn({ isPrimaryKey: false })
    const table = makeTable({ columns: [col] })
    const yaml = SchemaWriter.generateYaml('test', [table])
    const parsed = YAML.parse(yaml)
    expect(parsed.tables.users.columns.id.primary_key).toBeUndefined()
  })

  it('emite faker_provider quando preenchido', () => {
    const col = makeColumn({ name: 'name', fakerProvider: 'name' })
    const table = makeTable({ columns: [col] })
    const yaml = SchemaWriter.generateYaml('test', [table])
    const parsed = YAML.parse(yaml)
    expect(parsed.tables.users.columns.name.faker_provider).toBe('name')
  })

  it('não emite faker_provider quando vazio', () => {
    const col = makeColumn({ fakerProvider: '' })
    const table = makeTable({ columns: [col] })
    const yaml = SchemaWriter.generateYaml('test', [table])
    const parsed = YAML.parse(yaml)
    expect(parsed.tables.users.columns.id.faker_provider).toBeUndefined()
  })

  it('emite nullable quando > 0', () => {
    const col = makeColumn({ nullable: '0.1' })
    const table = makeTable({ columns: [col] })
    const yaml = SchemaWriter.generateYaml('test', [table])
    const parsed = YAML.parse(yaml)
    expect(parsed.tables.users.columns.id.nullable).toBeCloseTo(0.1)
  })

  it('não emite nullable quando = 0', () => {
    const col = makeColumn({ nullable: '0' })
    const table = makeTable({ columns: [col] })
    const yaml = SchemaWriter.generateYaml('test', [table])
    const parsed = YAML.parse(yaml)
    expect(parsed.tables.users.columns.id.nullable).toBeUndefined()
  })

  it('emite foreign_key com table e column', () => {
    const col = makeColumn({ isForeignKey: true, fkTable: 'orders', fkColumn: 'id' })
    const table = makeTable({ columns: [col] })
    const yaml = SchemaWriter.generateYaml('test', [table])
    const parsed = YAML.parse(yaml)
    expect(parsed.tables.users.columns.id.foreign_key).toEqual({ table: 'orders', column: 'id' })
  })

  it('emite min e max numéricos como números', () => {
    const col = makeColumn({ min: '0', max: '100' })
    const table = makeTable({ columns: [col] })
    const yaml = SchemaWriter.generateYaml('test', [table])
    const parsed = YAML.parse(yaml)
    expect(parsed.tables.users.columns.id.min).toBe(0)
    expect(parsed.tables.users.columns.id.max).toBe(100)
  })

  it('emite choices quando preenchido', () => {
    const col = makeColumn({ name: 'status', choices: ['active', 'inactive'] })
    const table = makeTable({ columns: [col] })
    const yaml = SchemaWriter.generateYaml('test', [table])
    const parsed = YAML.parse(yaml)
    expect(parsed.tables.users.columns.status.choices).toEqual(['active', 'inactive'])
  })

  it('gera YAML válido com múltiplas tabelas', () => {
    const t1 = makeTable({ id: '1', name: 'users' })
    const t2 = makeTable({ id: '2', name: 'orders' })
    const yaml = SchemaWriter.generateYaml('ecommerce', [t1, t2])
    const parsed = YAML.parse(yaml)
    expect(Object.keys(parsed.tables)).toEqual(['users', 'orders'])
  })
})

describe('SchemaWriter.downloadYaml', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()

    const mockAnchor = { href: '', download: '', click: vi.fn() }
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
  })

  it('não faz nada se yaml estiver vazio', () => {
    const spy = vi.spyOn(document, 'createElement')
    SchemaWriter.downloadYaml('')
    expect(spy).not.toHaveBeenCalled()
  })

  it('cria um anchor e dispara o click', () => {
    SchemaWriter.downloadYaml('domain: test\n', 'test.yaml')
    expect(document.createElement).toHaveBeenCalledWith('a')
  })
})
