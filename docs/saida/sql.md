# Carga em Banco SQL

Use `--db-url` para carregar os datasets diretamente em um banco de dados relacional via SQLAlchemy.

## Bancos suportados

| Banco | Connection string | Extra necessário |
|-------|------------------|-----------------|
| SQLite | `sqlite:////app/output/dados.db` | Incluído (sem extra) |
| PostgreSQL | `postgresql+psycopg2://user:pass@host:5432/db` | `postgres` |
| MySQL / MariaDB | `mysql+pymysql://user:pass@host:3306/db` | `mysql` |
| SQL Server | `mssql+pyodbc://user:pass@host/db?driver=ODBC+Driver+17+for+SQL+Server` | `mssql` |

!!! note "Docker"
    A imagem Docker padrão inclui os extras `sql` e `postgres`. Para MySQL ou SQL Server, é necessário rebuild com os extras adicionais.

## Flags relacionadas

| Flag | Padrão | Descrição |
|------|--------|-----------|
| `--db-url` | — | Connection string SQLAlchemy |
| `--if-exists` | `replace` | O que fazer se a tabela já existir: `replace`, `append` ou `fail` |
| `--db-schema` | — | Schema do banco de destino (ex: `staging`, `public`) |

## Exemplos

```bash
# SQLite — arquivo criado em output/ no host
docker compose run --rm cli generate -d ecommerce -r 500 \
  --db-url sqlite:////app/output/ecommerce.db

# PostgreSQL
docker compose run --rm cli generate -d hr -r 1000 \
  --db-url "postgresql+psycopg2://user:pass@host:5432/mydb"

# Append em vez de substituir
docker compose run --rm cli generate -d finance \
  --db-url sqlite:////app/output/finance.db \
  --if-exists append

# Schema específico no PostgreSQL
docker compose run --rm cli generate -d hr \
  --db-url "postgresql+psycopg2://user:pass@host/db" \
  --db-schema staging

# Arquivo + SQL na mesma execução
docker compose run --rm cli generate -d ecommerce -f csv -f parquet \
  --db-url sqlite:////app/output/ecommerce.db
```

## Comportamento de `--if-exists`

| Valor | Descrição |
|-------|-----------|
| `replace` | Dropa e recria a tabela (padrão) |
| `append` | Insere os novos registros sem modificar os existentes |
| `fail` | Lança erro se a tabela já existir |

## Modo recorrente e SQL

Em modo recorrente, o primeiro batch usa o valor de `--if-exists`. A partir do segundo batch, o comportamento é forçado para `append` automaticamente, preservando os dados anteriores:

```python
effective_if_exists = sql_if_exists if batch == 1 else "append"
```

## Teste de conexão na interface

A interface visual inclui um formulário de conexão com botão **Test Connection**. Ele envia `POST /api/test-db-connection` com a URL de conexão e retorna `{ "success": true }` ou `{ "success": false, "error": "mensagem" }`.

As conexões configuradas podem ser salvas no `localStorage` do navegador para reutilização.

## Interface de configuração

Na interface visual, o painel **Run Generator** oferece dois modos para configurar a conexão SQL:

- **Formulário guiado**: campos separados para tipo, host, porta, banco, usuário e senha. Suporta PostgreSQL, MySQL e SQLite.
- **URL avançada**: campo livre para informar a connection string completa.

O formulário guiado constrói automaticamente a URL SQLAlchemy:

| Tipo | URL gerada |
|------|-----------|
| `postgresql` | `postgresql+psycopg2://user:pass@host:5432/db` |
| `mysql` | `mysql+pymysql://user:pass@host:3306/db` |
| `sqlite` | `sqlite:///caminho_do_arquivo.db` |
