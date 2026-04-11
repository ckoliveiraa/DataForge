# Contribuindo

---

## Configurar ambiente de desenvolvimento

```bash
git clone https://github.com/carlos-oliveira/dataforge.git
cd dataforge

# Instalar dependências de desenvolvimento
poetry install --extras "parquet avro"

# Configurar pre-commit hooks
poetry run pre-commit install
```

---

## Comandos disponíveis

```bash
# Formatar código
poetry run task fmt

# Verificar lint
poetry run task lint

# Formatar + lint (sem alterar)
poetry run task check

# Rodar testes
poetry run task test

# Pipeline completa (check + testes + coverage)
poetry run task ci
```

---

## Esteira CI/CD

A esteira roda automaticamente no GitHub Actions em todo push:

```
push
  ↓
lint (ruff format + ruff check)
  ↓
tests (pytest + coverage → Codecov)
  ↓
┌──────────────────┐     ┌──────────────┐
│  open-pr          │     │   release    │  (apenas main)
│  (branches != main)│    │  (tag + GH   │
└──────────────────┘     │   Release)   │
                         └──────────────┘
                               ↓
                         docs (MkDocs →
                         GitHub Pages)
```

### Jobs

| Job | Gatilho | O que faz |
|---|---|---|
| `lint` | Todo push | ruff format + ruff check |
| `test` | Após lint | pytest + coverage upload |
| `open-pr` | Push em branch ≠ main | Cria PR para main automaticamente |
| `release` | Push em main | Cria tag + GitHub Release |
| `docs` | Push em main | Build MkDocs + deploy GitHub Pages |

---

## Adicionando um novo tipo de dado

1. Edite `src/dataforge/core/registry.py`
2. Adicione uma entrada ao `FAKER_REGISTRY`:

```python
"meu_tipo": lambda fake, n, **kw: [fake.meu_metodo() for _ in range(n)],
```

3. Documente em `docs/usage/data-types.md`

---

## Adicionando um novo writer

1. Crie `src/dataforge/writers/meu_writer.py` implementando `BaseWriter`
2. Registre em `src/dataforge/writers/__init__.py`:

```python
from .meu_writer import MeuWriter

WRITER_REGISTRY["meu_formato"] = MeuWriter
```

---

## Adicionando um novo domínio

1. Crie `src/dataforge/domains/meu_dominio.py` implementando `DomainTemplate`
2. Registre em `src/dataforge/domains/__init__.py`
3. Ou simplesmente crie um YAML em `src/dataforge/schemas/meu_dominio.yaml`

---

## Pre-commit hooks

O projeto usa pre-commit para garantir qualidade antes de cada commit:

```yaml
# .pre-commit-config.yaml
- ruff (format + check)
```

Para rodar manualmente:

```bash
poetry run pre-commit run --all-files
```

---

## Estrutura de branches

| Branch | Propósito |
|---|---|
| `main` | Estável — gera release automaticamente |
| `feature/*` | Desenvolvimento de features |
| `fix/*` | Correções |

Ao fazer push em qualquer branch diferente de `main`, um PR é aberto automaticamente para `main` após os testes passarem.
