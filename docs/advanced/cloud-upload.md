# Upload para Nuvem

Dataforge pode fazer upload dos arquivos gerados diretamente para GCS, S3 ou Azure Blob Storage, sem gravar localmente.

---

## Google Cloud Storage (GCS)

### Autenticação

Monte o arquivo de Service Account no container:

```yaml
# docker-compose.yml (já configurado)
volumes:
  - ./credentials:/app/credentials
```

```bash
# Copie sua SA key para a pasta credentials/
cp ~/minha-sa-key.json ./credentials/gcp-sa.json
```

Configure a variável de ambiente:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/gcp-sa.json
```

Ou passe no `docker compose run`:

```bash
docker compose run --rm \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/gcp-sa.json \
  cli generate -d ecommerce -f parquet \
  --gcs-bucket meu-datalake \
  --gcs-prefix raw/ecommerce
```

### Resultado

```
gs://meu-datalake/raw/ecommerce/categories.parquet
gs://meu-datalake/raw/ecommerce/products.parquet
gs://meu-datalake/raw/ecommerce/customers.parquet
...
```

---

## Amazon S3

### Autenticação

Use variáveis de ambiente padrão AWS:

```bash
docker compose run --rm \
  -e AWS_ACCESS_KEY_ID=AKIA... \
  -e AWS_SECRET_ACCESS_KEY=... \
  -e AWS_DEFAULT_REGION=us-east-1 \
  cli generate -d ecommerce -f parquet \
  --s3-bucket meu-bucket \
  --s3-prefix raw/ecommerce
```

Ou monte o arquivo `~/.aws/credentials`:

```yaml
volumes:
  - ~/.aws:/root/.aws:ro
```

### Resultado

```
s3://meu-bucket/raw/ecommerce/categories.parquet
s3://meu-bucket/raw/ecommerce/products.parquet
...
```

---

## Azure Blob Storage

### Autenticação

Use a connection string da conta de armazenamento:

```bash
docker compose run --rm \
  -e AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=..." \
  cli generate -d ecommerce -f parquet \
  --azure-container meu-container \
  --azure-prefix raw/ecommerce
```

### Resultado

```
meu-container/raw/ecommerce/categories.parquet
meu-container/raw/ecommerce/products.parquet
...
```

---

## Upload + particionamento

Upload e particionamento Hive são combinados automaticamente:

```bash
dataset-gen generate -d ecommerce \
  -f parquet \
  --partition-by created_at \
  --gcs-bucket meu-datalake \
  --gcs-prefix raw/ecommerce
```

Resultado:

```
gs://meu-datalake/raw/ecommerce/orders/created_at=2024-01-15/orders.parquet
gs://meu-datalake/raw/ecommerce/orders/created_at=2024-01-16/orders.parquet
```

---

## Upload em modo recorrente

```bash
# 24 batches → 24 arquivos Parquet timestampados no GCS
dataset-gen generate -d ecommerce \
  -t orders \
  -R 24 \
  --interval 3600 \
  -f parquet \
  --gcs-bucket meu-datalake \
  --gcs-prefix streaming/orders
```
