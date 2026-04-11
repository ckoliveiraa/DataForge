# Carga em Banco SQL

Dataforge pode inserir os dados gerados diretamente em bancos de dados relacionais via SQLAlchemy.

---

## Bancos suportados

| Banco | Extra | Connection string |
|---|---|---|
| SQLite | (nativo) | `sqlite:///./meu_banco.db` |
| PostgreSQL | `postgres` | `postgresql+psycopg2://user:pass@host:5432/db` |
| MySQL / MariaDB | `mysql` | `mysql+pymysql://user:pass@host:3306/db` |
| SQL Server | `mssql` | `mssql+pyodbc://user:pass@host/db?driver=ODBC+Driver+17` |

---

## Uso básico

```bash
# Carga no PostgreSQL — substituindo tabelas existentes
dataset-gen generate -d ecommerce \
  -f csv \
  --db-url "postgresql+psycopg2://admin:senha@localhost:5432/dwh" \
  --if-exists replace

# Carga append (adicionar linhas às tabelas existentes)
dataset-gen generate -d ecommerce \
  --db-url "postgresql+psycopg2://admin:senha@localhost:5432/dwh" \
  --if-exists append

# Carga em schema específico
dataset-gen generate -d hr \
  --db-url "postgresql+psycopg2://admin:senha@localhost:5432/dwh" \
  --db-schema staging \
  --if-exists replace
```

---

## Opções de `--if-exists`

| Valor | Comportamento |
|---|---|
| `fail` | Erro se a tabela já existir (padrão) |
| `replace` | Drop + recria a tabela com os novos dados |
| `append` | Insere linhas sem alterar a tabela |

---

## Com Docker Compose

Para conectar ao PostgreSQL rodando no host:

```bash
docker compose run --rm cli generate -d ecommerce \
  --db-url "postgresql+psycopg2://admin:senha@host.docker.internal:5432/dwh" \
  --if-exists replace
```

Para conectar a um serviço definido no próprio `docker-compose.yml`:

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

Em modo recorrente (`-R`):

- **Batch 1**: usa o valor de `--if-exists` (`replace` ou `append`)
- **Batches seguintes**: sempre usam `append`, preservando os dados anteriores

```bash
# Popular o banco incrementalmente com 10 batches
dataset-gen generate -d ecommerce \
  -t orders -t order_items \
  -r orders=1000 \
  -R 10 \
  --interval 0 \
  --increment orders:id:1000 \
  --db-url "postgresql+psycopg2://admin:senha@localhost/dwh" \
  --if-exists replace
```

---

## Instalar extras SQL

```bash
# Poetry
poetry install --extras "postgres"
poetry install --extras "mysql"

# pip
pip install ".[postgres]"
pip install ".[mysql]"
pip install ".[mssql]"
```

No Docker, todos os extras SQL já estão instalados na imagem padrão.
