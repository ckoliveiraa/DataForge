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
# Particionar pedidos por status
dataset-gen generate -d ecommerce \
  -t orders \
  -f parquet \
  --partition-by status

# Particionar por data
dataset-gen generate -d ecommerce \
  -t orders \
  -f csv \
  --partition-by created_at
```

---

## Compatibilidade com motores de query

A estrutura de particionamento é compatível com:

- **Apache Hive**
- **Apache Spark** (`spark.read.parquet("output/ecommerce/orders/")`)
- **AWS Athena** / **Glue**
- **Google BigQuery** (via partição por coluna em cargas externas)
- **DuckDB** (`read_parquet('output/ecommerce/orders/**/*.parquet', hive_partitioning=true)`)
- **Delta Lake** / **Iceberg** (via conversão)

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

```bash
dataset-gen generate -d ecommerce \
  -f parquet \
  --partition-by created_at \
  --gcs-bucket meu-datalake \
  --gcs-prefix raw/ecommerce
```

Resultado no GCS:

```
gs://meu-datalake/raw/ecommerce/orders/created_at=2024-01-15/orders.parquet
gs://meu-datalake/raw/ecommerce/orders/created_at=2024-01-16/orders.parquet
...
```

---

## Escolha da coluna de partição

!!! tip "Boas práticas"
    - Use colunas de **baixa cardinalidade** (status, categoria, data) — evite UUID ou colunas numéricas com muitos valores únicos
    - Colunas do tipo `date` geram uma partição por dia — ideal para dados temporais
    - Colunas `choices` geram um número previsível de partições
