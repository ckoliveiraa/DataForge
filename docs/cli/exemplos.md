# CLI — Exemplos Práticos

Todos os exemplos usam `docker compose run --rm cli`. Para instalação sem Docker, substitua por `dataset-gen`.

## Explorando domínios

```bash
# Listar todos os domínios disponíveis
docker compose run --rm cli list-domains

# Ver estrutura completa do domínio ecommerce
docker compose run --rm cli schema-info ecommerce

# Ver estrutura do domínio hr
docker compose run --rm cli schema-info hr
```

## Geração básica

```bash
# Gerar o domínio ecommerce em CSV (padrão)
docker compose run --rm cli generate -d ecommerce

# Gerar 500 linhas por tabela em CSV
docker compose run --rm cli generate -d ecommerce -r 500

# Gerar em múltiplos formatos
docker compose run --rm cli generate -d ecommerce -r 500 -f csv -f parquet

# Gerar apenas tabelas específicas
docker compose run --rm cli generate -d hr -t employees -t departments -f csv
```

## Schema YAML customizado

```bash
# Usar um schema YAML salvo em src/dataforge/schemas/
docker compose run --rm cli generate -d custom \
  -c /app/src/dataforge/schemas/transacoes.yaml \
  -f csv

# Sobrescrever apenas o número de linhas de um domínio existente
docker compose run --rm cli generate -d ecommerce \
  -c /app/src/dataforge/schemas/meu_override.yaml \
  -f parquet
```

## Formatos de saída

```bash
# CSV (padrão)
docker compose run --rm cli generate -d finance -f csv

# JSON flat (NDJSON — uma linha por registro)
docker compose run --rm cli generate -d finance -f json

# JSON nested (filhos aninhados dentro dos pais)
docker compose run --rm cli generate -d finance -f json --json-mode nested

# Parquet com compressão Snappy
docker compose run --rm cli generate -d finance -f parquet

# Avro com schema inferido
docker compose run --rm cli generate -d finance -f avro

# Todos os formatos na mesma execução
docker compose run --rm cli generate -d ecommerce -f csv -f json -f parquet -f avro
```

## Filtro de colunas

```bash
# Gerar apenas colunas específicas da tabela orders
docker compose run --rm cli generate -d ecommerce \
  --columns "orders:id,customer_id,status,total" \
  -f csv

# Filtrar múltiplas tabelas
docker compose run --rm cli generate -d hr \
  --columns "employees:id,name,department_id" \
  --columns "departments:id,name" \
  -f csv
```

## Particionamento Hive-style

```bash
# Particionar todas as tabelas pela coluna "created_at"
docker compose run --rm cli generate -d ecommerce -f parquet \
  --partition-by created_at

# Particionar tabela específica pela coluna "status"
docker compose run --rm cli generate -d ecommerce -f parquet \
  --partition-by "orders:status"

# Múltiplas regras de particionamento
docker compose run --rm cli generate -d ecommerce -f parquet \
  --partition-by "orders:status" \
  --partition-by "order_items:order_id"
```

Layout de saída com particionamento:

```
output/
└── ecommerce/
    └── orders/
        ├── status=pending/
        │   └── orders.parquet
        ├── status=processing/
        │   └── orders.parquet
        └── status=delivered/
            └── orders.parquet
```

## Upload para nuvem

```bash
# Google Cloud Storage
docker compose run --rm cli generate -d ecommerce -f parquet \
  --upload gcs \
  --bucket meu-bucket \
  --prefix raw/ecommerce/ \
  --credentials /app/credentials/service-account.json

# Amazon S3 (credenciais via variáveis de ambiente)
docker compose run --rm \
  -e AWS_ACCESS_KEY_ID=AKIA... \
  -e AWS_SECRET_ACCESS_KEY=... \
  cli generate -d hr -f csv \
  --upload s3 \
  --bucket meu-bucket \
  --prefix data/hr/

# Azure Blob Storage
docker compose run --rm \
  -e AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;..." \
  cli generate -d finance -f parquet \
  --upload azure \
  --bucket meu-container \
  --prefix datasets/finance/
```

## Carga em banco SQL

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

# Schema específico no PostgreSQL
docker compose run --rm cli generate -d hr \
  --db-url "postgresql+psycopg2://user:pass@host/db" \
  --db-schema staging

# Arquivo + SQL na mesma execução
docker compose run --rm cli generate -d ecommerce -f csv -f parquet \
  --db-url sqlite:////app/output/ecommerce.db
```

## Reprodutibilidade com seed

```bash
# Gerar o mesmo dataset em execuções diferentes
docker compose run --rm cli generate -d finance --seed 42 -f csv -o /app/output/run1
docker compose run --rm cli generate -d finance --seed 42 -f csv -o /app/output/run2
# run1/ e run2/ serão idênticos
```

## Modo recorrente

```bash
# Gerar um batch a cada 30 segundos indefinidamente (Ctrl+C para parar)
docker compose run --rm cli generate -d finance -f json -R 30

# Gerar exatamente 10 batches com intervalo de 60 segundos
docker compose run --rm cli generate -d ecommerce -f parquet -R 60 --count 10

# Modo recorrente com incremento de data (simula streaming temporal)
docker compose run --rm cli generate -d ecommerce -f parquet -R 10 \
  --increment "orders:created_at:1:days"
```

## Combinando opções

```bash
# Pipeline completo: gerar, salvar em CSV + Parquet, fazer upload para GCS e carregar no PostgreSQL
docker compose run --rm cli generate -d ecommerce \
  -r 1000 \
  -f csv -f parquet \
  --seed 2024 \
  --partition-by "orders:status" \
  --upload gcs \
  --bucket meu-bucket \
  --prefix raw/ecommerce/ \
  --credentials /app/credentials/sa.json \
  --db-url "postgresql+psycopg2://user:pass@host:5432/db" \
  --db-schema staging
```
