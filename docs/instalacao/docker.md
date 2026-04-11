# Instalação com Docker

Esta é a forma recomendada de usar o Dataforge. Requer apenas Docker e Docker Compose instalados.

## Pré-requisitos

- Docker Engine 24+
- Docker Compose v2+

Nenhuma instalação de Python, Node.js ou dependências adicionais é necessária.

## Clonando o repositório

```bash
git clone https://github.com/ckoliveiraa/DataForge
cd Dataforge
```

## Subindo os serviços

```bash
docker compose up --build -d
```

O build leva alguns minutos na primeira execução pois instala todas as dependências Python e Node.js dentro da imagem.

Após o build, acesse a interface visual em:

```
http://localhost:5173
```

## Estrutura do docker-compose.yml

O arquivo `docker-compose.yml` define dois serviços:

| Serviço | Container | Uso |
|---------|-----------|-----|
| `frontend` | `dataforge-frontend` | Interface visual + servidor de desenvolvimento Vite |
| `cli` | `dataforge-cli` | CLI standalone, acionado via `docker compose run` |

O serviço `cli` usa o profile `cli` e só sobe quando chamado explicitamente com `docker compose run --rm cli`.

## Volumes mapeados

```yaml
volumes:
  - ./src/dataforge/schemas:/app/src/dataforge/schemas  # schemas editáveis
  - ./credentials:/app/credentials                      # credenciais de nuvem
  - ./output:/app/output                                # arquivos gerados
  - ./src/dataforge:/app/src/dataforge                  # hot reload do código
```

!!! tip "Hot reload"
    O código Python e o frontend têm hot reload ativo. Alterações em `src/dataforge/` são refletidas imediatamente sem rebuild da imagem.

!!! warning "node_modules"
    O volume `frontend_node_modules` protege o `node_modules` Linux gerado no build. Isso evita conflitos com binários nativos do Windows no host.

## Parando os serviços

```bash
docker compose down
```

## Recriando a imagem

Necessário após atualizar dependências em `pyproject.toml` ou `package.json`:

```bash
docker compose up --build -d
```

## Usando o CLI via Docker

O CLI é acessado pelo serviço `cli`. Exemplos:

```bash
# Listar domínios disponíveis
docker compose run --rm cli list-domains

# Ver estrutura de um domínio
docker compose run --rm cli schema-info ecommerce

# Gerar dataset
docker compose run --rm cli generate -d ecommerce -f csv
```

Os arquivos gerados aparecem em `output/` no host.
