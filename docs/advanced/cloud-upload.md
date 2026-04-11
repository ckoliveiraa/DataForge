# Upload para Nuvem

Dataforge pode fazer upload dos arquivos gerados diretamente para GCS, S3 ou Azure Blob Storage. Os arquivos também são mantidos localmente em `output/`.

---

## Flags de upload

| Flag | Padrão | Descrição |
|---|---|---|
| `--upload` | — | Destino: `gcs`, `s3` ou `azure` |
| `--bucket` | — | Nome do bucket ou container de destino |
| `--prefix` | `datasets/` | Prefixo (pasta) dentro do bucket |
| `--credentials` | — | Caminho para arquivo de credenciais dentro do container |

**Estrutura do path remoto gerado:**

```
<prefix>/<dominio>/<tabela>/<arquivo>
```

Exemplo: `datasets/ecommerce/orders/orders.parquet`

---

## Google Cloud Storage (GCS)

### Autenticação via Service Account

Copie o arquivo de chave JSON para a pasta `credentials/` do projeto (ela é montada automaticamente em `/app/credentials/` dentro do container):

```bash
cp ~/minha-sa-key.json ./credentials/gcp-sa.json
```

Passe o caminho com `--credentials`:

```bash
docker compose run --rm cli generate -d ecommerce -f parquet \
  --upload gcs \
  --bucket meu-datalake \
  --prefix raw/ecommerce/ \
  --credentials /app/credentials/gcp-sa.json
```

### Resultado

```
gs://meu-datalake/raw/ecommerce/ecommerce/categories/categories.parquet
gs://meu-datalake/raw/ecommerce/ecommerce/products/products.parquet
gs://meu-datalake/raw/ecommerce/ecommerce/customers/customers.parquet
...
```

---

## Amazon S3

### Autenticação via variáveis de ambiente

Passe as credenciais AWS como variáveis de ambiente no `docker compose run`:

```bash
docker compose run --rm \
  -e AWS_ACCESS_KEY_ID=AKIA... \
  -e AWS_SECRET_ACCESS_KEY=... \
  -e AWS_DEFAULT_REGION=us-east-1 \
  cli generate -d ecommerce -f parquet \
  --upload s3 \
  --bucket meu-bucket \
  --prefix raw/ecommerce/
```

### Resultado

```
s3://meu-bucket/raw/ecommerce/ecommerce/categories/categories.parquet
s3://meu-bucket/raw/ecommerce/ecommerce/products/products.parquet
...
```

---

## Azure Blob Storage

### Autenticação via connection string

```bash
docker compose run --rm \
  -e AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=..." \
  cli generate -d finance -f parquet \
  --upload azure \
  --bucket meu-container \
  --prefix datasets/finance/
```

### Resultado

```
meu-container/datasets/finance/finance/accounts/accounts.parquet
meu-container/datasets/finance/finance/transactions/transactions.parquet
...
```

---

## Upload + particionamento

Upload e particionamento Hive são combinados automaticamente. A estrutura de partições é replicada no bucket:

```bash
docker compose run --rm cli generate -d ecommerce -f parquet \
  --partition-by ordered_at \
  --upload gcs \
  --bucket meu-datalake \
  --prefix raw/ecommerce/ \
  --credentials /app/credentials/gcp-sa.json
```

Resultado:

```
gs://meu-datalake/raw/ecommerce/ecommerce/orders/ordered_at=2024-01-15/orders.parquet
gs://meu-datalake/raw/ecommerce/ecommerce/orders/ordered_at=2024-01-16/orders.parquet
...
```

---

## Upload em modo recorrente

Em modo recorrente, cada batch é carregado logo após ser gerado. Para Parquet/Avro, cada batch gera um arquivo com timestamp — todos ficam no bucket sem se sobrescrever:

```bash
docker compose run --rm \
  -e AWS_ACCESS_KEY_ID=AKIA... \
  -e AWS_SECRET_ACCESS_KEY=... \
  cli generate -d ecommerce \
    -t orders \
    -R 60 --count 24 \
    -f parquet \
    --upload s3 \
    --bucket meu-datalake \
    --prefix streaming/orders/
```

Resultado: 24 arquivos Parquet timestampados no S3.
