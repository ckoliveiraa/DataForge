# Modo Recorrente

O modo recorrente gera múltiplos batches de dados de forma contínua, simulando ingestão incremental ao longo do tempo.

---

## Casos de uso

- Testar pipelines de ingestão incremental
- Simular CDC (Change Data Capture)
- Popular bancos em batches para evitar pico de memória
- Gerar dados com progressão temporal realista

---

## Flags do modo recorrente

| Flag | Atalho | Padrão | Descrição |
|---|---|---|---|
| `--recurrence` | `-R` | — | Intervalo **em segundos** entre batches. Ativa o modo recorrente. |
| `--count` | — | `0` | Número de batches a gerar. `0` = infinito (Ctrl+C para parar). |

!!! warning "Semântica de `-R`"
    `-R 30` significa: gerar um batch, aguardar **30 segundos**, gerar o próximo. Não significa "30 batches". Use `--count` para limitar o número de batches.

---

## Configuração básica

```bash
# Gerar batches a cada 30 segundos, infinito (Ctrl+C para parar)
docker compose run --rm cli generate -d ecommerce -R 30 -f csv

# 10 batches com intervalo de 60 segundos entre cada um
docker compose run --rm cli generate -d ecommerce -R 60 --count 10 -f csv

# 5 batches sem espera entre eles (processamento em lote imediato)
docker compose run --rm cli generate -d finance -R 0 --count 5 -f parquet
```

---

## Comportamento por formato

| Formato | Batch 1 | Batch 2+ |
|---|---|---|
| CSV | Cria arquivo novo | **Append** ao mesmo arquivo |
| JSON flat (NDJSON) | Cria arquivo novo | **Append** ao mesmo arquivo |
| Parquet | Cria arquivo | Cria **novo arquivo com timestamp** |
| Avro | Cria arquivo | Cria **novo arquivo com timestamp** |

Parquet e Avro não suportam append nativo, então cada batch gera um arquivo separado:

```
output/
└── ecommerce/
    └── orders/
        ├── orders_20240115_143022.parquet   ← batch 1
        ├── orders_20240115_143052.parquet   ← batch 2
        └── orders_20240115_143122.parquet   ← batch 3
```

---

## Incrementos de coluna (`--increment`)

Use `--increment` para deslocar valores de uma coluna a cada batch. Isso permite simular progressão temporal ou IDs contínuos sem sobrescrever dados anteriores.

**Formato:** `tabela:coluna:passo[:unidade]`

**Unidades disponíveis:**

| Unidade | Descrição |
|---|---|
| `days` | Dias (padrão) |
| `hours` | Horas |
| `weeks` | Semanas |
| `months` | Meses (~30.44 dias) |
| `years` | Anos (~365.25 dias) |
| `value` | Incremento numérico direto |

O deslocamento aplicado é `passo × índice_do_batch` (batch 1 = índice 0, batch 2 = índice 1, etc.).

```bash
# Datas da coluna "ordered_at" avançam 7 dias a cada batch
docker compose run --rm cli generate -d ecommerce \
  -t orders \
  -R 0 --count 4 \
  --increment orders:ordered_at:7:days \
  -f parquet

# Valor numérico avança 100 por batch
docker compose run --rm cli generate -d ecommerce \
  -t orders \
  -R 5 --count 6 \
  --increment orders:total_amount:100:value \
  -f csv
```

!!! note "Múltiplos incrementos"
    `--increment` é repetível. Use um por coluna que deseja incrementar.

---

## IDs sequenciais em modo recorrente

Quando `dtype: int_seq` é usado, o gerador rastreia automaticamente o offset acumulado entre batches via `seq_offsets`. IDs nunca se repetem entre batches — **não é necessário usar `--increment` para colunas `int_seq`**.

---

## Modo recorrente com SQL

Em modo recorrente com `--db-url`:

- **Batch 1**: usa o valor de `--if-exists` (`replace` ou `append`)
- **Batches seguintes**: sempre usam `append`, preservando os dados anteriores

```bash
docker compose run --rm cli generate -d ecommerce \
  -R 0 --count 10 \
  --db-url "postgresql+psycopg2://admin:senha@localhost:5432/dwh" \
  --if-exists replace
```

---

## Exemplo: pipeline de streaming simulado

Simula 1 hora de pedidos gerados a cada 5 minutos (12 batches), com datas avançando 5 minutos por batch:

```bash
docker compose run --rm cli generate -d ecommerce \
  -t orders \
  -r 50 \
  -R 300 --count 12 \
  --increment orders:ordered_at:5:hours \
  -f parquet \
  -o /app/output/streaming
```

Resultado: 12 arquivos Parquet timestampados, cada um com 50 pedidos de datas diferentes.
