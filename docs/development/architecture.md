# Arquitetura

Dataforge é estruturado em camadas bem definidas, com sistemas de registro plugáveis para formatos, uploaders e loaders.

---

## Fluxo de dados

```
Schema YAML / Domínio pré-definido
        ↓
   config/loader.py          ← parser e merger de YAMLs
        ↓
   DomainSchema               ← modelo de dados interno
   (schema.py)
        ↓
   DatasetGenerator           ← core de geração
   (core/generator.py)
        ↓  (1) ordena tabelas topologicamente
        ↓  (2) gera cada tabela respeitando FKs
        ↓
   Dict[str, DataFrame]       ← tabelas geradas em memória
        ↓
   ┌─────────────────┐
   │   WRITER_REGISTRY│  ← csv / json / parquet / avro
   └────────┬────────┘
            ↓
   Arquivos locais (output/)
            ↓
   ┌──────────────────┐     ┌──────────────────┐
   │ UPLOADER_REGISTRY│     │  sql_loader.py   │
   │ gcs / s3 / azure │     │  SQLAlchemy      │
   └──────────────────┘     └──────────────────┘
```

---

## Módulos

### `core/schema.py` — Modelos de dados

```python
@dataclass
class ForeignKey:
    ref_table: str
    ref_column: str

@dataclass
class Column:
    name: str
    dtype: str
    primary_key: bool = False
    foreign_key: ForeignKey | None = None
    nullable: float = 0.0        # 0.0 = sem nulos
    min_value: Any = None
    max_value: Any = None
    choices: list | None = None
    faker_provider: str | None = None

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

---

### `core/generator.py` — Motor de geração

**`DatasetGenerator.generate(schema, rows_override, seq_offsets)`**

1. **Ordenação topológica** (`topological_sort()`):
   - Implementa o algoritmo de Kahn (in-degree counting)
   - Detecta ciclos (exceto self-joins, que são tratados separadamente)
   - Garante que tabelas pai sempre precedem filhas

2. **Geração de tabela** (`_generate_table()`):
   - Delega cada coluna ao `FAKER_REGISTRY`
   - Resolve FKs amostrando do `pk_pool` da tabela pai
   - Trata self-joins: primeira linha = `NULL`, demais amostram da própria tabela
   - Aplica `choices` como override quando presente
   - Aplica `nullable` com `pd.array.where()` após geração
   - Rastreia offsets sequenciais para `int_seq`

---

### `core/registry.py` — Registro de tipos

`FAKER_REGISTRY` é um dicionário de lambdas que mapeia `dtype` → função de geração:

```python
FAKER_REGISTRY: dict[str, Callable] = {
    "uuid":     lambda fake, n, **kw: [str(fake.uuid4()) for _ in range(n)],
    "int_seq":  lambda fake, n, **kw: list(range(kw.get("seq_start", 1), kw.get("seq_start", 1) + n)),
    "int":      lambda fake, n, **kw: [fake.random_int(min=kw.get("min", 0), max=kw.get("max", 100_000)) for _ in range(n)],
    # ...
}
```

Para adicionar um novo tipo, basta registrar uma nova entrada.

---

### `writers/` — Sistema de writers

Cada writer implementa `BaseWriter`:

```python
class BaseWriter:
    def write(self, df: pd.DataFrame, path: Path, **kwargs) -> None:
        raise NotImplementedError
```

`WRITER_REGISTRY` mapeia string → classe:

```python
WRITER_REGISTRY = {
    "csv":     CsvWriter,
    "json":    JsonWriter,
    "parquet": ParquetWriter,
    "avro":    AvroWriter,
}
```

### `uploaders/` — Sistema de uploaders

Cada uploader implementa `BaseUploader`:

```python
class BaseUploader:
    def upload(self, local_path: Path, remote_path: str) -> None:
        raise NotImplementedError
```

`UPLOADER_REGISTRY` mapeia string → classe:

```python
UPLOADER_REGISTRY = {
    "gcs":   GcsUploader,
    "s3":    S3Uploader,
    "azure": AzureUploader,
}
```

---

### `config/loader.py` — Parser de schema

- Lê arquivos YAML e converte para `DomainSchema`
- Suporta múltiplos arquivos (merge de domínios)
- Valida a estrutura básica dos schemas

---

### `domains/` — Domínios pré-definidos

Cada domínio é uma subclasse de `DomainTemplate` registrada em `DOMAIN_REGISTRY`:

```python
DOMAIN_REGISTRY = {
    "ecommerce": EcommerceDomain,
    "hr":        HrDomain,
    "finance":   FinanceDomain,
}
```

Para adicionar um novo domínio pré-definido, implemente `DomainTemplate` e registre-o.

---

## Frontend

O frontend React se comunica com os YAMLs em `src/dataforge/schemas/` via volume Docker montado. O `SchemaReader.ts` faz parse do YAML e o `SchemaWriter.ts` serializa de volta — não há API HTTP entre frontend e backend; tudo é gerenciado via sistema de arquivos.

---

## Testes

```
tests/
├── test_cli.py          # Testa comandos CLI via Click test runner
└── test_generator.py    # Testa DatasetGenerator diretamente
```

```bash
# Rodar testes
pytest tests/ -v --cov=dataforge

# Via taskipy
poetry run task test
```
