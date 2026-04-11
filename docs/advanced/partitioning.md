# Particionamento

Dataforge suporta particionamento no estilo **Hive** — os dados são divididos em subpastas baseadas nos valores de uma coluna.

---

## Como funciona

Ao usar `--partition-by coluna`, cada valor único da coluna se torna uma subpasta:

```
output/
└── ecommerce/
    └── orders/
        ├── status=pendente/
        │   └── orders.csv
        ├── status=pago/
        │   └── orders.csv
        └── status=cancelado/
            └── orders.csv
```

---

## Uso

```bash
# Particionar todas as tabelas por uma coluna de mesma nome
docker compose run --rm cli generate -d ecommerce \
  -f parquet \
  --partition-by ordered_at

# Particionar tabela específica
docker compose run --rm cli generate -d ecommerce \
  -f parquet \
  --partition-by "orders:status"

# Múltiplas tabelas com colunas diferentes
docker compose run --rm cli generate -d ecommerce \
  -f parquet \
  --partition-by "orders:status" \
  --partition-by "customers:country"
```

!!! note "`--partition-by` sem prefixo de tabela"
    `--partition-by created_at` aplica a partição na coluna `created_at` de **todas** as tabelas que possuem essa coluna. Para tabelas sem essa coluna, a escrita é feita normalmente (sem partição).

---

## Compatibilidade com motores de query

A estrutura é compatível com:

- **Apache Hive**
- **Apache Spark** (`spark.read.parquet("output/ecommerce/orders/")`)
- **AWS Athena / Glue**
- **Google BigQuery** (via tabelas externas com partição por coluna)
- **DuckDB** (`read_parquet(..., hive_partitioning=true)`)
- **Delta Lake / Iceberg** (via conversão)

### Exemplo DuckDB

```sql
SELECT *
FROM read_parquet('output/ecommerce/orders/**/*.parquet', hive_partitioning=true)
WHERE status = 'pago';
```

### Exemplo PySpark

```python
df = spark.read.parquet("output/ecommerce/orders/")
df.filter(df.status == "pago").show()
```

---

## Particionamento + upload para nuvem

Use `--upload` junto com `--partition-by`. A estrutura de partições é replicada no bucket remoto:

```bash
docker compose run --rm cli generate -d ecommerce -f parquet \
  --partition-by ordered_at \
  --upload gcs \
  --bucket meu-datalake \
  --prefix raw/ecommerce/ \
  --credentials /app/credentials/sa.json
```

Resultado no GCS:

```
gs://meu-datalake/raw/ecommerce/ecommerce/orders/ordered_at=2024-01-15/orders.parquet
gs://meu-datalake/raw/ecommerce/ecommerce/orders/ordered_at=2024-01-16/orders.parquet
...
```

---

## Escolha da coluna de partição

!!! tip "Boas práticas"
    - Use colunas de **baixa cardinalidade** — `status`, `country`, `date`. Evite UUID ou inteiros com muitos valores únicos.
    - Colunas `date` geram uma partição por dia — ideal para dados temporais.
    - Colunas com `choices` geram um número previsível e controlado de partições.
