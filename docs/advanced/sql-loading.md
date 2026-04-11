# Carga em Banco SQL

Dataforge pode inserir os dados gerados diretamente em bancos de dados relacionais via SQLAlchemy.

---

## Bancos suportados

| Banco | Extra necessário | Exemplo de connection string |
|---|---|---|
| SQLite | (nativo) | `sqlite:////app/output/dados.db` |
| PostgreSQL | `postgres` | `postgresql+psycopg2://user:pass@host:5432/db` |
| MySQL / MariaDB | `mysql` | `mysql+pymysql://user:pass@host:3306/db` |
| SQL Server | `mssql` | `mssql+pyodbc://user:pass@host/db?driver=ODBC+Driver+17+for+SQL+Server` |

!!! tip "Docker já inclui tudo"
    A imagem Docker é construída com todos os extras SQL (`sql`, `postgres`, `mysql`, `mssql`). Nenhuma instalação adicional é necessária no container.

---

## Uso básico

```bash
# SQLite — arquivo criado em output/ no host
docker compose run --rm cli generate -d ecommerce -r 500 \
  --db-url sqlite:////app/output/ecommerce.db

# PostgreSQL — substituindo tabelas existentes
docker compose run --rm cli generate -d ecommerce \
  --db-url "postgresql+psycopg2://admin:senha@localhost:5432/dwh" \
  --if-exists replace

# Append em vez de substituir
docker compose run --rm cli generate -d finance \
  --db-url sqlite:////app/output/finance.db \
  --if-exists append

# Schema específico (PostgreSQL)
docker compose run --rm cli generate -d hr \
  --db-url "postgresql+psycopg2://admin:senha@host/db" \
  --db-schema staging

# Arquivo + SQL na mesma execução
docker compose run --rm cli generate -d ecommerce -f csv -f parquet \
  --db-url sqlite:////app/output/ecommerce.db
```

---

## Opções de `--if-exists`

| Valor | Comportamento |
|---|---|
| `replace` | Drop + recria a tabela com os novos dados **(padrão)** |
| `append` | Insere linhas sem alterar a estrutura da tabela |
| `fail` | Erro se a tabela já existir |

---

## `--db-schema`

Define o schema (namespace) do banco de destino. Útil para isolar dados em schemas como `staging`, `raw` ou `dev`:

```bash
docker compose run --rm cli generate -d hr \
  --db-url "postgresql+psycopg2://admin:senha@localhost/dwh" \
  --db-schema staging \
  --if-exists replace
```

---

## Com Docker Compose — acessando PostgreSQL no host

Para conectar ao PostgreSQL rodando na máquina host a partir do container:

```bash
docker compose run --rm cli generate -d ecommerce \
  --db-url "postgresql+psycopg2://admin:senha@host.docker.internal:5432/dwh" \
  --if-exists replace
```

Para conectar a um serviço PostgreSQL definido no `docker-compose.yml`:

```yaml
# Adicionar ao docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: senha
      POSTGRES_DB: dwh
    ports:
      - "5432:5432"
```

```bash
docker compose run --rm cli generate -d ecommerce \
  --db-url "postgresql+psycopg2://admin:senha@postgres:5432/dwh" \
  --if-exists replace
```

---

## Modo recorrente com SQL

Em modo recorrente (`--recurrence` / `-R`):

- **Batch 1**: usa o valor de `--if-exists` (`replace` ou `append`)
- **Batches seguintes**: sempre usam `append`, preservando os dados anteriores

Isso evita apagar dados já carregados nos batches anteriores:

```bash
# Popular o banco incrementalmente com 10 batches (sem espera entre eles)
docker compose run --rm cli generate -d ecommerce \
  -t orders \
  -R 0 --count 10 \
  --db-url "postgresql+psycopg2://admin:senha@localhost/dwh" \
  --if-exists replace
```

Resultado: batch 1 substitui a tabela `orders`; batches 2 a 10 fazem append, totalizando `linhas_por_batch × 10` linhas.

---

## Instalar extras SQL (sem Docker)

```bash
# Poetry
poetry install --extras "postgres"
poetry install --extras "mysql"
poetry install --extras "mssql"

# pip
pip install ".[postgres]"
pip install ".[mysql]"
pip install ".[mssql]"
```
