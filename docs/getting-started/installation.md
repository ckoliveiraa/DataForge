# Instalação

Dataforge pode ser executado via **Docker** (recomendado) ou instalado diretamente com **Poetry/pip**.

---

## Pré-requisitos

=== "Docker (recomendado)"

    - [Docker Desktop](https://www.docker.com/products/docker-desktop/) 24+
    - [Docker Compose](https://docs.docker.com/compose/) v2+

=== "Python (sem Docker)"

    - Python 3.12+
    - [Poetry](https://python-poetry.org/) 1.8+ (opcional, mas recomendado)

---

## Via Docker

### 1. Clonar o repositório

```bash
git clone https://github.com/carlos-oliveira/dataforge.git
cd dataforge
```

### 2. Build e inicialização

```bash
# Build e sobe o frontend em segundo plano
docker compose up --build -d
```

A imagem realiza um build multi-stage:

1. **Stage `python-build`** — instala todas as dependências opcionais (parquet, avro, SQL, cloud) usando `pip`
2. **Stage final** — copia o runtime Python, instala Node.js 20 LTS e instala as dependências do frontend via `npm install`

O frontend estará disponível em `http://localhost:5173` após a conclusão do build.

### 3. Volumes mapeados

| Volume | Host | Container | Uso |
|---|---|---|---|
| Schemas | `./src/dataforge/schemas` | `/app/src/dataforge/schemas` | Editar YAMLs sem rebuild |
| Credenciais | `./credentials` | `/app/credentials` | Arquivos de credencial cloud (SA GCP, etc.) |
| Output | `./output` | `/app/output` | Arquivos gerados pelo CLI |
| Código-fonte | `./src/dataforge` | `/app/src/dataforge` | Hot-reload de Python e frontend |
| `frontend_node_modules` | (volume nomeado Docker) | `/app/src/dataforge/frontend/node_modules` | Protege os binários Linux do `npm install` de serem sobrescritos pelo volume do código-fonte (importante em hosts Windows) |

### 4. Verificar a instalação

```bash
# Exibir o help do CLI
docker compose run --rm cli --help
```

Saída esperada:

```
Usage: dataset-gen [OPTIONS] COMMAND [ARGS]...

  Dataforge — gerador de datasets sintéticos relacionais.

Commands:
  generate      Gera um dataset sintético.
  list-domains  Lista os domínios disponíveis.
  schema-info   Exibe informações do schema de um domínio.
```

---

## Via Poetry (sem Docker)

### 1. Clonar e instalar dependências base

```bash
git clone https://github.com/carlos-oliveira/dataforge.git
cd dataforge
poetry install
```

### 2. Instalar extras conforme necessidade

```bash
# Suporte a Parquet e Avro
poetry install --extras "parquet avro"

# Suporte completo (cloud + SQL + todos os formatos)
poetry install --extras "all"
```

### 3. Ativar o ambiente e verificar

```bash
poetry shell
dataset-gen --help
```

---

## Via pip

```bash
pip install ".[parquet,avro]"
dataset-gen --help
```

Para instalar tudo:

```bash
pip install ".[all]"
```

---

## Estrutura de diretórios após instalação

```
dataforge/
├── output/         # Datasets gerados (montado como volume no Docker)
├── credentials/    # Arquivos de credencial cloud (GCP SA, AWS, Azure)
└── src/dataforge/
    └── schemas/    # YAMLs de schema (editáveis sem rebuild)
```

!!! tip "Hot-reload de schemas"
    O diretório `schemas/` é montado como volume no container. Edite os YAMLs e execute novamente sem rebuild.
