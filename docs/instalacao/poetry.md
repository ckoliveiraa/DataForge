# Instalação sem Docker (Poetry)

Para quem prefere instalar diretamente no ambiente local. Requer Python 3.12+ e Poetry.

## Pré-requisitos

- Python 3.12 ou superior
- [Poetry](https://python-poetry.org/docs/#installation)

## Clonando e instalando

```bash
git clone https://github.com/ckoliveiraa/DataForge
cd Dataforge
```

### Instalação base (CSV e JSON apenas)

```bash
poetry install
```

### Instalação com todos os extras

```bash
poetry install -E "parquet avro sql postgres gcp aws azure"
```

## Extras disponíveis

| Extra | Funcionalidade | Pacote instalado |
|-------|----------------|-----------------|
| `parquet` | Formato Parquet com compressão Snappy | `pyarrow>=16.0` |
| `avro` | Formato Avro com schema inferido | `fastavro>=1.9` |
| `sql` | SQLite e bancos via SQLAlchemy | `sqlalchemy>=2.0` |
| `postgres` | PostgreSQL | `sqlalchemy>=2.0`, `psycopg2-binary>=2.9` |
| `mysql` | MySQL / MariaDB | `sqlalchemy>=2.0`, `pymysql>=1.1` |
| `mssql` | SQL Server | `sqlalchemy>=2.0`, `pyodbc>=5.0` |
| `gcp` | Google Cloud Storage | `google-cloud-storage>=2.0` |
| `aws` | Amazon S3 | `boto3>=1.34` |
| `azure` | Azure Blob Storage | `azure-storage-blob>=12.0` |

## Usando o CLI

Após instalar, o comando `dataset-gen` fica disponível no terminal:

```bash
# Equivalente a docker compose run --rm cli list-domains
dataset-gen list-domains

# Gerar dataset
dataset-gen generate -d ecommerce -f csv -o ./output
```

!!! note "Diferença de caminhos"
    Sem Docker, use caminhos do host diretamente. O prefixo `/app/` não existe fora do container.

## Dependências de desenvolvimento

Para contribuir com o projeto:

```bash
poetry install --with dev
```

Isso instala `ruff`, `pytest`, `pytest-cov` e `pre-commit`.

### Tarefas disponíveis (taskipy)

```bash
poetry run task lint    # Verifica erros de estilo
poetry run task fmt     # Formata o código
poetry run task test    # Executa os testes
poetry run task ci      # Lint + formato + testes com cobertura
```

## Interface visual sem Docker

A interface visual requer Node.js 20+. Para rodar em modo de desenvolvimento:

```bash
cd src/dataforge/frontend
npm install
npm run dev
```

Acesse `http://localhost:5173`.

!!! warning "Variável PYTHONPATH"
    Defina `PYTHONPATH` para que o servidor Vite encontre o código Python:
    ```bash
    export PYTHONPATH=/caminho/para/Dataforge/src
    ```
