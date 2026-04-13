import { describe, it, expect } from 'vitest'
import { SchemaReader } from './SchemaReader'

const BASIC_YAML = `
domain: ecommerce
tables:
  users:
    rows: 500
    columns:
      id:
        dtype: int
        primary_key: true
      name:
        dtype: str
        faker_provider: name
      email:
        dtype: str
        nullable: "0.05"
  orders:
    rows: 2000
    columns:
      id:
        dtype: int
        primary_key: true
      user_id:
        dtype: int
        foreign_key:
          table: users
          column: id
      total:
        dtype: float
        min: 0
        max: 9999
`

describe('SchemaReader.parseYaml', () => {
  it('lê o domínio corretamente', () => {
    const schema = SchemaReader.parseYaml(BASIC_YAML)
    expect(schema.domain).toBe('ecommerce')
  })

  it('cria a quantidade certa de tabelas', () => {
    const schema = SchemaReader.parseYaml(BASIC_YAML)
    expect(schema.tables).toHaveLength(2)
  })

  it('lê o nome e rows da tabela', () => {
    const schema = SchemaReader.parseYaml(BASIC_YAML)
    const users = schema.tables.find(t => t.name === 'users')
    expect(users).toBeDefined()
    expect(users!.rows).toBe(500)
  })

  it('gera IDs únicos para tabelas', () => {
    const schema = SchemaReader.parseYaml(BASIC_YAML)
    const ids = schema.tables.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('lê colunas corretamente', () => {
    const schema = SchemaReader.parseYaml(BASIC_YAML)
    const users = schema.tables.find(t => t.name === 'users')!
    expect(users.columns).toHaveLength(3)
  })

  it('detecta primary key', () => {
    const schema = SchemaReader.parseYaml(BASIC_YAML)
    const users = schema.tables.find(t => t.name === 'users')!
    const id = users.columns.find(c => c.name === 'id')!
    expect(id.isPrimaryKey).toBe(true)
  })

  it('lê faker_provider', () => {
    const schema = SchemaReader.parseYaml(BASIC_YAML)
    const users = schema.tables.find(t => t.name === 'users')!
    const name = users.columns.find(c => c.name === 'name')!
    expect(name.fakerProvider).toBe('name')
  })

  it('lê nullable como string', () => {
    const schema = SchemaReader.parseYaml(BASIC_YAML)
    const users = schema.tables.find(t => t.name === 'users')!
    const email = users.columns.find(c => c.name === 'email')!
    expect(email.nullable).toBe('0.05')
  })

  it('detecta foreign key', () => {
    const schema = SchemaReader.parseYaml(BASIC_YAML)
    const orders = schema.tables.find(t => t.name === 'orders')!
    const userId = orders.columns.find(c => c.name === 'user_id')!
    expect(userId.isForeignKey).toBe(true)
    expect(userId.fkTable).toBe('users')
    expect(userId.fkColumn).toBe('id')
  })

  it('lê min e max como string', () => {
    const schema = SchemaReader.parseYaml(BASIC_YAML)
    const orders = schema.tables.find(t => t.name === 'orders')!
    const total = orders.columns.find(c => c.name === 'total')!
    expect(total.min).toBe('0')
    expect(total.max).toBe('9999')
  })

  it('usa domínio "custom" quando ausente', () => {
    const schema = SchemaReader.parseYaml('tables:\n  foo:\n    rows: 10\n    columns: {}')
    expect(schema.domain).toBe('custom')
  })

  it('lança erro em YAML inválido', () => {
    expect(() => SchemaReader.parseYaml('{')).toThrow()
  })

  it('retorna schema vazio para YAML que não é objeto (array)', () => {
    // YAML.parse de uma lista retorna array — rawObj não é null nem não-objeto,
    // então parseYaml trata como schema sem tabelas
    const schema = SchemaReader.parseYaml('- item1\n- item2')
    expect(schema.tables).toHaveLength(0)
  })

  it('lança erro com mensagem amigável para chaves duplicadas', () => {
    const duplicateYaml = `
tables:
  users:
    rows: 10
    columns:
      id:
        dtype: int
      id:
        dtype: str
`
    expect(() => SchemaReader.parseYaml(duplicateYaml)).toThrow('chaves duplicadas')
  })

  it('lê choices como array de strings', () => {
    const yaml = `
domain: test
tables:
  status_table:
    rows: 100
    columns:
      status:
        dtype: str
        choices:
          - active
          - inactive
          - pending
`
    const schema = SchemaReader.parseYaml(yaml)
    const col = schema.tables[0].columns.find(c => c.name === 'status')!
    expect(col.choices).toEqual(['active', 'inactive', 'pending'])
  })
})
