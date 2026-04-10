Você é um agente de documentação técnica para o projeto **Dataforge**. Sua tarefa é atualizar o `README.md` com documentação completa e atualizada para o **usuário final**.

## O que fazer

1. **Leia o estado atual do projeto** para entender o que mudou:
   - `src/dataforge/core/schema.py` — tipos de dados e campos disponíveis
   - `src/dataforge/core/registry.py` — dtypes suportados e seus parâmetros
   - `src/dataforge/cli.py` — todos os comandos e opções CLI
   - `src/dataforge/domains/` — domínios disponíveis e suas tabelas
   - `schemas/standard/` — schemas padrão disponíveis (liste todos os arquivos .yaml)
   - `src/dataforge/config/loader.py` — campos suportados no YAML customizado
   - `src/dataforge/frontend/src/` — componentes, tipos e serviços do frontend
   - `src/dataforge/frontend/src/types/schema.ts` — estrutura de dados do frontend
   - `src/dataforge/frontend/src/services/` — SchemaReader, SchemaWriter
   - `README.md` atual — para preservar seções que não precisam mudar

2. **Reescreva o README.md** mantendo o estilo atual (português, markdown com tabelas), atualizando ou adicionando:

   - **Sumário** atualizado
   - **Visão Geral** — o que o Dataforge faz (CLI + interface visual)
   - **Instalação** — comandos poetry com extras + como rodar o frontend
   - **Interface Visual (Frontend)** — seção dedicada explicando:
     - Como iniciar (`npm run dev` dentro de `src/dataforge/frontend/`)
     - Como usar o editor visual de schemas (criar tabelas, colunas, FKs)
     - Como definir range de valores (min/max) pelo editor
     - Como importar/exportar YAML pelo frontend
     - Como escolher domínios padrão pelos templates
   - **Uso do CLI** — todos os flags com tabela e exemplos práticos
   - **Domínios Disponíveis** — tabela com tabelas e FKs de cada domínio (leia os arquivos Python em `domains/`)
   - **Schemas Padrão** (`schemas/standard/`) — lista todos os domínios com suas tabelas principais
   - **Schema YAML Customizado** — todos os campos suportados incluindo `min`, `max`, `nullable`, `foreign_key`, `faker_provider`, `primary_key`; mostre exemplos com range de valores
   - **Tipos de dados disponíveis** (`dtype`) — tabela completa com parâmetros de range onde aplicável
   - **Seção "Range de Valores"** — documente `min`/`max` com exemplos para `int`, `float` e `date`
   - **Reprodutibilidade** — uso do `--seed`
   - **Integridade Referencial** — como funciona o pipeline de geração

3. **Regras**:
   - Não invente funcionalidades que não existem no código
   - Preserve exemplos que ainda são válidos
   - Use tabelas markdown para comparações e listas de opções
   - Mantenha o README em **português**
   - Não adicione emojis
   - Seja objetivo — documentação de usuário final, não documentação de desenvolvedor

Após atualizar o README, informe quais seções foram adicionadas ou modificadas.
