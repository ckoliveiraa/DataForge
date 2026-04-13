import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TableNode from './TableNode'
import type { Column } from '../types/schema'

// reactflow usa web APIs não disponíveis no jsdom
vi.mock('reactflow', () => ({
  Handle: ({ type }: { type: string }) => <div data-testid={`handle-${type}`} />,
  Position: { Left: 'left', Right: 'right' },
}))

// mock react-i18next — retorna a chave como valor
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const makeColumn = (overrides: Partial<Column> = {}): Column => ({
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

const renderNode = (data: object, selected = false) =>
  render(<TableNode data={data} selected={selected} />)

describe('TableNode', () => {
  it('exibe o nome da tabela', () => {
    renderNode({ name: 'users', rows: 1000, columns: [] })
    expect(screen.getByText('users')).toBeInTheDocument()
  })

  it('exibe a quantidade de rows', () => {
    renderNode({ name: 'orders', rows: 500, columns: [] })
    expect(screen.getByText('500 common.rows')).toBeInTheDocument()
  })

  it('exibe "No columns" quando não há colunas', () => {
    renderNode({ name: 'empty', rows: 100, columns: [] })
    expect(screen.getByText('schema.noColumns')).toBeInTheDocument()
  })

  it('exibe as colunas com nome e dtype', () => {
    const cols = [
      makeColumn({ name: 'id', dtype: 'int' }),
      makeColumn({ id: 'col-2', name: 'email', dtype: 'str' }),
    ]
    renderNode({ name: 'users', rows: 100, columns: cols })
    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByText('int')).toBeInTheDocument()
    expect(screen.getByText('str')).toBeInTheDocument()
  })

  it('exibe chave i18n quando name está ausente', () => {
    renderNode({ name: '', rows: 0, columns: [] })
    expect(screen.getByText('schema.untitled')).toBeInTheDocument()
  })

  it('renderiza handles de source e target', () => {
    renderNode({ name: 'x', rows: 0, columns: [] })
    expect(screen.getByTestId('handle-target')).toBeInTheDocument()
    expect(screen.getByTestId('handle-source')).toBeInTheDocument()
  })

  it('aplica borda ciano quando selected=true', () => {
    const { container } = renderNode({ name: 'x', rows: 0, columns: [] }, true)
    const node = container.firstChild as HTMLElement
    expect(node.style.borderColor).toContain('rgba(34, 211, 238')
  })
})
