# Interface Visual

Dataforge inclui um editor visual de schemas baseado em React + ReactFlow. Use-o para criar e editar schemas sem precisar escrever YAML manualmente.

---

## Iniciar a interface

```bash
docker compose up frontend
```

Acesse [http://localhost:5173](http://localhost:5173).

A interface realiza hot-reload automático quando os arquivos em `src/dataforge/schemas/` são alterados.

---

## Funcionalidades

### Editor de diagrama

- **Nós** representam tabelas
- **Arestas** representam chaves estrangeiras
- Arraste para reposicionar tabelas
- Layout automático via algoritmo Dagre

### Gerenciamento de tabelas

- Adicionar / remover tabelas
- Definir número de linhas padrão por tabela
- Visualizar colunas e tipos de cada tabela

### Gerenciamento de colunas

- Adicionar / remover colunas
- Selecionar `dtype` de uma lista categorizada de 100+ tipos Faker
- Marcar coluna como `primary_key`
- Definir `nullable` e valores min/max
- Adicionar `choices` enumerados

### Conexões FK

- Desenhar relações entre tabelas clicando em colunas
- Visualizar dependências no diagrama em tempo real

### Exportação

- Exportar o schema editado como YAML
- O YAML gerado é compatível com o CLI — use com `-c`

---

## Tech Stack

| Componente | Tecnologia |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Diagrama | ReactFlow 11 |
| Layout | Dagre |
| Ícones | Lucide React |
| Serialização | js-yaml |

---

## Desenvolvimento do frontend

```bash
# Instalar dependências
cd src/dataforge/frontend
npm install

# Servidor de desenvolvimento
npm run dev

# Build para produção
npm run build
```

O frontend em modo dev usa o servidor Vite na porta `5173`. No container Docker, o servidor é iniciado com `--host 0.0.0.0` para ser acessível externamente.
