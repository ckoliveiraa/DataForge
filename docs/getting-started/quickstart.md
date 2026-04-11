# Quickstart

Cinco minutos para gerar seu primeiro dataset.

---

## 1. Subir a interface visual

```bash
docker compose up frontend
```

Acesse [http://localhost:5173](http://localhost:5173). O editor visual permite criar e editar schemas sem escrever YAML.

---

## 2. Listar domínios disponíveis

```bash
docker compose run --rm cli list-domains
```

```
ecommerce   Loja virtual com produtos, clientes, pedidos e pagamentos
hr          RH com departamentos, cargos, funcionários e salários
finance     Finanças com contas, transações e categorias
```

---

## 3. Inspecionar um domínio

```bash
docker compose run --rm cli schema-info -d ecommerce
```

```
Domain: ecommerce
  categories      (20 rows)   — id, name, description
  products        (200 rows)  — id, category_id*, name, price, stock_quantity
  customers       (500 rows)  — id, name, email, phone, city, country
  orders          (1000 rows) — id, customer_id*, status, created_at
  order_items     (3000 rows) — id, order_id*, product_id*, quantity, unit_price
  payments        (1000 rows) — id, order_id*, method, amount, paid_at
  reviews         (800 rows)  — id, product_id*, customer_id*, rating, comment

(*) chave estrangeira
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
    ├── categories.csv
    ├── products.csv
    ├── customers.csv
    ├── orders.csv
    ├── order_items.csv
    ├── payments.csv
    └── reviews.csv
```

---

## 5. Geração customizada

### Quantidade de linhas

```bash
# 5000 pedidos e 15000 itens de pedido
docker compose run --rm cli generate \
  -d ecommerce \
  -r orders=5000 \
  -r order_items=15000 \
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
# Usar um YAML próprio
docker compose run --rm cli generate \
  -c /app/schemas/meu_schema.yaml \
  -f csv
```

---

## Próximos passos

- [Interface Visual](../usage/frontend.md) — editar schemas graficamente
- [Referência do CLI](../usage/cli.md) — todas as opções disponíveis
- [Schemas Customizados](../usage/schemas.md) — criar seu próprio schema YAML
- [Upload para Nuvem](../advanced/cloud-upload.md) — enviar para GCS, S3 ou Azure
