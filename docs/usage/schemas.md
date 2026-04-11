# Schemas Customizados

Schemas são arquivos YAML que definem a estrutura das tabelas, colunas, tipos e relacionamentos.

---

## Estrutura básica

```yaml
domain: meu_dominio

tables:
  nome_da_tabela:
    rows: 1000          # quantidade de linhas padrão
    columns:
      nome_da_coluna:
        dtype: uuid     # tipo de dado (ver Tipos de Dados)
        primary_key: true

  outra_tabela:
    rows: 5000
    columns:
      id:
        dtype: uuid
        primary_key: true
      tabela_id:
        dtype: uuid
        foreign_key:
          table: nome_da_tabela
          column: id
      valor:
        dtype: float
        min: 0.01
        max: 9999.99
      status:
        dtype: str
        choices: [ativo, inativo, pendente]
      criado_em:
        dtype: date
        min: "2020-01-01"
        max: "2024-12-31"
      descricao:
        dtype: text
        nullable: 0.3   # 30% de valores nulos
```

---

## Campos de coluna

| Campo | Tipo | Descrição |
|---|---|---|
| `dtype` | string | Tipo de dado (obrigatório) |
| `primary_key` | bool | Marca a coluna como chave primária |
| `foreign_key.table` | string | Tabela referenciada |
| `foreign_key.column` | string | Coluna referenciada |
| `nullable` | float 0–1 | Proporção de valores nulos |
| `min` | number/date | Valor mínimo (para tipos numéricos e date) |
| `max` | number/date | Valor máximo |
| `choices` | list | Enumera os valores possíveis |
| `faker_provider` | string | Qualquer método do Faker (`name`, `iban`, `color_name`…) |

---

## Chaves estrangeiras

A geração respeita ordem topológica — tabelas pai sempre são geradas antes das filhas. Valores de FK são amostrados aleatoriamente do pool de PKs do pai.

```yaml
orders:
  rows: 1000
  columns:
    id:
      dtype: uuid
      primary_key: true
    customer_id:
      dtype: uuid
      foreign_key:
        table: customers
        column: id
```

### Relação auto-referencial

Para hierarquias (ex: funcionário e seu gerente), use FK apontando para a própria tabela:

```yaml
employees:
  rows: 300
  columns:
    id:
      dtype: int_seq
      primary_key: true
    manager_id:
      dtype: int_seq
      nullable: 0.05          # gerentes de topo têm NULL
      foreign_key:
        table: employees
        column: id
```

O gerador trata self-joins especialmente: a primeira linha sempre recebe `NULL`, e as demais amostram de PKs já geradas na mesma tabela.

---

## Faker providers customizados

Qualquer método do objeto `Faker` pode ser usado:

```yaml
columns:
  cpf:
    dtype: str
    faker_provider: cpf          # pt_BR locale
  cor:
    dtype: str
    faker_provider: color_name
  placa:
    dtype: str
    faker_provider: license_plate
```

---

## Exemplo completo: sistema de suporte

```yaml
domain: suporte

tables:
  clientes:
    rows: 500
    columns:
      id:
        dtype: uuid
        primary_key: true
      nome:
        dtype: name
      email:
        dtype: email
      plano:
        dtype: str
        choices: [basico, pro, enterprise]
      criado_em:
        dtype: date
        min: "2021-01-01"
        max: "2024-01-01"

  tickets:
    rows: 2000
    columns:
      id:
        dtype: int_seq
        primary_key: true
      cliente_id:
        dtype: uuid
        foreign_key:
          table: clientes
          column: id
      titulo:
        dtype: text
      status:
        dtype: str
        choices: [aberto, em_andamento, resolvido, fechado]
      prioridade:
        dtype: str
        choices: [baixa, media, alta, critica]
      criado_em:
        dtype: date
        min: "2021-01-01"
        max: "2024-12-31"
      resolvido_em:
        dtype: date
        nullable: 0.4
        min: "2021-01-01"
        max: "2025-01-01"
      satisfacao:
        dtype: int
        nullable: 0.5
        min: 1
        max: 5
```

---

## Usando o schema

Salve o arquivo em `src/dataforge/schemas/` e use `-d custom -c` para referenciar o caminho dentro do container:

```bash
# Via Docker
docker compose run --rm cli generate \
  -d custom -c /app/src/dataforge/schemas/suporte.yaml \
  -f parquet \
  -o /app/output

# Via CLI local
dataset-gen generate -d custom -c ./src/dataforge/schemas/suporte.yaml -f csv
```
