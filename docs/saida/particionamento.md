# Particionamento Hive-style

O Dataforge suporta particionamento de saída no formato Hive: os arquivos são organizados em subpastas nomeadas `coluna=valor`.

## Como usar

Use a flag `--partition-by`. Ela aceita dois formatos:

| Formato | Efeito |
|---------|--------|
| `--partition-by coluna` | Aplica a partição a todas as tabelas |
| `--partition-by tabela:coluna` | Aplica a partição apenas à tabela especificada |

A flag é repetível para definir regras diferentes por tabela.

## Exemplos

```bash
# Particionar todas as tabelas pela coluna "created_at"
docker compose run --rm cli generate -d ecommerce -f parquet \
  --partition-by created_at

# Particionar apenas a tabela "orders" pela coluna "status"
docker compose run --rm cli generate -d ecommerce -f parquet \
  --partition-by "orders:status"

# Múltiplas regras
docker compose run --rm cli generate -d ecommerce -f parquet \
  --partition-by "orders:status" \
  --partition-by "order_items:order_id"
```

## Layout de saída

Com `--partition-by "orders:status"`:

```
output/
└── ecommerce/
    └── orders/
        ├── status=cancelled/
        │   └── orders.parquet
        ├── status=delivered/
        │   └── orders.parquet
        ├── status=pending/
        │   └── orders.parquet
        ├── status=processing/
        │   └── orders.parquet
        └── status=shipped/
            └── orders.parquet
```

## Comportamento por formato

| Formato | Sem recorrência | Com recorrência |
|---------|-----------------|-----------------|
| CSV | Um arquivo por partição (`tabela.csv`) | Append no mesmo arquivo |
| JSON flat | Um arquivo por partição (`tabela.json`) | Append no mesmo arquivo |
| Parquet | Um arquivo por partição (`tabela.parquet`) | Arquivo com timestamp por batch |
| Avro | Um arquivo por partição (`tabela.avro`) | Arquivo com timestamp por batch |

## Valores seguros em nomes de pasta

Caracteres problemáticos nos valores da coluna de partição são sanitizados:

- `/` → `-`
- Espaços → `_`

Por exemplo, o valor `"New York"` gera a pasta `city=New_York`.

## Compatibilidade com ferramentas analíticas

O layout Hive-style é reconhecido diretamente por:

- **Apache Spark** — `spark.read.parquet("output/ecommerce/orders/")`
- **AWS Athena** / **Glue** — descoberta automática de partições
- **DuckDB** — `read_parquet("output/ecommerce/orders/**/*.parquet", hive_partitioning=true)`
- **dbt** — uso como source com partições

!!! tip "Colunas de data"
    Particionar por uma coluna de data (`created_at`, `transaction_date`) é o padrão mais comum para datasets temporais. Combine com o modo recorrente e `--increment` para simular pipelines incrementais.
