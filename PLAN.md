# Plan: Dataset Generator

## Context
Projeto Python CLI que gera datasets sintéticos relacionais para estudos de engenharia de dados. O usuário pode escolher o formato de saída (JSON, CSV, Avro, Parquet), quais tabelas e colunas incluir, quantas linhas gerar, qual domínio relacional usar e fazer upload direto para GCP, AWS ou Azure.

---

## Estrutura do Projeto

```
dataforge/
├── dataset_generator/          # pacote Python principal
│   ├── __init__.py
│   ├── cli.py                  # entrypoint click
│   ├── core/
│   │   ├── schema.py           # dataclasses: Column, ForeignKey, Table, DomainSchema
│   │   ├── generator.py        # orquestrador + integridade referencial (topological sort)
│   │   └── registry.py         # mapeamento dtype → callable Faker
│   ├── domains/
│   │   ├── base.py             # classe abstrata DomainTemplate
│   │   ├── ecommerce.py        # customers, products, categories, orders, order_items
│   │   ├── hr.py               # departments, employees, job_titles, salaries
│   │   └── finance.py          # customers, accounts, transactions, categories
│   ├── writers/
│   │   ├── __init__.py         # registry: {"csv": CsvWriter, ...}
│   │   ├── base.py             # classe abstrata BaseWriter
│   │   ├── csv_writer.py
│   │   ├── json_writer.py      # modos: flat (NDJSON) e nested
│   │   ├── parquet_writer.py
│   │   └── avro_writer.py
│   ├── uploaders/
│   │   ├── __init__.py         # registry: {"gcs": GcsUploader, ...}
│   │   ├── base.py             # classe abstrata BaseUploader
│   │   ├── gcs_uploader.py     # google-cloud-storage → gs://bucket/prefix/file
│   │   ├── s3_uploader.py      # boto3 → s3://bucket/prefix/file
│   │   └── azure_uploader.py   # azure-storage-blob → az://container/prefix/file
│   └── config/
│       └── loader.py           # carrega YAML + merge com domínio base + validação FK
├── schemas/
│   ├── ecommerce.yaml
│   ├── hr.yaml
│   └── custom_example.yaml
├── output/                     # pasta padrão de saída (gitignored)
├── requirements.txt
├── setup.py
└── README.md
```

---

## Lógica dos Módulos Principais

### `core/schema.py`
Dataclasses puras sem I/O:

```python
@dataclass
class Column:
    name: str
    dtype: str           # "int", "str", "float", "date", "bool", "email", "uuid", "int_seq"
    faker_provider: str | None = None
    nullable: float = 0.0          # probabilidade de None
    primary_key: bool = False
    foreign_key: ForeignKey | None = None

@dataclass
class ForeignKey:
    ref_table: str
    ref_column: str

@dataclass
class Table:
    name: str
    columns: list[Column]
    default_rows: int = 1000

@dataclass
class DomainSchema:
    name: str
    tables: list[Table]
```

### `core/generator.py` — Integridade Referencial

