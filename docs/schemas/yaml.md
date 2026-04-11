# Schema YAML Customizado

O schema YAML é o formato central do Dataforge. Ele descreve as tabelas, colunas, tipos de dados e relações que o gerador usará para produzir os datasets.

## Estrutura do arquivo

```yaml
domain: nome_do_dominio

tables:
  nome_da_tabela:
    rows: 1000
    columns:
      nome_da_coluna:
        dtype: str
        # ... outros campos
```

## Estrutura mínima funcional

```yaml
domain: biblioteca

tables:
  autores:
    rows: 50
    columns:
      id:
        dtype: int_seq
        primary_key: true
      nome:
        dtype: name
      email:
        dtype: email

  livros:
    rows: 200
    columns:
      id:
        dtype: int_seq
        primary_key: true
      titulo:
        dtype: str
      preco:
        dtype: float
        min: 10
        max: 300
      publicado_em:
        dtype: date
        min: "2000-01-01"
        max: "today"
      autor_id:
        dtype: int
        foreign_key:
          table: autores
          column: id
      ativo:
        dtype: bool
      descricao:
        dtype: text
        nullable: 0.3
```

## Campos suportados por coluna

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `dtype` | string | Sim | Tipo de dado (ver tabela de dtypes) |
| `primary_key` | bool | Não | Marca a coluna como chave primária |
| `nullable` | float (0–1) | Não | Proporção de valores nulos (ex: `0.2` = 20% nulos) |
| `min` | number / string | Não | Valor mínimo para `int`, `float` ou `date` |
| `max` | number / string | Não | Valor máximo para `int`, `float` ou `date` |
| `foreign_key.table` | string | — | Tabela referenciada pela FK |
| `foreign_key.column` | string | — | Coluna referenciada pela FK |
| `faker_provider` | string | Não | Qualquer método do Faker (ex: `postcode`, `iban`) |
| `choices` | lista | Não | Lista de valores fixos para sortear |

## Chave estrangeira

```yaml
order_id:
  dtype: int
  foreign_key:
    table: orders
    column: id
```

O gerador valida as FKs na carga do schema: se a tabela ou coluna referenciada não existir, um erro é lançado antes da geração.

## Valores nulos

```yaml
observacao:
  dtype: text
  nullable: 0.3   # 30% dos valores serão nulos
```

## Valores fixos com choices

```yaml
status:
  dtype: str
  choices:
    - pending
    - processing
    - shipped
    - delivered
    - cancelled
```

## Range de valores

```yaml
# Inteiro entre 1 e 5
rating:
  dtype: int
  min: 1
  max: 5

# Float entre 0.0 e 1.0
desconto:
  dtype: float
  min: 0
  max: 1

# Data entre 2020 e hoje
data_contrato:
  dtype: date
  min: "2020-01-01"
  max: "today"

# Data dos últimos 6 meses (notação relativa do Faker)
data_recente:
  dtype: date
  min: "-6m"
  max: "today"
```

## Override de domínio existente

Para ajustar apenas o número de linhas de um domínio pronto, crie um YAML com o mesmo nome do domínio e liste apenas as tabelas que deseja sobrescrever:

```yaml
domain: ecommerce

tables:
  customers:
    rows: 200
  orders:
    rows: 500
  order_items:
    rows: 1500
# Tabelas não listadas usam os defaults do domínio
```

Use com:

```bash
docker compose run --rm cli generate -d ecommerce \
  -c /app/src/dataforge/schemas/meu_override.yaml
```

## Onde salvar os schemas

Salve os arquivos `.yaml` em `src/dataforge/schemas/`. Essa pasta é montada como volume no container, portanto os arquivos ficam disponíveis imediatamente sem rebuild.

## Validação de FKs

O loader valida todas as FKs ao carregar o schema. Erros detectados:

- Tabela referenciada não existe no schema → `FK error in 'tabela.coluna': table 'X' not found`
- Coluna referenciada não existe na tabela → `FK error in 'tabela.coluna': column 'Y' not found in 'X'`
