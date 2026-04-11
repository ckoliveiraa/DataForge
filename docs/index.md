# Dataforge

**Gerador de datasets sintéticos relacionais para engenharia de dados.**

Dataforge cria conjuntos de dados fictícios com integridade referencial garantida — ideal para testar pipelines de dados, popular bancos de desenvolvimento e criar fixtures de teste sem depender de dados reais.

---

## Por que Dataforge?

| Problema | Solução |
|---|---|
| Dados reais têm PII e não podem ser compartilhados | Dados 100% sintéticos via [Faker](https://faker.readthedocs.io/) |
| Seed manual de banco é trabalhoso | Domínios prontos com um comando |
| Dados sem relação entre tabelas quebram pipelines | Integridade referencial por ordenação topológica |
| Formato fixo não serve para todos os destinos | CSV, JSON, Parquet, Avro — e upload direto para nuvem |

---

## Funcionalidades

- **Domínios prontos** — ecommerce, RH, finanças e mais
- **Schemas customizados** em YAML
- **Interface visual** para editar schemas sem escrever YAML
- **Integridade referencial** — chaves estrangeiras sempre resolvidas
- **Múltiplos formatos** — CSV, JSON (flat/nested), Parquet, Avro
- **Upload direto** para GCS, S3, Azure Blob Storage
- **Carga em banco** — PostgreSQL, MySQL, SQL Server, SQLite
- **Modo recorrente** — geração contínua de batches incrementais
- **Reprodutibilidade** — seed para resultados idênticos

---

## Início Rápido

```bash
# Subir a interface visual
docker compose up frontend

# Gerar 1000 clientes do domínio ecommerce em CSV
docker compose run --rm cli generate -d ecommerce -t customers -r 1000 -f csv
```

Veja o [Guia de Instalação](getting-started/installation.md) e o [Quickstart](getting-started/quickstart.md) para o passo a passo completo.

---

## Arquitetura em uma Linha

```
Schema YAML → DatasetGenerator → [CSV | JSON | Parquet | Avro] → [Local | GCS | S3 | Azure | SQL]
```

Cada camada é plugável via registros internos — veja [Arquitetura](development/architecture.md).