**Passo 1:** Ordenação topológica (Kahn's algorithm) — tabelas pai sempre antes dos filhos.

**Passo 2:** `pk_pool: dict[str, list]` compartilhado. Após gerar cada tabela, seus PKs entram no pool. Colunas FK amostram via `random.choices(pk_pool[ref])`.

**Caso especial:** FK auto-referenciada (`employees.manager_id → employees.id`) — gera tabela sem a coluna self-FK primeiro, depois preenche amostrando da PK já gerada.

```python
class DatasetGenerator:
    def generate(self) -> dict[str, pd.DataFrame]:
        order = topological_sort(self.schema.tables)
        pk_pool: dict[str, list] = {}
        result: dict[str, pd.DataFrame] = {}
        for table in order:
            df = self._generate_table(table, pk_pool)
            for col in table.columns:
                if col.primary_key:
                    pk_pool[f"{table.name}.{col.name}"] = df[col.name].tolist()
            result[table.name] = df
        return result
```

### `core/registry.py`
```python
FAKER_REGISTRY = {
    "uuid":    lambda f, n: [str(uuid4()) for _ in range(n)],
    "int_seq": lambda f, n: list(range(1, n + 1)),
    "name":    lambda f, n: [f.name() for _ in range(n)],
    "email":   lambda f, n: [f.email() for _ in range(n)],
    "date":    lambda f, n: [f.date_between(start_date="-3y") for _ in range(n)],
    # providers customizados via YAML: getattr(faker, provider)()
}
```

### `writers/` — Implementações

| Writer | Implementação |
|--------|--------------|
| CSV | `df.to_csv(..., index=False)` |
| Parquet | `df.to_parquet(..., engine="pyarrow", compression="snappy")` |
| JSON flat | `df.to_json(orient="records", lines=True)` — NDJSON, compatível BigQuery |
| JSON nested | segunda passagem que aninha filhos dentro dos pais via FK |
| Avro | inferência pandas→Avro schema + `fastavro.writer` |

Múltiplos formatos criam subpastas: `output/csv/`, `output/parquet/`, etc.

### `uploaders/` — Autenticação por Provedor

| Provedor | Mecanismo padrão | Variável de ambiente |
|----------|-----------------|----------------------|
| GCS | Application Default Credentials / Service Account JSON | `GOOGLE_APPLICATION_CREDENTIALS` |
| S3 | `~/.aws/credentials` / IAM role | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |
| Azure | DefaultAzureCredential / connection string | `AZURE_STORAGE_CONNECTION_STRING` |

### `config/loader.py` — YAML Parameterizável

Dois modos:
1. **Override:** `domain: ecommerce` → carrega domínio Python base, sobrescreve apenas o que está no YAML
2. **Custom:** `domain: custom` → schema 100% definido pelo YAML

Validação antes da geração: todas as FKs devem resolver para tabelas+colunas existentes no schema final.

### `cli.py` — Interface

```
dataset-gen generate
  --domain / -d    [ecommerce|hr|finance|custom]  (obrigatório)
  --config / -c    caminho para YAML (obrigatório se --domain custom)
  --rows   / -r    linhas por tabela (default: 1000)
  --tables / -t    tabelas a incluir (repetível)
  --columns        "tabela:col1,col2" por tabela (repetível)
  --format / -f    [csv|json|parquet|avro] (repetível, default: csv)
  --output / -o    diretório de saída (default: ./output)
  --json-mode      [flat|nested] (default: flat)
  --seed           seed para reprodutibilidade
  --upload         [gcs|s3|azure] (opcional)
  --bucket         nome do bucket/container
  --prefix         prefixo no bucket (default: "datasets/")
  --credentials    caminho para arquivo de credenciais

dataset-gen list-domains       # lista domínios disponíveis
dataset-gen schema-info <dom>  # exibe tabelas, colunas e FKs do domínio
```

---

## `setup.py` — Extras de Nuvem

```python
extras_require={
    "gcp":   ["google-cloud-storage>=2.0"],
    "aws":   ["boto3>=1.34"],
    "azure": ["azure-storage-blob>=12.0"],
    "all":   ["google-cloud-storage>=2.0", "boto3>=1.34", "azure-storage-blob>=12.0"],
}
```

---

## `requirements.txt`

```
click>=8.1,<9.0
faker>=24.0
pandas>=2.2
pyarrow>=16.0
fastavro>=1.9
pyyaml>=6.0

# Cloud (via extras no setup.py)
# google-cloud-storage>=2.0
# boto3>=1.34
# azure-storage-blob>=12.0
```

---

## Verificação End-to-End

```bash
pip install -e ".[all]"

# 1. Listar domínios
dataset-gen list-domains

# 2. Inspecionar schema
dataset-gen schema-info ecommerce

# 3. Geração local multi-formato
dataset-gen generate -d ecommerce -r 100 -f csv -f parquet -o ./output
# Verificar output/csv/*.csv e output/parquet/*.parquet
# Confirmar integridade: orders.customer_id ∈ customers.id

# 4. JSON nested
dataset-gen generate -d ecommerce -f json --json-mode nested -r 50

# 5. Avro
dataset-gen generate -d custom -c schemas/custom_example.yaml -f avro

# 6. Reprodutibilidade
dataset-gen generate -d finance --seed 42 -f csv -o ./run1
dataset-gen generate -d finance --seed 42 -f csv -o ./run2
diff run1/transactions.csv run2/transactions.csv  # sem diferenças

# 7. Upload GCS
dataset-gen generate -d hr -f parquet --upload gcs --bucket <bucket> --prefix test/

# 8. Upload S3
dataset-gen generate -d ecommerce -f csv --upload s3 --bucket <bucket>

# 9. Upload Azure
dataset-gen generate -d finance -f parquet --upload azure --bucket <container>
```
