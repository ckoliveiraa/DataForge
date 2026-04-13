# CLI — Referência Completa

O CLI do Dataforge é o comando `dataset-gen`. Via Docker, ele é acessado com `docker compose run --rm cli`.

## Comandos disponíveis

| Comando | Descrição |
|---------|-----------|
| `generate` | Gera datasets sintéticos |
| `list-domains` | Lista os schemas YAML disponíveis em `src/dataforge/schemas/` |
| `schema-info <domain>` | Exibe tabelas, colunas e FKs de um domínio |

## `generate`

Gera datasets e opcionalmente escreve em arquivos, faz upload para nuvem ou carrega em banco SQL.

### Flags

| Flag | Atalho | Padrão | Tipo | Descrição |
|------|--------|--------|------|-----------|
| `--domain` | `-d` | — | string | Domínio: `ecommerce`, `hr`, `finance` ou `custom` |
| `--config` | `-c` | — | path | Caminho para YAML (obrigatório quando `--domain custom`) |
| `--rows` | `-r` | por tabela | int | Número de linhas por tabela (sobrescreve o padrão do domínio) |
| `--tables` | `-t` | todas | string | Tabelas a incluir (repetível) |
| `--columns` | | todas | string | `"tabela:col1,col2"` — filtro de colunas por tabela (repetível) |
| `--format` | `-f` | `csv` | choice | Formato de saída: `csv`, `json`, `parquet` ou `avro` (repetível) |
| `--output` | `-o` | `./output` | path | Diretório de saída dentro do container |
| `--json-mode` | | `flat` | choice | Modo JSON: `flat` (NDJSON) ou `nested` |
| `--seed` | | — | int | Seed para geração reproduzível |
| `--partition-by` | | — | string | Particionamento Hive-style: `coluna` ou `tabela:coluna` (repetível) |
| `--upload` | | — | choice | Destino de upload: `gcs`, `s3` ou `azure` |
| `--bucket` | | — | string | Nome do bucket/container de destino |
| `--prefix` | | `datasets/` | string | Prefixo/pasta dentro do bucket |
| `--credentials` | | — | path | Caminho para arquivo de credenciais (dentro do container) |
| `--db-url` | | — | string | Connection string SQLAlchemy para carga SQL |
| `--if-exists` | | `replace` | choice | O que fazer se a tabela SQL já existir: `replace`, `append` ou `fail` |
| `--db-schema` | | — | string | Schema do banco de destino |
| `--partition-date-granularity` | | — | string | Trunca valores de data nas partições: `granularidade` ou `tabela:granularidade`. Opções: `year` (→ YYYY) ou `month` (→ YYYY-MM) (repetível) |
| `--recurrence` | `-R` | — | float | Intervalo em segundos entre batches (modo contínuo) |
| `--count` | | `0` | int | Número de batches no modo recorrente (`0` = infinito) |
| `--increment` | | — | string | Desloca valores de coluna a cada batch: `tabela:coluna:passo[:unidade]` (repetível) |
| `--workers` | | `16` | int | Máximo de threads paralelas para escrita particionada |

### Unidades para `--increment`

| Unidade | Descrição |
|---------|-----------|
| `days` | Dias (padrão) |
| `hours` | Horas |
| `weeks` | Semanas |
| `months` | Meses (aproximado: 30,44 dias) |
| `years` | Anos (aproximado: 365,25 dias) |
| `value` | Valor numérico puro |

## `list-domains`

Lista os arquivos `.yaml` disponíveis em `src/dataforge/schemas/`:

```bash
docker compose run --rm cli list-domains
```

Saída de exemplo:

```
  acoes
  crm
  ecommerce
  estoque
  finance
  frota
  manutencao
  rh
```

## `schema-info`

Exibe a estrutura de um domínio com tabelas, colunas, tipos e FKs:

```bash
docker compose run --rm cli schema-info ecommerce
```

Saída de exemplo:

```
Domain: ecommerce

  Table: categories  (default rows: 20)
    id: int_seq  [PK]
    name: str

  Table: customers  (default rows: 500)
    id: int_seq  [PK]
    name: name
    email: email
    ...

  Table: products  (default rows: 200)
    id: int_seq  [PK]
    category_id: int  [FK->categories.id]
    ...
```
