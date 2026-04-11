# Catálogo Faker

O **Faker Browser** é um painel de busca visual com todos os métodos do Faker disponíveis na interface. Ele permite explorar e aplicar provedores de dados diretamente às colunas do schema.

## Acessando

Clique no botão **Faker Browser** na barra de ações. O painel lateral é aberto com campo de busca e listagem por categoria.

## Como usar

1. Abra o Faker Browser.
2. Use o campo de busca para filtrar métodos pelo nome.
3. Clique em um método para aplicá-lo à coluna selecionada no editor.

O método selecionado é gravado no campo `faker_provider` da coluna. No YAML gerado, aparece como:

```yaml
columns:
  telefone:
    dtype: str
    faker_provider: phone_number
```

## Categorias disponíveis

### Person

| Método | Exemplo |
|--------|---------|
| `name` | John Smith |
| `first_name` | John |
| `last_name` | Smith |
| `name_female` | Jane Doe |
| `name_male` | James Doe |
| `prefix` | Mr. |
| `suffix` | Jr. |

### Internet

| Método | Exemplo |
|--------|---------|
| `email` | user@example.com |
| `safe_email` | user@example.org |
| `free_email` | user@gmail.com |
| `user_name` | john_doe42 |
| `domain_name` | example.com |
| `url` | https://example.com/path |
| `slug` | my-blog-post |
| `ipv4` | 192.168.1.1 |
| `ipv6` | 2001:db8::1 |
| `mac_address` | 00:1A:2B:3C:4D:5E |
| `http_method` | GET |
| `http_status_code` | 200 |
| `password` | xK9#mP2! |
| `hostname` | srv-01.example.com |
| `tld` | .com |

### Address

| Método | Exemplo |
|--------|---------|
| `address` | 123 Main St, Springfield |
| `street_address` | 123 Main St |
| `street_name` | Main Street |
| `city` | Springfield |
| `postcode` | 12345 |
| `country` | United States |
| `country_code` | US |
| `building_number` | 42 |

### Phone

| Método | Exemplo |
|--------|---------|
| `phone_number` | +1-555-123-4567 |
| `msisdn` | 14155552671 |
| `country_calling_code` | +1 |

### Company

| Método | Exemplo |
|--------|---------|
| `company` | Acme Corp |
| `company_suffix` | LLC |
| `catch_phrase` | Seamless synergy solutions |
| `bs` | leverage core competencies |
| `job` | Software Engineer |

### Finance

| Método | Exemplo |
|--------|---------|
| `iban` | GB82WEST12345698765432 |
| `bban` | 20-00-55 73553400 |
| `bank` | Royal Bank |
| `swift` | BOFAUS3N |
| `currency_code` | USD |
| `currency_name` | US Dollar |
| `currency_symbol` | $ |
| `cryptocurrency_code` | BTC |
| `pricetag` | $12.99 |

### Date / Time

| Método | Exemplo |
|--------|---------|
| `date` | 2023-04-15 |
| `date_of_birth` | 1990-07-22 |
| `past_date` | 2022-01-10 |
| `future_date` | 2025-09-30 |
| `iso8601` | 2023-04-15T10:30:00 |
| `time` | 14:30:00 |
| `year` | 2023 |
| `month` | 04 |
| `month_name` | April |
| `day_of_week` | Monday |
| `timezone` | America/New_York |
| `unix_time` | 1681554600 |

### Text

| Método | Exemplo |
|--------|---------|
| `word` | example |
| `words` | foo bar baz |
| `sentence` | The quick brown fox. |
| `paragraph` | Lorem ipsum dolor sit amet... |
| `text` | Lorem ipsum... |

### Identity

| Método | Exemplo |
|--------|---------|
| `ssn` | 123-45-6789 |
| `uuid4` | 550e8400-e29b-41d4-a716-... |
| `md5` | 5d41402abc4b2a76b9719d... |
| `sha1` | aaf4c61ddcc5e8a2d... |
| `sha256` | 2cf24dba5fb0a30e26e8... |

### Color

| Método | Exemplo |
|--------|---------|
| `color_name` | MediumAquaMarine |
| `hex_color` | #a2b3c4 |
| `rgb_color` | 162,179,196 |
| `safe_color_name` | blue |

### File

| Método | Exemplo |
|--------|---------|
| `file_name` | report.pdf |
| `file_extension` | pdf |
| `file_path` | /home/user/docs/report.pdf |
| `mime_type` | application/pdf |

### Geo

| Método | Exemplo |
|--------|---------|
| `latitude` | 48.8566 |
| `longitude` | 2.3522 |
| `coordinate` | 48.8566 |
| `latlng` | (48.8566, 2.3522) |

### Automotive

| Método | Exemplo |
|--------|---------|
| `license_plate` | ABC-1234 |
| `vin` | 1HGCM82633A123456 |

### Barcode

| Método | Exemplo |
|--------|---------|
| `ean13` | 5901234123457 |
| `ean8` | 96385074 |
| `isbn13` | 978-3-16-148410-0 |
| `isbn10` | 0-306-40615-2 |

### Credit Card

| Método | Exemplo |
|--------|---------|
| `credit_card_number` | 4111111111111111 |
| `credit_card_provider` | Visa |
| `credit_card_expire` | 12/26 |
| `credit_card_security_code` | 123 |

### User Agent

| Método | Exemplo |
|--------|---------|
| `user_agent` | Mozilla/5.0 (Windows...) |
| `chrome` | Chrome/114.0... |
| `firefox` | Firefox/115.0... |
| `safari` | Safari/537.36... |

## Usando faker_provider diretamente no YAML

Qualquer método do Faker pode ser usado diretamente no YAML do schema, sem precisar da interface:

```yaml
columns:
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
    Quando `faker_provider` está definido, ele tem prioridade sobre `dtype`. O campo `dtype` ainda é necessário para compatibilidade com o parser, mas o valor gerado vem do método Faker especificado.
