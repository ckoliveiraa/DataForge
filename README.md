# Dataforge

Ferramenta para geração de datasets sintéticos **relacionais** com integridade referencial garantida. Disponível via interface visual no navegador e via linha de comando (CLI). Ideal para testar pipelines de dados, popular bancos de desenvolvimento e criar fixtures para modelos dbt — sem usar dados sensíveis.

---

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [Instalação e início rápido](#instalação-e-início-rápido)
- [Interface Visual](#interface-visual)
- [Usando o CLI via Docker](#usando-o-cli-via-docker)
- [Domínios prontos](#domínios-prontos)
- [Schema YAML customizado](#schema-yaml-customizado)
- [Tipos de dados disponíveis](#tipos-de-dados-disponíveis-dtype)
- [Formatos de saída](#formatos-de-saída)
- [Upload em nuvem](#upload-em-nuvem)
- [Carga em banco SQL](#carga-em-banco-sql)
- [Reprodutibilidade](#reprodutibilidade)
- [Integridade Referencial](#integridade-referencial)
- [Instalação alternativa sem Docker](#instalação-alternativa-sem-docker)

---

## Pré-requisitos

Apenas **Docker** e **Docker Compose** instalados na máquina. Nenhuma instalação de Python, Node.js ou dependências adicionais é necessária.

---

## Instalação e início rápido

```bash
git clone <repo-url>
cd Dataforge

# Sobe o frontend (interface visual) em segundo plano
docker compose up --build -d
```

Após o build (alguns minutos na primeira vez), acesse no navegador:

```
http://localhost:5173
```

### Estrutura de pastas no host

Após subir o container, três pastas ficam mapeadas entre o container e o seu computador:

| Pasta | Uso |
|-------|-----|
| `output/` | Arquivos gerados pelo CLI aparecem aqui |
| `credentials/` | Coloque aqui os arquivos de credenciais de nuvem (JSON do GCP, etc.) |
| `src/dataforge/schemas/` | Schemas YAML customizados — edite aqui sem rebuildar a imagem |

---

## Interface Visual

A interface visual roda em `http://localhost:5173` e permite criar e editar schemas sem escrever YAML manualmente.

### O que é possível fazer

- **Criar tabelas** — defina nome e quantidade de linhas
- **Adicionar colunas** — escolha o `dtype`, configure `min`/`max`, marque como `primary_key` ou `nullable`
- **Definir chaves estrangeiras (FKs)** — conecte colunas de uma tabela a outra arrastando no diagrama
- **Usar templates de domínios prontos** — carregue um schema de e-commerce, RH ou financeiro como ponto de partida
- **Navegar no catálogo de Faker** — veja exemplos de todos os `faker_provider` disponíveis antes de aplicar
- **Exportar YAML** — baixe o schema gerado para usar com o CLI ou salvar em `schemas/`
- **Importar YAML** — carregue um schema existente para editar visualmente

O diagrama é atualizado em tempo real e mostra as relações entre tabelas com setas representando FKs.

---

## Usando o CLI via Docker

O CLI (`dataset-gen`) é executado via `docker compose run`. Os arquivos gerados aparecem na pasta `output/` do host.

### Comandos de referência rápida

```bash
# Ver todos os domínios disponíveis
docker compose run --rm cli list-domains

# Ver tabelas e colunas de um domínio
docker compose run --rm cli schema-info ecommerce

# Ver todos os flags disponíveis
docker compose run --rm cli generate --help
```

### Exemplos práticos

```bash
# Gerar o domínio ecommerce em CSV (padrão)
docker compose run --rm cli generate -d ecommerce

# Gerar 500 linhas por tabela em CSV e Parquet
docker compose run --rm cli generate -d ecommerce -r 500 -f csv -f parquet

# Gerar apenas tabelas específicas
docker compose run --rm cli generate -d hr -t employees -t departments -f csv

# Usar um schema YAML customizado (salvo em src/dataforge/schemas/)
docker compose run --rm cli generate -d custom -c /app/src/dataforge/schemas/transacoes.yaml -f csv

# Gerar em modo recorrente (um batch a cada 30 segundos)
docker compose run --rm cli generate -d finance -f json -R 30

# Gerar 10 batches com intervalo de 60 segundos entre cada um
docker compose run --rm cli generate -d ecommerce -f parquet -R 60 --count 10
```

Os arquivos são salvos em `output/<domínio>/<tabela>/` na máquina host.

### Referência de flags — `generate`

| Flag | Atalho | Padrão | Descrição |
|------|--------|--------|-----------|
| `--domain` | `-d` | — | Domínio: `ecommerce`, `hr`, `finance`, `custom` |
| `--config` | `-c` | — | Caminho para YAML (obrigatório se `--domain custom`) |
| `--rows` | `-r` | por tabela | Número de linhas por tabela |
| `--tables` | `-t` | todas | Tabelas a incluir (repetível) |
| `--columns` | | todas | `"tabela:col1,col2"` — filtro de colunas (repetível) |
| `--format` | `-f` | `csv` | `csv`, `json`, `parquet` ou `avro` (repetível) |
| `--output` | `-o` | `./output` | Diretório de saída dentro do container |
| `--json-mode` | | `flat` | Modo JSON: `flat` (NDJSON) ou `nested` |
| `--seed` | | — | Seed para geração reproduzível |
| `--partition-by` | | — | Particionamento Hive-style: `coluna` ou `tabela:coluna` (repetível) |
| `--upload` | | — | Destino de upload: `gcs`, `s3` ou `azure` |
| `--bucket` | | — | Nome do bucket/container de destino |
| `--prefix` | | `datasets/` | Prefixo/pasta dentro do bucket |
| `--credentials` | | — | Caminho para arquivo de credenciais (dentro do container) |
| `--db-url` | | — | Connection string SQLAlchemy para carga SQL |
| `--if-exists` | | `replace` | O que fazer se a tabela SQL já existir: `replace`, `append` ou `fail` |
| `--db-schema` | | — | Schema do banco de destino |
| `--recurrence` | `-R` | — | Intervalo em segundos entre batches (modo contínuo) |
| `--count` | | `0` | Número de batches no modo recorrente (0 = infinito) |

---

## Domínios prontos

Use `--domain <nome>` para gerar um conjunto de tabelas relacionais pré-configurado.

### E-commerce (`-d ecommerce`)

| Tabela | Linhas padrão | FK para |
|--------|---------------|---------|
| `categories` | 20 | — |
| `customers` | 500 | — |
| `products` | 200 | `categories.id` |
| `orders` | 1000 | `customers.id` |
| `order_items` | 3000 | `orders.id`, `products.id` |

### RH (`-d hr`)

| Tabela | Linhas padrão | FK para |
|--------|---------------|---------|
| `departments` | 10 | — |
| `job_titles` | 20 | — |
| `employees` | 300 | `departments.id`, `job_titles.id`, `employees.id` |
| `salaries` | 300 | `employees.id` |

### Financeiro (`-d finance`)

| Tabela | Linhas padrão | FK para |
|--------|---------------|---------|
| `customers` | 500 | — |
| `categories` | 15 | — |
| `accounts` | 600 | `customers.id` |
| `transactions` | 5000 | `accounts.id`, `categories.id` |

Schemas YAML de exemplo para cada domínio estão em `src/dataforge/schemas/`.

---

## Schema YAML customizado

Crie um arquivo `.yaml` em `src/dataforge/schemas/` e use `--domain custom --config /app/src/dataforge/schemas/seu_arquivo.yaml`.

### Estrutura mínima

```yaml
domain: meu_dominio

tables:
  autores:
    rows: 50
    columns:
      id:
        dtype: int_seq
        primary_key: true
      nome:
        dtype: name
      email:
        dtype: email

  livros:
    rows: 200
    columns:
      id:
        dtype: int_seq
        primary_key: true
      titulo:
        dtype: str
      preco:
        dtype: float
        min: 10
        max: 300
      publicado_em:
        dtype: date
        min: "2000-01-01"
        max: "today"
      autor_id:
        dtype: int
        foreign_key:
          table: autores
          column: id
      ativo:
        dtype: bool
      descricao:
        dtype: text
        nullable: 0.3
```

### Campos suportados por coluna

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `dtype` | string | Tipo de dado (ver tabela abaixo) |
| `primary_key` | bool | Marca a coluna como chave primária |
| `nullable` | float (0–1) | Proporção de valores nulos (ex: `0.2` = 20% nulos) |
| `min` | number / string | Valor mínimo para `int`, `float` ou `date` |
| `max` | number / string | Valor máximo para `int`, `float` ou `date` |
| `foreign_key.table` | string | Tabela referenciada |
| `foreign_key.column` | string | Coluna referenciada |
| `faker_provider` | string | Qualquer método do Faker (ex: `postcode`, `iban`) |
| `choices` | lista | Lista de valores fixos para sortear |

### Override de domínio existente

Para ajustar apenas o número de linhas de um domínio pronto:

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

## Tipos de dados disponíveis (`dtype`)

| dtype | Descrição | Suporta `min`/`max` |
|-------|-----------|---------------------|
| `int_seq` | Inteiro sequencial (1, 2, 3...) — ideal para PKs | Não |
| `uuid` | UUID v4 | Não |
| `int` | Inteiro aleatório | Sim (padrão: 0–100000) |
| `float` | Float com 2 casas decimais | Sim (padrão: 0–10000) |
| `str` | Palavra genérica | Não |
| `bool` | Booleano | Não |
| `date` | Data aleatória | Sim (padrão: últimos 3 anos até hoje) |
| `name` | Nome completo | Não |
| `email` | Endereço de e-mail | Não |
| `phone` | Número de telefone | Não |
| `address` | Endereço completo | Não |
| `city` | Cidade | Não |
| `country` | País | Não |
| `company` | Nome de empresa | Não |
| `text` | Frase/sentença | Não |
| `url` | URL | Não |
| `currency` | Código de moeda (ex: BRL, USD) | Não |
| `iban` | IBAN bancário | Não |

Para qualquer método do Faker não listado acima, use `faker_provider: nome_do_metodo`.

### Exemplos com range de valores

```yaml
# Inteiro entre 1 e 5 (ex: rating)
rating:
  dtype: int
  min: 1
  max: 5

# Float entre 0.0 e 1.0 (ex: percentual de desconto)
desconto:
  dtype: float
  min: 0
  max: 1

# Data entre 2020 e hoje
data_contrato:
  dtype: date
  min: "2020-01-01"
  max: "today"

# Data dos últimos 6 meses (notação relativa do Faker)
data_recente:
  dtype: date
  min: "-6m"
  max: "today"
```

---

## Formatos de saída

| Flag | Formato | Notas |
|------|---------|-------|
| `-f csv` | CSV UTF-8 | Padrão |
| `-f json` | JSON linha a linha (NDJSON) | Use `--json-mode nested` para aninhar filhos dentro dos pais |
| `-f parquet` | Parquet com compressão Snappy | — |
| `-f avro` | Avro com schema inferido | — |

Múltiplos formatos na mesma execução:

```bash
docker compose run --rm cli generate -d ecommerce -f csv -f json -f parquet
```

Layout de saída:

```
output/
└── ecommerce/
    ├── customers/
    │   └── customers.csv
    ├── orders/
    │   └── orders.csv
    └── ...
```

### Particionamento Hive-style

```bash
# Particionar todas as tabelas pela coluna "created_at"
docker compose run --rm cli generate -d ecommerce -f parquet --partition-by created_at

# Particionar tabela específica
docker compose run --rm cli generate -d ecommerce -f parquet --partition-by "orders:status"
```

---

## Upload em nuvem

Coloque o arquivo de credenciais na pasta `credentials/` do projeto (ela é montada no container em `/app/credentials/`).

### Google Cloud Storage

```bash
# Usando arquivo de service account
docker compose run --rm cli generate -d ecommerce -f parquet \
  --upload gcs \
  --bucket meu-bucket \
  --prefix raw/ecommerce/ \
  --credentials /app/credentials/service-account.json
```

### Amazon S3

```bash
# Autenticação via variáveis de ambiente no docker-compose ou inline
docker compose run --rm \
  -e AWS_ACCESS_KEY_ID=... \
  -e AWS_SECRET_ACCESS_KEY=... \
  cli generate -d hr -f csv \
  --upload s3 \
  --bucket meu-bucket \
  --prefix data/hr/
```

### Azure Blob Storage

```bash
docker compose run --rm \
  -e AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;..." \
  cli generate -d finance -f parquet \
  --upload azure \
  --bucket meu-container \
  --prefix datasets/finance/
```

Os arquivos são mantidos localmente em `output/` mesmo após o upload.

---

## Carga em banco SQL

Use `--db-url` com uma connection string SQLAlchemy para carregar os dados diretamente em um banco.

| Banco | Exemplo de URL |
|-------|---------------|
| SQLite | `sqlite:////app/output/dados.db` |
| PostgreSQL | `postgresql+psycopg2://user:pass@host:5432/db` |
| MySQL | `mysql+pymysql://user:pass@host:3306/db` |
| SQL Server | `mssql+pyodbc://user:pass@host/db?driver=ODBC+Driver+17+for+SQL+Server` |

```bash
# SQLite — arquivo criado em output/ no host
docker compose run --rm cli generate -d ecommerce -r 500 \
  --db-url sqlite:////app/output/ecommerce.db

# PostgreSQL
docker compose run --rm cli generate -d hr -r 1000 \
  --db-url "postgresql+psycopg2://user:pass@host:5432/mydb"

# Append em vez de substituir
docker compose run --rm cli generate -d finance \
  --db-url sqlite:////app/output/finance.db --if-exists append

# Schema específico (PostgreSQL)
docker compose run --rm cli generate -d hr \
  --db-url "postgresql+psycopg2://user:pass@host/db" \
  --db-schema staging

# Arquivo + SQL na mesma execução
docker compose run --rm cli generate -d ecommerce -f csv -f parquet \
  --db-url sqlite:////app/output/ecommerce.db
```

---

## Reprodutibilidade

Use `--seed` para gerar o mesmo dataset em execuções diferentes:

```bash
docker compose run --rm cli generate -d finance --seed 42 -f csv -o /app/output/run1
docker compose run --rm cli generate -d finance --seed 42 -f csv -o /app/output/run2

# Os arquivos em run1/ e run2/ serão idênticos
```

---

## Integridade Referencial

O gerador garante que todas as FKs são válidas em dois passos:

1. **Ordenação topológica** — tabelas pai são sempre geradas antes das tabelas filhas
2. **Pool de PKs** — após gerar cada tabela, seus PKs ficam disponíveis; colunas FK amostram desse pool (com reposição, permitindo múltiplos filhos por pai)

FKs auto-referenciadas (ex: `employees.manager_id -> employees.id`) são preenchidas após a geração da própria tabela.

---

## Instalação alternativa sem Docker

Para quem preferir instalar diretamente com Poetry (requer Python 3.12+ e Poetry instalados):

```bash
git clone <repo-url>
cd Dataforge

# Instalação base (CSV e JSON)
poetry install

# Com todos os extras
poetry install -E "parquet avro sql postgres gcp aws azure"
```

| Extra | Funcionalidade |
|-------|---------------|
| `parquet` | Formato Parquet |
| `avro` | Formato Avro |
| `sql` | SQLite e bancos via SQLAlchemy |
| `postgres` | PostgreSQL |
| `mysql` | MySQL / MariaDB |
| `mssql` | SQL Server |
| `gcp` | Google Cloud Storage |
| `aws` | Amazon S3 |
| `azure` | Azure Blob Storage |

Após instalar, use `dataset-gen` diretamente no terminal no lugar de `docker compose run --rm cli`.
