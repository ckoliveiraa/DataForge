# Formatos de Saída

O Dataforge suporta quatro formatos de saída. Use a flag `-f` / `--format` para especificar. A flag é repetível para gerar múltiplos formatos na mesma execução.

## Formatos disponíveis

| Flag | Formato | Extensão | Notas |
|------|---------|----------|-------|
| `-f csv` | CSV UTF-8 | `.csv` | Padrão; compatível universalmente |
| `-f json` | JSON linha a linha (NDJSON) | `.json` | Use `--json-mode nested` para aninhar filhos nos pais |
| `-f parquet` | Parquet com compressão Snappy | `.parquet` | Requer extra `parquet` (`pyarrow>=16`) |
| `-f avro` | Avro com schema inferido | `.avro` | Requer extra `avro` (`fastavro>=1.9`) |

## Múltiplos formatos

```bash
docker compose run --rm cli generate -d ecommerce -f csv -f json -f parquet
```

## Layout de saída

Os arquivos são organizados por domínio e tabela:

```
output/
└── ecommerce/
    ├── categories/
    │   └── categories.csv
    ├── customers/
    │   └── customers.csv
    ├── products/
    │   └── products.csv
    ├── orders/
    │   └── orders.csv
    └── order_items/
        └── order_items.csv
```

## CSV

- Codificação: UTF-8
- Sem índice (coluna de índice Pandas não incluída)
- Separador: vírgula
- Modo recorrente: CSV é **acumulado** (append) nos batches seguintes ao primeiro

## JSON

Dois modos disponíveis via `--json-mode`:

### flat (padrão)

Cada registro em uma linha separada (NDJSON — newline-delimited JSON):

```json
{"id": 1, "name": "Alice", "email": "alice@example.com"}
{"id": 2, "name": "Bob", "email": "bob@example.com"}
```

### nested

Registros aninhados: filhos são incorporados dentro dos pais. Usa o `JsonWriter` interno para construir a estrutura hierárquica.

```json
[
  {
    "id": 1,
    "name": "Alice",
    "orders": [
      { "id": 101, "status": "delivered" }
    ]
  }
]
```

!!! note "JSON e modo recorrente"
    No modo flat, o JSON também é acumulado (append) nos batches seguintes ao primeiro, igual ao CSV. No modo nested, cada batch gera um arquivo com timestamp.

## Parquet

- Compressão: Snappy
- Schema: inferido pelo PyArrow a partir do DataFrame Pandas
- Modo recorrente: cada batch gera um arquivo com timestamp (`tabela_YYYYMMDD_HHMMSS.parquet`)

## Avro

- Schema: inferido automaticamente com mapeamento de tipos:
  - `int64` → `long`
  - `float64` → `double`
  - `bool` → `boolean`
  - demais → `string`
- Todos os campos são opcionais (`["null", tipo]`) com `default: null`
- Modo recorrente: cada batch gera um arquivo com timestamp
