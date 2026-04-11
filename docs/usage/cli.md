# CLI — Referência Completa

O comando principal é `dataset-gen`. Com Docker:

```bash
docker compose run --rm cli [COMANDO] [OPÇÕES]
```

---

## Comandos

### `generate`

Gera um dataset sintético.

```bash
dataset-gen generate [OPÇÕES]
```

#### Fonte do schema

| Flag | Descrição | Exemplo |
|---|---|---|
| `-d, --domain` | Domínio pré-definido | `-d ecommerce` |
| `-c, --config` | Arquivo YAML customizado | `-c /app/schemas/meu.yaml` |

!!! warning
    `-d` e `-c` são mutuamente exclusivos. Use um ou outro.

---

#### Controle de linhas

| Flag | Descrição | Exemplo |
|---|---|---|
| `-r, --rows` | Sobrescreve a quantidade de linhas. Pode ser `N` (todas as tabelas) ou `tabela=N` (tabela específica). Repetível. | `-r 1000` ou `-r orders=5000 -r customers=2000` |

---

#### Filtros

| Flag | Descrição | Exemplo |
|---|---|---|
| `-t, --table` | Gerar apenas esta(s) tabela(s). Repetível. | `-t customers -t orders` |
| `--columns` | Selecionar colunas específicas no formato `tabela:col1,col2`. Repetível. | `--columns customers:id,name,email` |

---

#### Formato de saída

| Flag | Descrição | Padrão |
|---|---|---|
| `-f, --format` | Formato de saída: `csv`, `json`, `parquet`, `avro` | `csv` |
| `--json-mode` | Modo JSON: `flat` (NDJSON) ou `nested` (objetos aninhados) | `flat` |
| `-o, --output-dir` | Diretório de saída | `./output` |

---

#### Reprodutibilidade

| Flag | Descrição | Exemplo |
|---|---|---|
| `--seed` | Seed para Faker — garante resultados idênticos em execuções repetidas | `--seed 42` |

---

#### Upload para nuvem

| Flag | Descrição | Exemplo |
|---|---|---|
| `--gcs-bucket` | Nome do bucket GCS | `--gcs-bucket meu-bucket` |
| `--gcs-prefix` | Prefixo de pasta no bucket | `--gcs-prefix dados/raw` |
| `--s3-bucket` | Nome do bucket S3 | `--s3-bucket meu-bucket` |
| `--s3-prefix` | Prefixo S3 | `--s3-prefix dados/raw` |
| `--azure-container` | Container Azure Blob | `--azure-container meu-container` |
| `--azure-prefix` | Prefixo Azure | `--azure-prefix dados/raw` |

Veja [Upload para Nuvem](../advanced/cloud-upload.md) para configuração de credenciais.

---

#### Carga em banco SQL

| Flag | Descrição | Exemplo |
|---|---|---|
| `--db-url` | Connection string SQLAlchemy | `--db-url postgresql+psycopg2://user:pass@host/db` |
| `--db-schema` | Schema do banco (namespace) | `--db-schema staging` |
| `--if-exists` | Comportamento se tabela existir: `fail`, `replace`, `append` | `--if-exists replace` |

Veja [Carga em Banco SQL](../advanced/sql-loading.md).

---

#### Particionamento

| Flag | Descrição | Exemplo |
|---|---|---|
| `--partition-by` | Coluna para particionamento Hive-style | `--partition-by created_at` |

Saída: `output/dominio/tabela/created_at=2024-01-15/tabela.csv`

Veja [Particionamento](../advanced/partitioning.md).

---

#### Modo Recorrente

| Flag | Descrição | Exemplo |
|---|---|---|
| `-R, --recurrence` | Gerar N batches em loop | `-R 10` |
| `--interval` | Intervalo em segundos entre batches | `--interval 60` |
| `--increment` | Incremento de coluna por batch no formato `tabela:coluna:passo`. Repetível. | `--increment orders:id:1000` |

Veja [Modo Recorrente](../advanced/recurrence.md).

---

### `list-domains`

Lista os domínios pré-definidos disponíveis.

```bash
dataset-gen list-domains
```

---

### `schema-info`

Exibe a estrutura de tabelas, colunas e chaves estrangeiras de um domínio.

```bash
dataset-gen schema-info -d ecommerce
dataset-gen schema-info -c /app/schemas/meu.yaml
```

---

## Exemplos

```bash
# Dataset completo de ecommerce em Parquet
dataset-gen generate -d ecommerce -f parquet

# 10k clientes com seed fixo
dataset-gen generate -d ecommerce -t customers -r 10000 --seed 42 -f csv

# Schema customizado → JSON aninhado
dataset-gen generate -c /app/schemas/crm.yaml -f json --json-mode nested

# Upload direto para GCS
dataset-gen generate -d ecommerce -f parquet \
  --gcs-bucket meu-datalake --gcs-prefix raw/ecommerce

# Carga no PostgreSQL sobrescrevendo tabelas
dataset-gen generate -d hr -f csv \
  --db-url "postgresql+psycopg2://admin:senha@localhost/dwh" \
  --if-exists replace

# 24 batches horários com IDs incrementais
dataset-gen generate -d ecommerce -t orders \
  -R 24 --interval 3600 \
  --increment orders:id:1000
```
