# Tipos de Dados (dtype)

O campo `dtype` de cada coluna define o tipo de dado gerado. Os tipos são resolvidos pelo `FAKER_REGISTRY` em `src/dataforge/core/registry.py`.

## Tabela de dtypes

| dtype | Descrição | Suporta `min`/`max` | Padrão de range |
|-------|-----------|---------------------|-----------------|
| `int_seq` | Inteiro sequencial (1, 2, 3...) — ideal para PKs | Não | — |
| `uuid` | UUID v4 | Não | — |
| `int` | Inteiro aleatório | Sim | 0 – 100.000 |
| `float` | Float com 2 casas decimais | Sim | 0 – 10.000 |
| `str` | Palavra genérica | Não | — |
| `bool` | Booleano (`True`/`False`) | Não | — |
| `date` | Data aleatória em formato ISO (`YYYY-MM-DD`) | Sim | Últimos 3 anos até hoje |
| `name` | Nome completo | Não | — |
| `email` | Endereço de e-mail | Não | — |
| `phone` | Número de telefone | Não | — |
| `address` | Endereço completo (sem quebras de linha) | Não | — |
| `city` | Cidade | Não | — |
| `country` | País | Não | — |
| `company` | Nome de empresa | Não | — |
| `text` | Frase/sentença | Não | — |
| `url` | URL | Não | — |
| `currency` | Código de moeda (ex: `BRL`, `USD`) | Não | — |
| `iban` | IBAN bancário | Não | — |

## Detalhes de implementação

### `int_seq`

Gera sequência inteira a partir de `seq_start` (padrão: 1). Em modo recorrente, o offset é acumulado entre batches para garantir continuidade.

```python
list(range(seq_start, seq_start + n))
```

### `int`

```python
faker.random_int(min=int(min_value), max=int(max_value))
```

### `float`

```python
round(faker.pyfloat(min_value=float(min_value), max_value=float(max_value)), 2)
```

### `date`

Aceita strings ISO (`"2020-01-01"`) ou notação relativa do Faker (`"-6m"`, `"-3y"`, `"today"`).

```python
faker.date_between(start_date=min_value, end_date=max_value).isoformat()
```

### `address`

As quebras de linha do endereço Faker são substituídas por vírgulas:

```python
faker.address().replace("\n", ", ")
```

## Usando `faker_provider`

Para qualquer método do Faker não listado acima, use `faker_provider`:

```yaml
cep:
  dtype: str
  faker_provider: postcode

iban:
  dtype: str
  faker_provider: iban

placa:
  dtype: str
  faker_provider: license_plate
```

!!! note "Prioridade"
    Quando `faker_provider` está definido, ele tem prioridade absoluta sobre `dtype`. O campo `dtype` é necessário para o parser, mas o valor gerado vem do método Faker especificado.

## Usando `choices`

Para valores fixos (enum), use `choices`:

```yaml
status:
  dtype: str
  choices:
    - ativo
    - inativo
    - pendente

tier:
  dtype: str
  choices:
    - bronze
    - silver
    - gold
    - platinum
```

Os valores são sorteados aleatoriamente com reposição.

## Combinando `choices` com `nullable`

```yaml
categoria:
  dtype: str
  nullable: 0.1
  choices:
    - A
    - B
    - C
```

10% dos valores serão nulos; os 90% restantes serão sorteados de `choices`.

## Exemplos práticos

```yaml
# Chave primária sequencial
id:
  dtype: int_seq
  primary_key: true

# Identificador único
uuid:
  dtype: uuid

# Rating de 1 a 5
rating:
  dtype: int
  min: 1
  max: 5

# Percentual de desconto
desconto:
  dtype: float
  min: 0
  max: 1

# Data de criação nos últimos 2 anos
criado_em:
  dtype: date
  min: "-2y"
  max: "today"

# Status com valores fixos
status:
  dtype: str
  choices:
    - ativo
    - inativo

# Campo opcional (20% nulo)
observacao:
  dtype: text
  nullable: 0.2

# Código postal via Faker
cep:
  dtype: str
  faker_provider: postcode
```
