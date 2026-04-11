# Interface Visual — Visão Geral

A interface visual roda em `http://localhost:5173` e é a forma principal de uso do Dataforge. Ela permite criar schemas, configurar a geração e executar o CLI sem sair do navegador.

## Tecnologias

- **React** com TypeScript
- **ReactFlow** para o canvas do diagrama relacional
- **Dagre** para o algoritmo de layout automático
- **Vite** como servidor de desenvolvimento

## Funcionalidades principais

| Funcionalidade | Descrição |
|---------------|-----------|
| Editor de tabelas | Cria, edita e remove tabelas com nome e quantidade de linhas |
| Editor de colunas | Define `dtype`, `min`/`max`, `nullable`, `choices`, `faker_provider` e chaves |
| Diagrama relacional | Visualiza tabelas e setas de FK em tempo real via ReactFlow |
| Auto Layout | Reorganiza o diagrama automaticamente (algoritmo Dagre, direção esquerda-direita) |
| Faker Browser | Catálogo visual de ~100 métodos do Faker com exemplo de valor gerado |
| AI Generate | Gera schema a partir de descrição em linguagem natural |
| Preview YAML | Exibe o YAML do schema atual sem salvar |
| Save as Default | Salva o schema no servidor em `src/dataforge/schemas/` |
| Import YAML | Carrega um arquivo `.yaml` do computador para o canvas |
| Run Generator | Executa o CLI diretamente da interface com configuração visual completa |

## Painel lateral (editor)

Ao clicar em uma tabela no canvas, o painel lateral é aberto. Nele é possível:

- Alterar o nome da tabela
- Definir o número de linhas (`rows`)
- Adicionar, editar e remover colunas
- Definir `dtype`, `min`, `max`, `nullable`, `choices` e `faker_provider` por coluna
- Marcar colunas como chave primária (`PK`)
- Configurar chaves estrangeiras: selecionar tabela e coluna de referência

## Seletor de domínio

O seletor no topo da interface carrega schemas salvos no servidor. Ao selecionar um domínio (diferente de `custom`), o canvas é preenchido com as tabelas desse schema.

Os schemas disponíveis são carregados via `GET /api/schemas` e seus conteúdos via `GET /api/schemas/{nome}`.

## Barra de ações

| Botão | Ação |
|-------|------|
| Add Table | Adiciona nova tabela ao canvas |
| Auto Layout | Reorganiza o diagrama (Dagre LR) |
| AI Generate | Abre o modal de geração com IA |
| Faker Browser | Abre o catálogo de métodos Faker |
| Preview YAML | Gera e exibe o YAML do schema atual |
| Import YAML | Abre o seletor de arquivo para importar um `.yaml` |
| Save as Default | Salva o schema atual no servidor |
| Run Generator | Abre o modal de execução do CLI |

## Conexões salvas de banco

As conexões de banco de dados são salvas no `localStorage` do navegador com a chave `dataforge_saved_connections`. Cada conexão armazena nome, formulário de campos e URL de conexão avançada.
