# CLI — Referência Completa

O comando principal é `dataset-gen`. Com Docker:

```bash
docker compose run --rm cli [COMANDO] [OPÇÕES]
```

---

## Comandos disponíveis

| Comando | Descrição |
|---|---|
| `generate` | Gera um dataset sintético |
| `list-domains` | Lista os schemas YAML disponíveis em `schemas/` |
| `schema-info <dominio>` | Exibe tabelas, colunas e FKs de um domínio |

---

## `generate`

Gera um dataset sintético e opcionalmente escreve em arquivo, nuvem ou banco SQL.

```bash
dataset-gen generate [OPÇÕES]
```

### Fonte do schema

| Flag | Atalho | Padrão | Descrição |
|---|---|---|---|
| `--domain` | `-d` | — | Domínio: `ecommerce`, `hr`, `finance` ou `custom` **(obrigatório)** |
| `--config` | `-c` | — | Caminho para YAML. Obrigatório quando `--domain custom`. Pode ser combinado com domínio pré-definido para sobrescrever campos. |

!!! note "Combinando domínio e YAML"
    `--domain ecommerce --config override.yaml` carrega o schema de e-commerce e aplica as sobreposições definidas no YAML (por exemplo, alterar apenas `rows` de algumas tabelas).

---

### Controle de geração

| Flag | Atalho | Padrão | Descrição |
|---|---|---|---|
| `--rows` | `-r` | por tabela | Número de linhas por tabela (sobreescreve o padrão do domínio para todas as tabelas) |
| `--tables` | `-t` | todas | Tabela a incluir. Repetível: `-t customers -t orders` |
| `--columns` | — | todas | Filtro de colunas no formato `tabela:col1,col2`. Repetível. |

!!! warning "`--rows` aplica a todas as tabelas"
    `--rows 500` define 500 linhas em todas as tabelas do schema. Para controlar por tabela individualmente, use um YAML customizado ou o campo `rows` em um schema de override.

---

### Formato de saída

| Flag | Atalho | Padrão | Descrição |
|---|---|---|---|
| `--format` | `-f` | `csv` | Formato: `csv`, `json`, `parquet`, `avro`. Repetível. |
| `--json-mode` | — | `flat` | Modo JSON: `flat` (NDJSON) ou `nested` (objetos aninhados) |
| `--output` | `-o` | `./output` | Diretório de saída |

---

### Reprodutibilidade

| Flag | Atalho | Padrão | Descrição |
|---|---|---|---|
| `--seed` | — | — | Seed para o Faker. Garante resultados idênticos em execuções repetidas. |

---

### Upload para nuvem

| Flag | Atalho | Padrão | Descrição |
|---|---|---|---|
| `--upload` | — | — | Destino de upload: `gcs`, `s3` ou `azure` |
| `--bucket` | — | — | Nome do bucket ou container de destino |
| `--prefix` | — | `datasets/` | Prefixo (pasta) dentro do bucket |
| `--credentials` | — | — | Caminho para arquivo de credenciais dentro do container |

Veja [Upload para Nuvem](../advanced/cloud-upload.md) para configuração de credenciais.

---

### Carga em banco SQL

| Flag | Atalho | Padrão | Descrição |
|---|---|---|---|
| `--db-url` | — | — | Connection string SQLAlchemy |
| `--db-schema` | — | — | Schema do banco de destino (namespace) |
| `--if-exists` | — | `replace` | Comportamento se tabela existir: `replace`, `append` ou `fail` |

Veja [Carga em Banco SQL](../advanced/sql-loading.md).

---

### Particionamento

| Flag | Atalho | Padrão | Descrição |
|---|---|---|---|
| `--partition-by` | — | — | Coluna para particionamento Hive-style: `coluna` (todas as tabelas) ou `tabela:coluna` (tabela específica). Repetível. |

Veja [Particionamento](../advanced/partitioning.md).

---

### Modo Recorrente

| Flag | Atalho | Padrão | Descrição |
|---|---|---|---|
| `--recurrence` | `-R` | — | Intervalo **em segundos** entre batches. Ativa o modo recorrente (Ctrl+C para parar). |
| `--count` | — | `0` | Número de batches a gerar. `0` = infinito. |
| `--increment` | — | — | Deslocar coluna por batch. Formato: `tabela:coluna:passo[:unidade]`. Repetível. |

