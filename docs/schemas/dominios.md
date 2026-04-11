# Domínios Prontos

O Dataforge inclui domínios relacionais pré-configurados. Use `--domain <nome>` no CLI ou selecione no seletor da interface visual.

## Domínios disponíveis

Os domínios padrão são implementados como classes Python em `src/dataforge/domains/` e seus schemas YAML ficam em `src/dataforge/schemas/`.

### E-commerce (`-d ecommerce`)

Dataset de loja virtual com clientes, produtos, pedidos e itens de pedido.

| Tabela | Linhas padrão | FK para |
|--------|---------------|---------|
| `categories` | 20 | — |
| `customers` | 500 | — |
| `products` | 200 | `categories.id` |
| `orders` | 1000 | `customers.id` |
| `order_items` | 3000 | `orders.id`, `products.id` |

```bash
docker compose run --rm cli generate -d ecommerce
docker compose run --rm cli schema-info ecommerce
```

### RH (`-d hr`)

Dataset de recursos humanos com departamentos, cargos, funcionários e salários.

| Tabela | Linhas padrão | FK para |
|--------|---------------|---------|
| `departments` | 10 | — |
| `job_titles` | 20 | — |
| `employees` | 300 | `departments.id`, `job_titles.id`, `employees.id` (auto-ref: gerente) |
| `salaries` | 300 | `employees.id` |

```bash
docker compose run --rm cli generate -d hr
docker compose run --rm cli schema-info hr
```

### Financeiro (`-d finance`)

Dataset financeiro com clientes, contas, categorias e transações.

| Tabela | Linhas padrão | FK para |
|--------|---------------|---------|
| `customers` | 500 | — |
| `categories` | 15 | — |
| `accounts` | 600 | `customers.id` |
| `transactions` | 5000 | `accounts.id`, `categories.id` |

```bash
docker compose run --rm cli generate -d finance
docker compose run --rm cli schema-info finance
```

## Schemas YAML adicionais

Além dos domínios padrão, o projeto inclui os seguintes schemas YAML em `src/dataforge/schemas/`:

| Arquivo | Domínio |
|---------|---------|
| `acoes.yaml` | Mercado de ações |
| `crm.yaml` | CRM / gestão de clientes |
| `ecommerce.yaml` | E-commerce (versão YAML) |
| `estoque.yaml` | Controle de estoque |
| `finance.yaml` | Financeiro (versão YAML) |
| `frota.yaml` | Gestão de frota de veículos |
| `manutencao.yaml` | Ordens de manutenção |
| `rh.yaml` | Recursos humanos (versão YAML) |

Para usar qualquer um desses schemas:

```bash
docker compose run --rm cli generate -d custom \
  -c /app/src/dataforge/schemas/crm.yaml \
  -f csv
```

Ou liste todos com:

```bash
docker compose run --rm cli list-domains
```

## FK auto-referenciada

O domínio `hr` demonstra FK auto-referenciada: `employees.manager_id` aponta para `employees.id`. O gerador preenche esse campo após gerar a tabela completa (o pool de PKs já está disponível no momento do preenchimento).

!!! tip "Criando domínios customizados"
    Para criar um domínio com dados em português, estrutura específica de negócio ou tipos de colunas não cobertos pelos domínios padrão, crie um arquivo YAML em `src/dataforge/schemas/` e use `--domain custom --config /app/src/dataforge/schemas/seu_arquivo.yaml`.
