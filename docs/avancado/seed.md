# Reprodutibilidade com Seed

O Dataforge permite gerar o mesmo dataset em execuções distintas usando a flag `--seed`.

## Como usar

```bash
docker compose run --rm cli generate -d finance --seed 42 -f csv -o /app/output/run1
docker compose run --rm cli generate -d finance --seed 42 -f csv -o /app/output/run2
# Os arquivos em run1/ e run2/ serão idênticos
```

## Como funciona

O seed é passado para o `DatasetGenerator`, que inicializa o gerador do Faker com esse valor. Toda a geração aleatória (valores de colunas, seleção de FKs, valores nulos) usa esse estado pseudoaleatório fixo.

## Seed em modo recorrente

Em modo recorrente com `--seed`, cada batch recebe um seed diferente mas determinístico:

```python
batch_seed = seed + batch_index - 1
```

Portanto, `--seed 100 -R 30 --count 5` produz os batches com seeds 100, 101, 102, 103, 104. Executar o mesmo comando em outro momento gera exatamente os mesmos cinco batches na mesma ordem.

## Casos de uso

- **Testes automatizados**: garantir que os fixtures gerados são sempre os mesmos
- **Comparação de pipelines**: validar que dois pipelines produzem o mesmo resultado com os mesmos dados de entrada
- **Debugging reproduzível**: reproduzir exatamente um conjunto de dados que causou um bug

## Sem seed

Sem `--seed`, a geração usa entropia aleatória do sistema operacional. Cada execução produz um dataset diferente.

!!! warning "Reprodutibilidade parcial"
    O seed controla a geração de valores pelo Faker e Pandas. A ordem das linhas dentro de cada tabela também é determinística com seed. Porém, se a versão do Faker ou do Python mudar, os mesmos seeds podem produzir valores diferentes.
