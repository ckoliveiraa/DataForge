# Dataforge

Ferramenta CLI em Python para geração de datasets sintéticos **relacionais** destinados a estudos e aplicações de engenharia de dados. Suporta múltiplos formatos de saída, upload em nuvem e carga direta em bancos SQL.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Instalação](#instalação)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Domínios Disponíveis](#domínios-disponíveis)
- [Formatos de Saída](#formatos-de-saída)
- [Upload em Nuvem](#upload-em-nuvem)
- [Carga em Banco SQL](#carga-em-banco-sql)
- [Uso do CLI](#uso-do-cli)
- [Schema YAML Customizado](#schema-yaml-customizado)
- [Reprodutibilidade](#reprodutibilidade)
- [Integridade Referencial](#integridade-referencial)

---

## Visão Geral

O **Dataforge** cria conjuntos de dados com integridade referencial garantida — chaves estrangeiras (FKs) sempre apontam para valores que existem na tabela pai. É ideal para:

- Testar pipelines de ingestão (GCS → BigQuery, S3 → Redshift, etc.)
- Desenvolver e validar modelos dbt
- Popular bancos de dados de desenvolvimento e homologação
- Estudar formatos de armazenamento (CSV, JSON, Parquet, Avro)
- Simular cargas de trabalho de engenharia de dados sem dados sensíveis

---

## Instalação

```bash
git clone <repo-url>
cd Dataforge

# Apenas saída local (CSV/JSON)
poetry install

# Com extras específicos
poetry install -E gcp      # Google Cloud Storage
poetry install -E aws      # Amazon S3
poetry install -E azure    # Azure Blob Storage
poetry install -E parquet  # Parquet (PyArrow)
poetry install -E avro     # Avro (fastavro)
poetry install -E sql      # Bancos SQL (SQLAlchemy)
poetry install -E postgres # PostgreSQL
poetry install -E mysql    # MySQL
```

### Dependências por funcionalidade

| Extra | Pacotes instalados | Uso |
|-------|--------------------|-----|
| *(base)* | `click`, `faker`, `pandas`, `pyyaml` | CSV e JSON local |
| `gcp` | `google-cloud-storage` | Upload para GCS |
| `aws` | `boto3` | Upload para S3 |
| `azure` | `azure-storage-blob` | Upload para Azure Blob |
| `parquet` | `pyarrow` | Formato Parquet |
| `avro` | `fastavro` | Formato Avro |
| `sql` | `sqlalchemy` | SQLite, e qualquer banco via driver |
| `postgres` | `sqlalchemy`, `psycopg2-binary` | PostgreSQL |
| `mysql` | `sqlalchemy`, `pymysql` | MySQL / MariaDB |
| `mssql` | `sqlalchemy`, `pyodbc` | SQL Server |

---

## Estrutura do Projeto

```
Dataforge/
├── src/dataforge/
│   ├── cli.py                      # Entrypoint: comando dataset-gen
│   ├── core/
│   │   ├── schema.py               # Dataclasses: Column, ForeignKey, Table, DomainSchema
│   │   ├── generator.py            # Ordenação topológica + geração com FK íntegra
│   │   └── registry.py             # Mapeamento dtype -> callable Faker
│   ├── domains/
│   │   ├── base.py                 # Classe abstrata DomainTemplate
│   │   ├── ecommerce.py            # Domínio e-commerce (5 tabelas)
│   │   ├── hr.py                   # Domínio RH (4 tabelas)
│   │   └── finance.py              # Domínio financeiro (4 tabelas)
│   ├── writers/
│   │   ├── base.py                 # Classe abstrata BaseWriter
│   │   ├── csv_writer.py
│   │   ├── json_writer.py          # Modos: flat (NDJSON) e nested
│   │   ├── parquet_writer.py       # PyArrow, compressão Snappy
│   │   └── avro_writer.py          # fastavro, schema inferido do DataFrame
│   ├── uploaders/
│   │   ├── base.py                 # Classe abstrata BaseUploader
│   │   ├── gcs_uploader.py         # Google Cloud Storage
│   │   ├── s3_uploader.py          # Amazon S3
│   │   └── azure_uploader.py       # Azure Blob Storage
│   ├── loaders/
│   │   └── sql_loader.py           # SQLAlchemy: df.to_sql() para qualquer banco
│   └── config/
│       └── loader.py               # Carrega YAML + merge com domínio base + validação FK
├── schemas/
│   ├── ecommerce.yaml              # Override do domínio ecommerce
│   ├── hr.yaml                     # Override do domínio hr
│   └── custom_example.yaml         # Template para domínio 100% customizado
├── schema_builder.py               # Gerador interativo de schemas YAML
├── output/                         # Pasta padrão de saída (gitignored)
└── pyproject.toml
```

---

## Domínios Disponíveis

### E-commerce (`--domain ecommerce`)

| Tabela | Colunas principais | FK para |
|--------|--------------------|---------|
| `categories` | id, name, description | — |
| `customers` | id, name, email, phone, city, country, created_at | — |
| `products` | id, name, price, stock_quantity, category_id | `categories.id` |
| `orders` | id, customer_id, status, total_amount, ordered_at | `customers.id` |
| `order_items` | id, order_id, product_id, quantity, unit_price | `orders.id`, `products.id` |

### RH (`--domain hr`)

| Tabela | Colunas principais | FK para |
|--------|--------------------|---------|
| `departments` | id, name, location | — |
| `job_titles` | id, title, level | — |
| `employees` | id, name, email, hire_date, department_id, job_title_id, manager_id | `departments.id`, `job_titles.id`, `employees.id` |
| `salaries` | id, employee_id, amount, currency, effective_date | `employees.id` |

### Financeiro (`--domain finance`)

| Tabela | Colunas principais | FK para |
|--------|--------------------|---------|
| `customers` | id, name, email, country, created_at | — |
| `categories` | id, name, type | — |
| `accounts` | id, customer_id, iban, currency, balance, opened_at | `customers.id` |
| `transactions` | id, account_id, category_id, amount, type, description, transacted_at | `accounts.id`, `categories.id` |

---

## Formatos de Saída

| Flag | Formato | Dependência |
|------|---------|-------------|
| `--format csv` | CSV — UTF-8, sem índice | *(base)* |
| `--format json` | JSON — NDJSON ou nested | *(base)* |
| `--format parquet` | Parquet — compressão Snappy | `poetry install -E parquet` |
| `--format avro` | Avro — schema inferido automaticamente | `poetry install -E avro` |

Múltiplos formatos podem ser combinados na mesma execução:

```bash
dataset-gen generate -d ecommerce -f csv -f json -f parquet -f avro
```

### Layout de saída

```
output/
├── csv/
├── json/
├── parquet/
└── avro/
```

### Modos JSON

**Flat (padrão)** — uma linha por registro (NDJSON), compatível com BigQuery:
```json
{"id": 1, "customer_id": 42, "total_amount": 189.90, "ordered_at": "2024-03-15"}
{"id": 2, "customer_id": 17, "total_amount": 55.00, "ordered_at": "2024-03-16"}
```

**Nested** — filhos aninhados dentro dos pais, ideal para BigQuery com `RECORD/REPEATED`:
```json
{
  "id": 42,
  "name": "Ana Lima",
  "orders": [
    {"id": 1, "total_amount": 189.90, "order_items": [{"product_id": 5, "quantity": 2}]}
  ]
}
```

---

## Upload em Nuvem

### Google Cloud Storage

```bash
# Autenticação
gcloud auth application-default login
# ou
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# Upload
dataset-gen generate -d ecommerce -f parquet \
  --upload gcs --bucket meu-bucket --prefix raw/ecommerce/
# Resultado: gs://meu-bucket/raw/ecommerce/customers.parquet
```

### Amazon S3

```bash
# Autenticação via ~/.aws/credentials ou variáveis de ambiente
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."

# Upload
dataset-gen generate -d hr -f csv \
  --upload s3 --bucket meu-bucket --prefix data/hr/
# Resultado: s3://meu-bucket/data/hr/employees.csv
```

### Azure Blob Storage

```bash
# Autenticação via connection string
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;..."

# Upload
dataset-gen generate -d finance -f parquet \
  --upload azure --bucket meu-container --prefix datasets/finance/
# Resultado: az://meu-container/datasets/finance/transactions.parquet
```

> Os arquivos gerados são **mantidos localmente** após o upload.

---

## Carga em Banco SQL

Use `--db-url` com uma connection string SQLAlchemy para carregar os dados diretamente em um banco.

### Bancos suportados

| Banco | URL de exemplo | Driver |
|-------|---------------|--------|
| SQLite | `sqlite:///output/dados.db` | *(sem extra)* |
| PostgreSQL | `postgresql+psycopg2://user:pass@host:5432/db` | `poetry install -E postgres` |
| MySQL | `mysql+pymysql://user:pass@host:3306/db` | `poetry install -E mysql` |
| SQL Server | `mssql+pyodbc://user:pass@host/db?driver=ODBC+Driver+17+for+SQL+Server` | `poetry install -E mssql` |

### Exemplos

```bash
# SQLite — sem dependências extras
dataset-gen generate -d ecommerce -r 500 \
  --db-url sqlite:///output/ecommerce.db

# PostgreSQL
dataset-gen generate -d hr -r 1000 \
  --db-url "postgresql+psycopg2://user:pass@localhost:5432/mydb"

# MySQL
dataset-gen generate -d finance \
  --db-url "mysql+pymysql://user:pass@localhost:3306/mydb"

# Append em vez de substituir a tabela
dataset-gen generate -d finance \
  --db-url sqlite:///finance.db --if-exists append

# Schema específico (PostgreSQL)
dataset-gen generate -d hr \
  --db-url "postgresql+psycopg2://user:pass@host/db" \
  --db-schema staging

# Combinar arquivo + SQL na mesma execução
dataset-gen generate -d ecommerce -f csv -f parquet \
  --db-url sqlite:///output/ecommerce.db
```

### Flags SQL

| Flag | Default | Descrição |
|------|---------|-----------|
| `--db-url` | — | Connection string SQLAlchemy |
| `--if-exists` | `replace` | O que fazer se a tabela existir: `replace`, `append` ou `fail` |
| `--db-schema` | — | Schema do banco onde as tabelas serão criadas |

---

## Uso do CLI

### Referência completa — `dataset-gen generate`

| Flag | Atalho | Default | Descrição |
|------|--------|---------|-----------|
| `--domain` | `-d` | — | Domínio: `ecommerce`, `hr`, `finance`, `custom` |
| `--config` | `-c` | — | Caminho para YAML (obrigatório se `--domain custom`) |
| `--rows` | `-r` | por tabela | Número de linhas por tabela |
| `--tables` | `-t` | todas | Tabelas a incluir (repetível) |
| `--columns` | | todas | `"tabela:col1,col2"` — filtro de colunas (repetível) |
| `--format` | `-f` | `csv` | `csv`, `json`, `parquet` ou `avro` (repetível) |
| `--output` | `-o` | `./output` | Diretório de saída local |
| `--json-mode` | | `flat` | Modo JSON: `flat` ou `nested` |
| `--seed` | | — | Seed para geração reproduzível |
| `--upload` | | — | `gcs`, `s3` ou `azure` |
| `--bucket` | | — | Nome do bucket/container de destino |
| `--prefix` | | `datasets/` | Prefixo/pasta dentro do bucket |
| `--credentials` | | — | Caminho para arquivo de credenciais de nuvem |
| `--db-url` | | — | Connection string SQLAlchemy para carga SQL |
| `--if-exists` | | `replace` | `replace`, `append` ou `fail` |
| `--db-schema` | | — | Schema do banco de destino |

### Exemplos

```bash
# Utilitários
dataset-gen list-domains
dataset-gen schema-info ecommerce

# Geração básica
dataset-gen generate -d ecommerce
dataset-gen generate -d ecommerce -r 500 -f csv -f json -o ./data

# Filtros
dataset-gen generate -d ecommerce -t customers -t orders -f csv
dataset-gen generate -d ecommerce \
  --columns "customers:id,email,country" \
  --columns "orders:id,customer_id,total_amount" -f csv

# Formatos
dataset-gen generate -d hr -f parquet
dataset-gen generate -d finance -f avro -r 5000
dataset-gen generate -d ecommerce -f json --json-mode nested -r 200

# Domínio customizado
dataset-gen generate -d custom -c ./schemas/custom_example.yaml -f csv -f parquet

# Upload em nuvem
dataset-gen generate -d finance -f parquet \
  --upload gcs --bucket meu-bucket --prefix raw/finance/

# Carga SQL
dataset-gen generate -d ecommerce -r 500 \
  --db-url sqlite:///output/ecommerce.db

# Tudo junto: arquivo + nuvem + SQL
dataset-gen generate -d hr -r 1000 -f csv -f parquet \
  --upload gcs --bucket meu-bucket --prefix hr/ \
  --db-url "postgresql+psycopg2://user:pass@localhost/db"

# Reprodutibilidade
dataset-gen generate -d finance --seed 42 -f csv
```

---

## Schema YAML Customizado

Use `--domain custom --config seu_schema.yaml` para definir qualquer modelo relacional, ou `--domain ecommerce --config override.yaml` para ajustar apenas partes de um domínio existente.

Para criar um schema interativamente:

```bash
python schema_builder.py
```

### Tipos de dados disponíveis (`dtype`)

| dtype | Descrição |
|-------|-----------|
| `int_seq` | Inteiro sequencial (1, 2, 3...) — ideal para PKs |
| `uuid` | UUID v4 — PK como string |
| `int` | Inteiro aleatório |
| `float` | Float aleatório |
| `str` | Palavra genérica |
| `bool` | Booleano |
| `date` | Data (últimos 3 anos) |
| `email` | Endereço de e-mail |
| `name` | Nome completo |
| `phone` | Número de telefone |
| `address` | Endereço completo |
| `city` | Cidade |
| `country` | País |
| `company` | Nome de empresa |
| `text` | Frase/sentença |
| `url` | URL |
| `currency` | Código de moeda (ex: BRL, USD) |
| `iban` | IBAN bancário |

Qualquer provider do Faker pode ser usado via `faker_provider: nome_do_provider`.

### Exemplo — domínio customizado

```yaml
domain: custom

tables:
  authors:
    rows: 50
    columns:
      id:
        dtype: int_seq
        primary_key: true
      name:
        dtype: name
      email:
        dtype: email
      country:
        dtype: country

  books:
    rows: 200
    columns:
      id:
        dtype: int_seq
        primary_key: true
      title:
        dtype: str
      price:
        dtype: float
      published_at:
        dtype: date
      author_id:
        dtype: int
        foreign_key:
          table: authors
          column: id
```

### Override de domínio existente

```yaml
domain: ecommerce

tables:
  customers:
    rows: 200
  orders:
    rows: 500
  order_items:
    rows: 1500
# Tabelas não listadas usam os defaults do domínio
```

---

## Reprodutibilidade

Use `--seed <número>` para gerar o mesmo dataset em execuções diferentes:

```bash
dataset-gen generate -d finance --seed 42 -f csv -o ./run1
dataset-gen generate -d finance --seed 42 -f csv -o ./run2

diff run1/csv/transactions.csv run2/csv/transactions.csv  # sem diferenças
```

---

## Integridade Referencial

O gerador garante que todas as FKs são válidas através de um pipeline em dois passos:

1. **Ordenação topológica** (algoritmo de Kahn) — tabelas pai são sempre geradas antes dos filhos
2. **Pool de PKs** — após gerar cada tabela, seus PKs ficam disponíveis; colunas FK amostram desse pool via `random.choices` (com reposição, permitindo múltiplos filhos por pai)

Caso especial: FKs auto-referenciadas (ex: `employees.manager_id -> employees.id`) são preenchidas após a geração da própria tabela, garantindo que o pool já exista.
