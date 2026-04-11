# Diagrama Relacional

O canvas central da interface exibe as tabelas do schema como nós interativos conectados por setas que representam as chaves estrangeiras.

## Tecnologia

O diagrama é construído com **ReactFlow**. Cada tabela é um nó do tipo `tableNode` (componente customizado) e cada FK é uma aresta animada.

## Interações no canvas

| Ação | Como fazer |
|------|------------|
| Selecionar uma tabela | Clique no nó da tabela |
| Mover uma tabela | Arraste o nó pelo canvas |
| Zoom | Scroll do mouse ou pinch no trackpad |
| Pan (mover o canvas) | Arraste o fundo |
| Fit all | Botão de ajuste nos controles do ReactFlow |

## Aresta de FK

Quando uma coluna é marcada como chave estrangeira com tabela e coluna de referência válidas, uma aresta animada é desenhada automaticamente do nó de origem até o nó de destino.

- Cor: rosa (`#ec4899`)
- Largura: 2px
- Estilo: animado (tracejado móvel)
- Marcador: seta fechada na ponta

## Auto Layout

O botão **Auto Layout** reorganiza os nós do canvas usando o algoritmo **Dagre** em modo `LR` (esquerda para direita).

Parâmetros utilizados:

| Parâmetro | Valor |
|-----------|-------|
| `rankdir` | `LR` |
| `ranksep` | 250 |
| `nodesep` | 150 |
| Largura do nó | 300px |
| Altura do nó | 100 + (número de colunas × 35) px |

!!! tip "Quando usar Auto Layout"
    Use o Auto Layout após importar um schema YAML com muitas tabelas. A disposição automática facilita a leitura das relações entre tabelas.

## Persistência de posições

As posições dos nós são armazenadas no estado interno do React (campo `position` em cada objeto `Table`). Ao exportar o schema como YAML, as posições não são incluídas — o YAML contém apenas a estrutura lógica.

Ao importar um YAML, as tabelas recebem posições iniciais calculadas como `{ x: 50 + index * 300, y: 100 + (index % 2) * 200 }`.
