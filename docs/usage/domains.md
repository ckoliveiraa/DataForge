# Domínios Prontos

Dataforge inclui domínios pré-construídos que geram conjuntos de tabelas relacionais sem necessidade de escrever YAML.

```bash
# Listar schemas YAML disponíveis
docker compose run --rm cli list-domains

# Inspecionar um domínio pré-definido
docker compose run --rm cli schema-info ecommerce
```

!!! note "`list-domains` vs `schema-info`"
    `list-domains` lista os arquivos YAML em `src/dataforge/schemas/`. `schema-info` inspeciona os domínios pré-definidos em código (`ecommerce`, `hr`, `finance`). São conjuntos diferentes.

---

## ecommerce

Loja virtual com 5 tabelas e ~4720 linhas no total.

```
categories (20)
    └── products (200)
            └── order_items (3000)
customers (500)
    └── orders (1000)
            └── order_items (3000)
```

| Tabela | Linhas padrão | Colunas principais | FK para |
|---|---|---|---|
| `categories` | 20 | id (PK), name, description | — |
| `customers` | 500 | id (PK), name, email, phone, city, country, created_at | — |
| `products` | 200 | id (PK), name, price, stock_quantity, category_id | `categories.id` |
| `orders` | 1000 | id (PK), customer_id, status, total_amount, ordered_at | `customers.id` |
| `order_items` | 3000 | id (PK), order_id, product_id, quantity, unit_price | `orders.id`, `products.id` |

```bash
docker compose run --rm cli generate -d ecommerce -f csv
```

---

## hr

Recursos humanos com hierarquia de funcionários (auto-referência em `manager_id`).

```
departments (10)
    └── employees (300)
job_titles (20)
    └── employees (300)
employees (300) ← manager_id referencia a própria tabela (nullable 10%)
    └── salaries (300)
```

| Tabela | Linhas padrão | Colunas principais | FK para |
|---|---|---|---|
| `departments` | 10 | id (PK), name, location | — |
| `job_titles` | 20 | id (PK), title, level | — |
| `employees` | 300 | id (PK), name, email, hire_date, department_id, job_title_id, manager_id | `departments.id`, `job_titles.id`, `employees.id` |
| `salaries` | 300 | id (PK), employee_id, amount, currency, effective_date | `employees.id` |

```bash
docker compose run --rm cli generate -d hr -f parquet
```

---

## finance

Sistema financeiro com contas e transações.

```
customers (500)
    └── accounts (600)
categories (15)
    └── transactions (5000)
accounts (600)
    └── transactions (5000)
```

| Tabela | Linhas padrão | Colunas principais | FK para |
|---|---|---|---|
| `customers` | 500 | id (PK), name, email, country, created_at | — |
| `categories` | 15 | id (PK), name, type | — |
| `accounts` | 600 | id (PK), customer_id, iban, currency, balance, opened_at | `customers.id` |
| `transactions` | 5000 | id (PK/uuid), account_id, category_id, amount, type, description, transacted_at | `accounts.id`, `categories.id` |

```bash
docker compose run --rm cli generate -d finance -f parquet
```

---

## Schemas YAML prontos

Os arquivos abaixo estão em `src/dataforge/schemas/` e podem ser usados com `-d custom -c`:

| Arquivo | Domínio representado |
|---|---|
| `acoes.yaml` | Mercado de ações |
| `crm.yaml` | CRM — gestão de clientes e oportunidades |
| `ecommerce.yaml` | E-commerce (versão YAML do domínio pré-definido) |
| `estoque.yaml` | Controle de estoque e movimentações |
| `finance.yaml` | Financeiro (versão YAML do domínio pré-definido) |
| `frota.yaml` | Gestão de frota de veículos |
| `manutencao.yaml` | Ordens de manutenção |
| `rh.yaml` | RH (versão YAML do domínio pré-definido) |

```bash
# Gerar a partir de um schema YAML
docker compose run --rm cli generate \
  -d custom -c /app/src/dataforge/schemas/crm.yaml -f parquet
```
