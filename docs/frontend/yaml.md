# Exportar e Importar YAML

A interface permite exportar o schema atual como YAML e importar um arquivo YAML existente para o canvas.

## Exportar YAML (Preview)

O botão **Preview YAML** gera o YAML do schema atual e exibe no painel lateral.

O YAML é gerado pela classe `SchemaWriter` (`src/dataforge/frontend/src/services/SchemaWriter.ts`):

- Lê o estado interno do React (domínio, tabelas, colunas)
- Serializa para YAML usando a biblioteca `yaml`
- O resultado é exibido no painel e pode ser copiado ou baixado

### Estrutura gerada

```yaml
domain: meu_dominio
tables:
  tabela1:
    rows: 1000
    columns:
      id:
        dtype: int_seq
        primary_key: true
      nome:
        dtype: name
      email:
        dtype: email
        nullable: 0.1
```

### Baixar o arquivo

Clique em **Download YAML** (disponível após o preview) para baixar o arquivo como `{dominio}_schema.yaml`. O download é gerado via `Blob` no navegador, sem chamada ao servidor.

## Salvar no servidor (Save as Default)

O botão **Save as Default** salva o schema no servidor em `src/dataforge/schemas/`. Isso permite:

- Usar o schema via CLI com `-d {nome}`
- Carregar o schema novamente na interface pelo seletor de domínio

### Como usar

1. Clique em **Save as Default**.
2. Informe um nome para o schema (apenas letras minúsculas, números, hífens e underscores).
3. Confirme. O schema é enviado via `PUT /api/schemas/{nome}`.

Após salvar, o schema aparece no seletor de domínio.

### Deletar um schema salvo

Para remover um schema salvo no servidor, use o botão de exclusão disponível no seletor de domínio. A operação envia `DELETE /api/schemas/{nome}`.

!!! warning "Schemas de domínio padrão"
    Os schemas dos domínios padrão (`ecommerce`, `hr`, `finance`) são lidos de `src/dataforge/schemas/`. Salvar um schema com o mesmo nome sobrescreve o arquivo original.

## Importar YAML

O botão **Import YAML** abre o seletor de arquivo do navegador. Formatos aceitos: `.yaml` e `.yml`.

O arquivo é lido pela classe `SchemaReader` (`src/dataforge/frontend/src/services/SchemaReader.ts`):

1. O conteúdo do arquivo é lido como texto via `FileReader`.
2. O texto YAML é parseado com a biblioteca `yaml`.
3. As tabelas e colunas são convertidas para o estado interno do React.
4. O canvas é atualizado com as tabelas importadas.

### Erros tratados na importação

| Erro | Causa | Mensagem exibida |
|------|-------|-----------------|
| Chaves duplicadas | IA gerou duas colunas com o mesmo nome | Indica linha e nome da chave duplicada |
| YAML inválido | Sintaxe incorreta | Mensagem do parser YAML |
| Objeto inválido | Arquivo não contém objeto YAML válido | "Formato YAML inválido" |

!!! tip "Compatibilidade"
    O YAML importado deve seguir a mesma estrutura produzida pelo Dataforge. A importação é compatível com qualquer schema gerado pelo CLI ou pela interface.