**Unidades para `--increment`:** `days` (padrão), `hours`, `weeks`, `months`, `years`, `value` (numérico)

Veja [Modo Recorrente](../advanced/recurrence.md).

---

## `list-domains`

Lista os arquivos YAML disponíveis em `src/dataforge/schemas/`.

```bash
docker compose run --rm cli list-domains
```

Saída esperada:

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

---

## `schema-info`

Exibe a estrutura de tabelas, colunas e chaves estrangeiras de um domínio pré-definido.

```bash
docker compose run --rm cli schema-info <dominio>
```

`<dominio>` é um argumento posicional. Valores válidos: `ecommerce`, `hr`, `finance`.

Exemplo:

```bash
docker compose run --rm cli schema-info ecommerce
```

Saída esperada:

```
Domain: ecommerce

  Table: categories  (default rows: 20)
    id: int_seq  [PK]
    name: str
    description: text  [nullable=0.2]

  Table: products  (default rows: 200)
    id: int_seq  [PK]
    name: str
    price: float
    stock_quantity: int
    category_id: int  [FK->categories.id]
  ...
```

---

## Exemplos práticos

```bash
# Dataset completo de ecommerce em CSV (padrão)
docker compose run --rm cli generate -d ecommerce

# 500 linhas por tabela em Parquet
docker compose run --rm cli generate -d ecommerce -r 500 -f parquet

# Apenas duas tabelas em JSON
docker compose run --rm cli generate -d hr -t employees -t departments -f json

# Filtrar colunas específicas
docker compose run --rm cli generate -d ecommerce \
  --columns customers:id,name,email \
  --columns orders:id,customer_id,status \
  -f csv

# Schema YAML customizado
docker compose run --rm cli generate \
  -d custom -c /app/src/dataforge/schemas/crm.yaml -f csv

# Override de domínio pré-definido via YAML
docker compose run --rm cli generate \
  -d ecommerce -c /app/src/dataforge/schemas/ecommerce.yaml -f parquet

# Upload para GCS
docker compose run --rm cli generate -d ecommerce -f parquet \
  --upload gcs \
  --bucket meu-datalake \
  --prefix raw/ecommerce/ \
  --credentials /app/credentials/service-account.json

# Upload para S3
docker compose run --rm \
  -e AWS_ACCESS_KEY_ID=AKIA... \
  -e AWS_SECRET_ACCESS_KEY=... \
  cli generate -d hr -f parquet \
  --upload s3 \
  --bucket meu-bucket \
  --prefix raw/hr/

# Carga no PostgreSQL
docker compose run --rm cli generate -d ecommerce -r 1000 \
  --db-url "postgresql+psycopg2://user:pass@host:5432/db" \
  --if-exists replace

# Carga no SQLite
docker compose run --rm cli generate -d finance \
  --db-url sqlite:////app/output/finance.db

# Schema específico no banco
docker compose run --rm cli generate -d hr \
  --db-url "postgresql+psycopg2://user:pass@host/db" \
  --db-schema staging

# Modo recorrente: batch a cada 30 segundos, infinito
docker compose run --rm cli generate -d ecommerce -f json -R 30

# Modo recorrente: 10 batches com intervalo de 60 segundos
docker compose run --rm cli generate -d ecommerce -f parquet -R 60 --count 10

# Incremento de data por batch (simula dados de semanas consecutivas)
docker compose run --rm cli generate -d finance -f parquet \
  -R 0 --count 10 \
  --increment transactions:transacted_at:7:days

# Incremento numérico por batch
docker compose run --rm cli generate -d ecommerce -f csv \
  -R 5 --count 5 \
  --increment orders:total_amount:100:value

# Particionamento Hive-style
docker compose run --rm cli generate -d ecommerce -f parquet \
  --partition-by ordered_at

# Particionamento por tabela específica
docker compose run --rm cli generate -d ecommerce -f parquet \
  --partition-by "orders:status" \
  --partition-by "customers:country"

# Reprodutibilidade com seed
docker compose run --rm cli generate -d finance --seed 42 -f csv
```
