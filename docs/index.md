# Dataforge

Dataforge é uma ferramenta para geração de datasets sintéticos **relacionais** com integridade referencial garantida. Está disponível como interface visual no navegador e como linha de comando (CLI).

Casos de uso típicos:

- Popular bancos de dados de desenvolvimento sem usar dados reais
- Criar fixtures para modelos dbt
- Testar pipelines de ingestão e transformação de dados
- Simular volumes de dados antes de ir para produção

## Como funciona

O Dataforge lê um **schema YAML** que descreve tabelas, colunas, tipos de dados e relações entre tabelas. A partir desse schema ele gera DataFrames Pandas e os escreve nos formatos e destinos escolhidos.

A integridade referencial é garantida por dois mecanismos:

1. **Ordenação topológica** — tabelas pai são geradas antes de tabelas filhas.
2. **Pool de PKs** — após gerar cada tabela, seus valores de chave primária ficam disponíveis; colunas com chave estrangeira amostram desse pool com reposição, permitindo múltiplos filhos por pai.

## Formas de uso

| Modo | Acesso | Ideal para |
|------|--------|------------|
| Interface visual | `http://localhost:5173` | Criar schemas, explorar domínios, executar via GUI |
| CLI Docker | `docker compose run --rm cli generate ...` | Scripts, CI, automação |
| CLI direto (Poetry) | `dataset-gen generate ...` | Desenvolvimento local |

## Início rápido

```bash
git clone https://github.com/ckoliveiraa/DataForge
cd Dataforge
docker compose up --build -d
```

Acesse `http://localhost:5173` após o build concluir.

## Estrutura de pastas do host

Após subir os containers, três pastas ficam mapeadas entre o container e o host:

| Pasta | Uso |
|-------|-----|
| `output/` | Arquivos gerados pelo CLI aparecem aqui |
| `credentials/` | Arquivos de credenciais de nuvem (JSON do GCP, etc.) |
| `src/dataforge/schemas/` | Schemas YAML customizados — editáveis sem rebuild |

!!! note "Pré-requisitos"
    Apenas **Docker** e **Docker Compose** instalados na máquina. Não é necessário instalar Python, Node.js ou qualquer outra dependência separadamente.
