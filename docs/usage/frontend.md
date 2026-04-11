# Interface Visual

A interface visual é a forma principal de uso do Dataforge. Ela permite criar schemas, visualizar relações e executar o gerador sem escrever YAML ou usar o terminal.

---

## Iniciar a interface

```bash
docker compose up -d
```

Acesse [http://localhost:5173](http://localhost:5173).

---

## Visão geral

A tela principal é dividida em três áreas:

```
┌─────────────────────────────────────────────────────────┐
│  Header: logo, versão, link GitHub                      │
├─────────────────────────────────────────────────────────┤
│  Toolbar: Domain · Add Table · AI Generate · [ações]    │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│   Diagrama relacional        │   Sidebar de edição      │
│   (ReactFlow)                │   (aparece ao clicar     │
│                              │    em uma tabela)        │
└──────────────────────────────┴──────────────────────────┘
```

---

## Toolbar — Barra de ações

| Botão | Descrição |
|---|---|
| **Domain** | Seletor de schema ativo. Inclui `custom` e todos os YAMLs salvos em `schemas/`. |
| **Add Table** | Adiciona uma nova tabela vazia ao diagrama. |
| **AI Generate** | Abre o modal para gerar um schema a partir de uma descrição em linguagem natural. |
| **Auto Layout** | Reorganiza os nós do diagrama automaticamente (algoritmo Dagre, esquerda→direita). |
| **Preview YAML** | Exibe o YAML do schema atual em um painel sobreposto, com opção de download. |
| **Save as Default** | Salva o schema atual como arquivo YAML em `src/dataforge/schemas/` no servidor. |
| **Run Generator** | Abre o modal de execução para configurar e rodar o CLI diretamente da interface. |

!!! note "Importar YAML"
    Para importar um YAML existente, use o seletor **Domain** — os schemas salvos aparecem automaticamente na lista. Também é possível carregar um arquivo local via upload (ícone de arquivo na toolbar, quando disponível).

---

## Diagrama relacional

- Cada tabela é exibida como um nó com nome, quantidade de linhas e lista de colunas
- Clique em uma tabela para abrir o painel de edição lateral
- Arraste nós para reposicionar livremente
- Setas rosas com ponta de seta representam chaves estrangeiras (FKs) entre tabelas, atualizadas em tempo real
- Clique em área vazia para fechar o painel lateral

---

## Painel de edição de tabela (Sidebar)

Aparece ao clicar em qualquer tabela no diagrama.

### Configurações da tabela

- **Table Name** — nome da tabela no schema
- **Rows Count** — número de linhas a gerar por padrão

### Gerenciamento de colunas

Cada coluna exibe:

| Campo | Descrição |
|---|---|
| Nome | Nome da coluna |
| **Type** | Seletor de `dtype` nativo (`int_seq`, `uuid`, `int`, `float`, `str`, `bool`, `date`, `email`, `name`, `phone`, `address`, `city`, `country`, `company`, `text`, `url`, `currency`, `iban`) |
| **Faker Provider** | Campo livre para qualquer método do Faker. O ícone de livro abre o **Faker Browser**. |
| **PK** | Marca a coluna como chave primária |
| **FK** | Habilita chave estrangeira. Aparece seletor de tabela e coluna de referência. |
| **Nullable** | Proporção de nulos (0.0 a 1.0). Ex: `0.3` = 30% de valores nulos. |
| **Min / Max** | Valores mínimo e máximo (para `int`, `float`, `date`). `date` aceita `today`, `-3y`, `-6m`. |
| **Choices** | Lista de valores fixos separados por vírgula. Substitui a geração aleatória. |

---

## Faker Browser

Acessível pelo ícone de livro ao lado do campo **Faker Provider** em qualquer coluna.

Exibe um catálogo de ~100 métodos do Faker organizados por categoria, com exemplo de valor gerado para cada um:

| Categoria | Exemplos |
|---|---|
| Person | `name`, `first_name`, `last_name` |
| Internet | `email`, `url`, `ipv4`, `user_name`, `password` |
| Address | `address`, `city`, `postcode`, `country_code` |
| Finance | `iban`, `swift`, `currency_code`, `pricetag` |
| Date / Time | `date`, `iso8601`, `past_date`, `timezone` |
| Identity | `uuid4`, `ssn`, `md5`, `sha256` |
| Geo | `latitude`, `longitude`, `latlng` |
| Automotive | `license_plate`, `vin` |
| Barcode | `ean13`, `isbn13` |
| Credit Card | `credit_card_number`, `credit_card_expire` |
| … | e mais categorias |

Clique em qualquer método para aplicá-lo à coluna selecionada.

---

## AI Generate

O botão **AI Generate** abre um modal para criar um schema completo descrevendo o domínio em linguagem natural.

### Provedores suportados

| Provedor | Autenticação |
|---|---|
| Anthropic | API key (`sk-ant-api03-…`) |
| OpenAI | API key (`sk-…`) |
| Google (Gemini) | API key (`AIza…`) |
| Groq | API key (`gsk_…`) |
| Mistral | API key |
| Together AI | API key |
| Ollama | Sem chave (local) |

### Como usar

1. Selecione o provedor e informe a API key
2. Clique em **Load Models** para listar os modelos disponíveis
3. Descreva o domínio no campo de texto (em inglês ou português)
4. Clique em **Generate**

O schema gerado é carregado diretamente no diagrama para edição.

**Exemplo de prompt:**

```
E-commerce with 4 tables:
- customers: full name, email, phone, city, country, registration date
- products: name, category (Electronics/Clothing/Books/Home/Sports), price (10–2000), stock quantity
- orders: linked to customer, order date (last 2 years), status (pending/processing/shipped/delivered/cancelled)
- order_items: linked to order and product, quantity (1–10), unit price
```

!!! note "Chaves armazenadas localmente"
    As API keys são salvas no `localStorage` do navegador. Não são enviadas para nenhum servidor externo além da API do provedor escolhido.

---

## Run Generator

O botão **Run Generator** abre o modal de execução, que permite configurar e rodar o CLI diretamente da interface, sem sair do navegador.

### Configurações disponíveis

**Formato**

Selecione um ou mais: `CSV`, `JSON`, `Parquet`, `Avro`. Quando JSON está selecionado, aparece opção de modo (`Flat` / `Nested`).

**Rows Override** — sobrescreve o número de linhas de todas as tabelas.

**Destination** — três modos:

| Modo | Configurações |
|---|---|
| **Local** | Diretório de saída (padrão: `output`) |
| **Cloud** | Provedor (GCS / S3 / Azure), bucket e prefixo. Credenciais carregadas automaticamente de `credentials/`. |
| **Database** | PostgreSQL, MySQL ou SQLite. Formulário visual ou connection string avançada. Suporte a conexões salvas no navegador. Botão de **Test Connection**. |

**Particionamento** — configure por tabela qual coluna usar para particionamento Hive-style.

**Avançado** — seção colapsável com:

- Seed (reprodutibilidade)
- Modo recorrente: intervalo em segundos (`-R`) e número de batches (`--count`)
- Incrementos de coluna por batch (`--increment`)
- Filtro de tabelas a incluir
- Filtro de colunas por tabela

### Execução e logs

Ao clicar em **Run**, o backend executa o CLI e transmite a saída em tempo real para o painel de logs. Um botão **Stop** aparece durante a execução para interromper o processo.

---

## Salvar e gerenciar schemas

- **Save as Default** — salva o schema atual como YAML em `src/dataforge/schemas/` no servidor. O nome deve conter apenas letras minúsculas, números, hífens e underscores. Após salvar, o schema aparece no seletor **Domain**.
- **Excluir schema** — o ícone de lixeira ao lado do seletor **Domain** remove o arquivo YAML do servidor. Disponível apenas para schemas não-custom.
- **Preview YAML** — exibe o YAML gerado sem salvar, com opção de download local.

---

## Tech Stack do frontend

| Componente | Tecnologia |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Diagrama | ReactFlow 11 |
| Layout automático | Dagre |
| Ícones | Lucide React |
| Serialização YAML | js-yaml |
| API backend | Plugin customizado no Vite (sem servidor separado) |
