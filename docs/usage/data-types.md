# Tipos de Dados

Dataforge oferece tipos nativos mapeados para geradores do Faker, além de suporte a qualquer método Faker via `faker_provider`.

---

## Tipos disponíveis

### Identificadores

| dtype | Descrição | Suporte min/max | Exemplo |
|---|---|---|---|
| `uuid` | UUID v4 aleatório | Não | `3f2504e0-4f89-11d3-9a0c-0305e82c3301` |
| `int_seq` | Inteiro sequencial a partir de 1 | Não | `1, 2, 3, …` |

### Numéricos

| dtype | Descrição | Suporte min/max | Padrão |
|---|---|---|---|
| `int` | Inteiro aleatório | Sim | 0 – 100.000 |
| `float` | Float com 2 casas decimais | Sim | 0.0 – 10.000.0 |
| `bool` | Booleano | Não | `True` / `False` |

### Texto

| dtype | Descrição | Suporte min/max |
|---|---|---|
| `str` | Palavra aleatória | Não |
| `text` | Frase aleatória | Não |
| `name` | Nome completo | Não |
| `email` | Endereço de e-mail | Não |
| `phone` | Número de telefone | Não |
| `address` | Endereço completo (sem quebras de linha) | Não |
| `city` | Nome de cidade | Não |
| `country` | Nome de país | Não |
| `company` | Nome de empresa | Não |
| `url` | URL | Não |

### Data/Hora

| dtype | Descrição | min/max | Padrão |
|---|---|---|---|
| `date` | Data em formato ISO (`YYYY-MM-DD`) | Sim | -3 anos até hoje |

### Financeiro

| dtype | Descrição | Exemplo |
|---|---|---|
| `currency` | Código de moeda ISO 4217 | `BRL`, `USD`, `EUR` |
| `iban` | Número IBAN | `GB29NWBK60161331926819` |

---

## Valores enumerados (`choices`)

Qualquer coluna pode ter seu conjunto de valores restrito com `choices`:

```yaml
status:
  dtype: str
  choices: [ativo, inativo, suspenso]

rating:
  dtype: int
  choices: [1, 2, 3, 4, 5]
```

---

## Faker Provider customizado

Acesse qualquer método do objeto `Faker` via `faker_provider`. O `dtype` ainda é necessário para tipagem interna, mas o valor gerado vem do provider:

```yaml
# Métodos de localidade (funciona com qualquer locale do Faker)
cpf:
  dtype: str
  faker_provider: cpf

cor_hex:
  dtype: str
  faker_provider: hex_color

isbn:
  dtype: str
  faker_provider: isbn13

latitude:
  dtype: float
  faker_provider: latitude

longitude:
  dtype: float
  faker_provider: longitude

user_agent:
  dtype: str
  faker_provider: user_agent

ipv4:
  dtype: str
  faker_provider: ipv4
```

Para explorar todos os providers disponíveis, consulte a [documentação do Faker](https://faker.readthedocs.io/en/master/providers.html).

---

## Controle de nulos

Use `nullable` com um valor entre `0.0` e `1.0` para definir a proporção de nulos:

```yaml
telefone:
  dtype: phone
  nullable: 0.2   # 20% nulos

descricao:
  dtype: text
  nullable: 0.5   # 50% nulos
```

---

## Intervalos para tipos numéricos e datas

```yaml
idade:
  dtype: int
  min: 18
  max: 80

preco:
  dtype: float
  min: 0.01
  max: 9999.99

data_nascimento:
  dtype: date
  min: "1940-01-01"
  max: "2005-12-31"
```
