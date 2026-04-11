# Domínios Prontos

Dataforge inclui domínios pré-construídos que podem ser usados diretamente, sem necessidade de escrever YAML.

```bash
dataset-gen list-domains
dataset-gen schema-info -d <dominio>
```

---

## ecommerce

Loja virtual completa com 7 tabelas e ~5500 linhas no total.

```
categories (20)
    └── products (200)
            └── order_items (3000)
customers (500)
    └── orders (1000)
            ├── order_items (3000)
            └── payments (1000)
products (200)
    └── reviews (800)
customers (500)
    └── reviews (800)
```

| Tabela | Linhas | Descrição |
|---|---|---|
| `categories` | 20 | Categorias de produto |
| `products` | 200 | Produtos com preço e estoque |
| `customers` | 500 | Clientes com dados de contato |
| `orders` | 1000 | Pedidos com status |
| `order_items` | 3000 | Itens de pedido |
| `payments` | 1000 | Pagamentos com método e valor |
| `reviews` | 800 | Avaliações de produto |

---

## hr

Recursos humanos com hierarquia de funcionários (auto-referência).

```
departments (10)
    └── employees (300)
job_titles (20)
    └── employees (300)
employees (300)  ← manager_id referencia a própria tabela
    └── salaries (300)
```

| Tabela | Linhas | Descrição |
|---|---|---|
| `departments` | 10 | Departamentos |
| `job_titles` | 20 | Cargos |
| `employees` | 300 | Funcionários com `manager_id` auto-referencial |
| `salaries` | 300 | Histórico salarial |

---

## finance

Sistema financeiro com contas e transações.

| Tabela | Linhas | Descrição |
|---|---|---|
| `customers` | 200 | Clientes |
| `categories` | 15 | Categorias de transação |
| `accounts` | 400 | Contas bancárias |
| `transactions` | 2000 | Transações com valor e data |

---

## Outros schemas disponíveis

Os arquivos YAML abaixo estão em `src/dataforge/schemas/` e podem ser usados com `-c`:

| Schema | Domínio |
|---|---|
| `acoes.yaml` | Mercado de ações |
| `crm.yaml` | CRM — gestão de clientes e oportunidades |
| `estoque.yaml` | Controle de estoque e movimentações |
| `frota.yaml` | Gestão de frota de veículos |
| `manutencao.yaml` | Ordens de manutenção |
| `transacoes.yaml` | Transações financeiras |

```bash
docker compose run --rm cli generate \
  -c /app/schemas/crm.yaml -f parquet
```

!!! tip "Combinar schemas"
    Use `-c` com múltiplos arquivos para mesclar domínios. As tabelas são combinadas e as FKs entre domínios são resolvidas normalmente.
