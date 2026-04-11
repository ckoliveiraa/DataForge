# Quickstart

Cinco minutos para gerar seu primeiro dataset.

---

## 1. Subir a interface visual

```bash
docker compose up frontend -d
```

Acesse [http://localhost:5173](http://localhost:5173). O editor visual permite criar e editar schemas sem escrever YAML.

---

## 2. Listar schemas disponíveis

```bash
docker compose run --rm cli list-domains
```

Saída:

```
  acoes
  crm
  ecommerce
  estoque
  finance
  frota
  manutencao
  rh
```

---

## 3. Inspecionar um domínio

`schema-info` recebe o nome do domínio como argumento posicional:

```bash
docker compose run --rm cli schema-info ecommerce
```

Saída:

```
Domain: ecommerce

  Table: categories  (default rows: 20)
    id: int_seq  [PK]
    name: str
    description: text  [nullable=0.2]

  Table: products  (default rows: 200)
    id: int_seq  [PK]
    name: str
    price: float
    stock_quantity: int
    category_id: int  [FK->categories.id]

  Table: customers  (default rows: 500)
    ...
```

---

## 4. Gerar seu primeiro dataset

```bash
docker compose run --rm cli generate -d ecommerce -f csv
```

Os arquivos são criados em `./output/ecommerce/`:

```
output/
└── ecommerce/
    ├── categories/
    │   └── categories.csv
    ├── products/
    │   └── products.csv
    ├── customers/
    │   └── customers.csv
    ├── orders/
    │   └── orders.csv
    └── order_items/
        └── order_items.csv
```

---

## 5. Geração customizada

### Sobrescrever quantidade de linhas (todas as tabelas)

```bash
# 500 linhas em todas as tabelas
docker compose run --rm cli generate \
  -d ecommerce \
  -r 500 \
  -f parquet
```

### Tabela específica

```bash
# Apenas clientes, 10k linhas, formato JSON
docker compose run --rm cli generate \
  -d ecommerce \
  -t customers \
  -r 10000 \
  -f json
```

### Schema customizado

```bash
# Usar um YAML próprio salvo em src/dataforge/schemas/
docker compose run --rm cli generate \
  -d custom -c /app/src/dataforge/schemas/crm.yaml \
  -f csv
```

---

## Próximos passos

- [Interface Visual](../usage/frontend.md) — editar schemas graficamente
- [Referência do CLI](../usage/cli.md) — todas as opções disponíveis
- [Schemas Customizados](../usage/schemas.md) — criar seu próprio schema YAML
- [Upload para Nuvem](../advanced/cloud-upload.md) — enviar para GCS, S3 ou Azure
