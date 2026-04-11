# Upload em Nuvem

O Dataforge pode fazer upload dos arquivos gerados diretamente para Google Cloud Storage, Amazon S3 ou Azure Blob Storage.

!!! note "Arquivos locais preservados"
    Os arquivos sempre são escritos em `output/` localmente, mesmo quando o upload está ativo. O upload é uma cópia adicional para a nuvem.

## Google Cloud Storage

### Requisitos

Extra `gcp` instalado (incluído na imagem Docker padrão).

### Autenticação

Coloque o arquivo de service account JSON na pasta `credentials/` do projeto. Ela é montada no container em `/app/credentials/`.

### Comando

```bash
docker compose run --rm cli generate -d ecommerce -f parquet \
  --upload gcs \
  --bucket meu-bucket \
  --prefix raw/ecommerce/ \
  --credentials /app/credentials/service-account.json
```

### Parâmetros

| Flag | Valor de exemplo | Descrição |
|------|-----------------|-----------|
| `--upload` | `gcs` | Ativa o upload para GCS |
| `--bucket` | `meu-bucket` | Nome do bucket |
| `--prefix` | `raw/ecommerce/` | Prefixo/pasta dentro do bucket |
| `--credentials` | `/app/credentials/sa.json` | Caminho do arquivo de credenciais |

## Amazon S3

### Requisitos

Extra `aws` instalado (incluído na imagem Docker padrão).

### Autenticação

Passe as credenciais via variáveis de ambiente:

```bash
docker compose run --rm \
  -e AWS_ACCESS_KEY_ID=AKIA... \
  -e AWS_SECRET_ACCESS_KEY=... \
  cli generate -d hr -f csv \
  --upload s3 \
  --bucket meu-bucket \
  --prefix data/hr/
```

Ou adicione as variáveis no serviço `cli` do `docker-compose.yml`.

## Azure Blob Storage

### Requisitos

Extra `azure` instalado (incluído na imagem Docker padrão).

### Autenticação

Passe a connection string via variável de ambiente:

```bash
docker compose run --rm \
  -e AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net" \
  cli generate -d finance -f parquet \
  --upload azure \
  --bucket meu-container \
  --prefix datasets/finance/
```

## Caminho de destino

O caminho completo de cada arquivo no bucket é construído como:

```
{prefix}/{dominio}/{tabela}/{arquivo}
```

Exemplo com `--prefix raw/ecommerce/` e domínio `ecommerce`:

```
raw/ecommerce/ecommerce/orders/orders.parquet
```

Com particionamento `--partition-by "orders:status"`:

```
raw/ecommerce/ecommerce/orders/status=delivered/orders.parquet
```

## Upload com modo recorrente

Em modo recorrente, cada batch faz upload dos arquivos gerados naquele batch. Para Parquet e Avro, cada batch gera arquivos com timestamp — portanto cada batch resulta em novos objetos no bucket. Para CSV e JSON (append), o arquivo acumulado é re-enviado a cada batch.
