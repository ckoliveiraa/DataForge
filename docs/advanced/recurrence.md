# Modo Recorrente

O modo recorrente gera múltiplos batches de dados de forma contínua, simulando ingestão incremental de dados ao longo do tempo.

---

## Casos de uso

- Testar pipelines de ingestão incremental
- Simular CDC (Change Data Capture)
- Popular bancos em batches para evitar lock de memória
- Gerar dados com progressão temporal realista

---

## Configuração básica

```bash
# Gerar 10 batches, um imediatamente após o outro
dataset-gen generate -d ecommerce -R 10 -f csv

# 24 batches com intervalo de 1 hora entre cada um
dataset-gen generate -d ecommerce -R 24 --interval 3600 -f csv
```

---

## Comportamento por formato

| Formato | Batch 1 | Batch 2+ |
|---|---|---|
| CSV | Cria arquivo novo | **Append** ao arquivo existente |
| JSON flat (NDJSON) | Cria arquivo novo | **Append** ao arquivo existente |
| Parquet | Cria arquivo | Cria novo arquivo com timestamp |
| Avro | Cria arquivo | Cria novo arquivo com timestamp |

Parquet e Avro não são appendáveis nativamente, então cada batch gera um arquivo separado com sufixo de timestamp:

```
output/ecommerce/orders_20240115_143022.parquet
output/ecommerce/orders_20240115_153022.parquet
```

---

## Incrementos de coluna

Use `--increment` para que colunas numéricas avancem a cada batch, evitando IDs duplicados e criando progressão temporal:

```
--increment tabela:coluna:passo
```

```bash
# IDs de pedidos avançam 1000 a cada batch
# IDs de itens avançam 5000 a cada batch
dataset-gen generate -d ecommerce \
  -t orders -t order_items \
  -R 10 \
  --increment orders:id:1000 \
  --increment order_items:id:5000 \
  -f csv
```

No batch 1, `orders.id` vai de 1 a 1000.
No batch 2, vai de 1001 a 2000. E assim por diante.

---

## Progressão de datas

Combine `--increment` com colunas do tipo `date` para simular dados com datas crescentes:

```yaml
# schema.yaml
tables:
  eventos:
    rows: 500
    columns:
      id:
        dtype: int_seq
        primary_key: true
      timestamp_evento:
        dtype: date
        min: "2024-01-01"
        max: "2024-01-07"
```

```bash
# Cada batch representa uma semana diferente
dataset-gen generate -c /app/schemas/schema.yaml \
  -R 52 \
  --increment eventos:id:500 \
  -f parquet
```

---

## Exemplo: pipeline de streaming simulado

```bash
# Simula 1 hora de eventos com batches de 1 minuto
dataset-gen generate -d ecommerce \
  -t orders -t payments \
  -r orders=100 \
  -r payments=100 \
  -R 60 \
  --interval 60 \
  --increment orders:id:100 \
  --increment payments:id:100 \
  -f csv \
  -o /app/output/streaming
```

---

## IDs sequenciais em modo recorrente

Quando `dtype: int_seq` é usado, o gerador rastreia o offset acumulado entre batches (`seq_offsets`). IDs nunca se repetem entre batches automaticamente — não é necessário usar `--increment` para colunas `int_seq`.
