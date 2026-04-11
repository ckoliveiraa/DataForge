# Modo Recorrente

O modo recorrente faz o gerador produzir batches de dados em intervalos regulares, simulando um pipeline de dados contínuo ou incremental.

## Ativando

Use a flag `-R` / `--recurrence` com o intervalo em segundos:

```bash
# Um batch a cada 30 segundos, indefinidamente
docker compose run --rm cli generate -d finance -f json -R 30

# Exatamente 10 batches com intervalo de 60 segundos
docker compose run --rm cli generate -d ecommerce -f parquet -R 60 --count 10
```

Para parar manualmente: `Ctrl+C`.

## Flags do modo recorrente

| Flag | Padrão | Descrição |
|------|--------|-----------|
| `--recurrence` / `-R` | — | Intervalo em segundos entre batches (ativa o modo) |
| `--count` | `0` | Número de batches (`0` = infinito) |

## Seed incremental

Quando `--seed` é usado com modo recorrente, o seed de cada batch é calculado como `seed + batch_index - 1`. Isso garante que cada batch produza dados diferentes mas determinísticos:

- Batch 1: seed = 42
- Batch 2: seed = 43
- Batch 3: seed = 44

## Continuidade de int_seq

Colunas com `dtype: int_seq` são contínuas entre batches. O gerador acumula o offset de linhas por tabela:

- Batch 1 (100 linhas): IDs 1 a 100
- Batch 2 (100 linhas): IDs 101 a 200
- Batch 3 (100 linhas): IDs 201 a 300

## Incremento de colunas (`--increment`)

A flag `--increment` desloca os valores de uma coluna a cada batch, simulando avanço temporal ou numérico:

```
--increment tabela:coluna:passo[:unidade]
```

### Unidades disponíveis

| Unidade | Descrição |
|---------|-----------|
| `days` | Dias (padrão) |
| `hours` | Horas |
| `weeks` | Semanas |
| `months` | Meses (≈ 30,44 dias) |
| `years` | Anos (≈ 365,25 dias) |
| `value` | Valor numérico puro |

### Exemplos

```bash
# Avança a coluna "created_at" 1 dia por batch
docker compose run --rm cli generate -d ecommerce -f parquet -R 10 \
  --increment "orders:created_at:1:days"

# Avança o valor de "amount" em 100 a cada batch
docker compose run --rm cli generate -d finance -f csv -R 5 \
  --increment "transactions:amount:100:value"

# Avança por hora
docker compose run --rm cli generate -d finance -f json -R 3 \
  --increment "transactions:created_at:1:hours"
```

O offset aplicado é `passo × (batch_index - 1)`, portanto o batch 1 tem offset zero.

## Comportamento de escrita por formato

| Formato | Batch 1 | Batches 2+ |
|---------|---------|-----------|
| CSV | Cria o arquivo | Append no mesmo arquivo |
| JSON flat | Cria o arquivo | Append no mesmo arquivo |
| Parquet | Cria `tabela.parquet` | Cria `tabela_YYYYMMDD_HHMMSS.parquet` |
| Avro | Cria `tabela.avro` | Cria `tabela_YYYYMMDD_HHMMSS.avro` |

## Comportamento SQL

- Batch 1: usa o valor de `--if-exists`
- Batches 2+: forçado para `append`

## Interface visual

O painel **Run Generator** da interface visual expõe o campo de intervalo de recorrência e número de batches. Os logs de execução aparecem em tempo real e o processo pode ser interrompido pelo botão de parada.

## Saída no terminal

```
Recurrence mode: interval=30.0s | batches=infinite | Ctrl+C to stop
------------------------------------------------------------

[Batch 1] 2024-01-15 10:00:00
  [csv] output/ecommerce/orders/orders.csv
  [csv] output/ecommerce/customers/customers.csv
  Aguardando 30.0s... (Ctrl+C para parar)

[Batch 2] 2024-01-15 10:00:30
  [csv/append] output/ecommerce/orders/orders.csv (+1000 rows)
  [csv/append] output/ecommerce/customers/customers.csv (+500 rows)
  Aguardando 30.0s... (Ctrl+C para parar)
```
