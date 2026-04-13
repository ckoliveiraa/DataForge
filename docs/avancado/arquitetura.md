# Arquitetura

Visão técnica dos componentes do Dataforge e como eles se comunicam.

## Diagrama geral

```mermaid
flowchart LR
    subgraph Browser["Navegador (React + Vite)"]
        UI[Interface Visual\nApp.tsx]
        SR[SchemaReader]
        SW[SchemaWriter]
        UI --> SR
        UI --> SW
    end

    subgraph Server["Servidor Vite (Node.js)"]
        API_AUTH[POST /api/auth/register\nPOST /api/auth/login]
        API_SCHEMAS[GET /api/schemas\nPOST /api/save-schema]
        API_AI[POST /api/ai-generate\nPOST /api/ai-models]
        API_DB[POST /api/test-db-connection]
        API_CLI[POST /api/run-cli\nPOST /api/stop-cli\nGET /api/run-history]
        API_SCHED[GET /api/schedules\nPOST /api/schedules]
    end

    subgraph Core["Core Python"]
        CLI[dataset-gen CLI\ncli.py]
        GEN[DatasetGenerator\ncore/generator.py]
        REG[FAKER_REGISTRY\ncore/registry.py]
        SCHEMA[DomainSchema / Table / Column\ncore/schema.py]
        LOADER[load_schema\nconfig/loader.py]
        DOMAINS[DOMAIN_REGISTRY\ndomains/]
    end

    subgraph Output["Saída"]
        FILES[Arquivos locais\nCSV / JSON / Parquet / Avro]
        CLOUD[Nuvem\nGCS / S3 / Azure]
        SQL_DB[Banco SQL\nSQLite / PG / MySQL]
    end

    subgraph ExternalAI["APIs de IA"]
        ANTHROPIC[Anthropic]
        OPENAI[OpenAI]
        GOOGLE[Google Gemini]
        GROQ[Groq]
        MISTRAL[Mistral]
        TOGETHER[Together AI]
        OLLAMA[Ollama local]
    end

    UI -- HTTP --> API_AUTH
    UI -- HTTP --> API_SCHEMAS
    UI -- HTTP --> API_AI
    UI -- HTTP --> API_DB
    UI -- HTTP --> API_CLI
    UI -- HTTP --> API_SCHED
    API_AI --> ANTHROPIC
    API_AI --> OPENAI
    API_AI --> GOOGLE
    API_AI --> GROQ
    API_AI --> MISTRAL
    API_AI --> TOGETHER
    API_AI --> OLLAMA
    API_SCHEMAS -- lê/escreve --> SCHEMA_FILES[(src/dataforge/schemas/*.yaml)]
    CLI --> LOADER
    CLI --> DOMAINS
    LOADER --> SCHEMA
    DOMAINS --> SCHEMA
    CLI --> GEN
    GEN --> REG
    GEN --> FILES
    GEN --> CLOUD
    GEN --> SQL_DB
```

## Componentes

### Frontend (React + TypeScript)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `App.tsx` | Componente raiz; gerencia todo o estado da aplicação |
| `types/schema.ts` | Tipos TypeScript: `Column`, `Table`, `Schema` |
| `services/SchemaReader.ts` | Converte YAML em estado interno React |
| `services/SchemaWriter.ts` | Converte estado interno em YAML |
| `components/TableNode.tsx` | Nó customizado do ReactFlow para renderizar tabelas |

### Servidor (vite.config.ts)

O servidor de desenvolvimento do Vite expõe endpoints de API via plugin. Os endpoints disponíveis são:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/auth/register` | POST | Registra novo usuário |
| `/api/auth/login` | POST | Autentica usuário e retorna JWT |
| `/api/auth/me` | GET | Retorna dados do usuário autenticado |
| `/api/schemas` | GET | Lista schemas disponíveis |
| `/api/save-schema` | POST | Salva schema no servidor |
| `/api/ai-generate` | POST | Gera schema via IA |
| `/api/ai-models` | POST | Lista modelos disponíveis para o provider |
| `/api/test-db-connection` | POST | Testa uma connection string SQL |
| `/api/run-cli` | POST | Executa o CLI com os parâmetros fornecidos |
| `/api/stop-cli` | POST | Para a execução do CLI em andamento |
| `/api/run-history` | GET | Lista o histórico de execuções |
| `/api/schedules` | GET | Lista execuções agendadas |
| `/api/schedules` | POST | Cria uma nova execução agendada |
| `/api/credential-profiles` | GET/POST | Gerencia perfis de credenciais cloud |
| `/api/profile/env-keys` | GET/POST/DELETE | Gerencia chaves de API salvas por usuário |
| `/api/capabilities` | GET | Retorna capacidades disponíveis no servidor |
| `/api/browse-folder` | GET | Navega pelo sistema de arquivos do servidor |

### Core Python

| Módulo | Responsabilidade |
|--------|-----------------|
| `cli.py` | Entry point Click; define todos os comandos e flags |
| `core/schema.py` | Dataclasses: `DomainSchema`, `Table`, `Column`, `ForeignKey` |
| `core/registry.py` | `FAKER_REGISTRY` — mapeamento de dtype para função geradora |
| `core/generator.py` | `DatasetGenerator` — geração com ordenação topológica e pool de PKs |
| `config/loader.py` | Parser YAML com merge de schemas e validação de FKs |
| `domains/` | Classes de domínio pré-configuradas (ecommerce, hr, finance) |
| `uploaders/` | Implementações de upload para GCS, S3 e Azure |
| `loaders/sql_loader.py` | Carga de DataFrames em banco via SQLAlchemy |
| `writers/json_writer.py` | Escrita JSON no modo nested |

### Integridade referencial

```mermaid
flowchart TD
    A[Schema com FKs] --> B[Ordenação topológica das tabelas]
    B --> C[Gerar tabela pai]
    C --> D[Registrar PKs no pool]
    D --> E[Gerar tabela filha]
    E --> F[Amostrar PKs do pai para colunas FK]
    F --> G{Mais tabelas?}
    G -- Sim --> C
    G -- Não --> H[Datasets prontos]
```

Tabelas com FK auto-referenciada (ex: `employees.manager_id`) são preenchidas após a geração da própria tabela, usando o pool de PKs recém-criado.

## Stack de tecnologia

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, TypeScript, Vite, ReactFlow, Dagre |
| Backend API | Plugin Vite (Node.js) |
| CLI | Python 3.12, Click |
| Geração de dados | Faker, Pandas |
| Formatos | PyArrow (Parquet), fastavro (Avro) |
| Upload nuvem | google-cloud-storage, boto3, azure-storage-blob |
| SQL | SQLAlchemy 2.0, psycopg2-binary, pymysql |
| Build Python | poetry-core 2.0 |
| Container | Docker multi-stage (python:3.12-slim + Node.js 20 LTS) |
