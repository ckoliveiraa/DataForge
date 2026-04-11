from __future__ import annotations

import random

import pandas as pd
from faker import Faker

from dataforge.core.registry import generate_column
from dataforge.core.schema import DomainSchema, Table


def topological_sort(tables: list[Table]) -> list[Table]:
    table_map = {t.name: t for t in tables}
    in_degree: dict[str, int] = {t.name: 0 for t in tables}
    dependents: dict[str, list[str]] = {t.name: [] for t in tables}

    for table in tables:
        deps: set[str] = set()
        for col in table.columns:
            if col.foreign_key and col.foreign_key.ref_table != table.name:
                dep = col.foreign_key.ref_table
                if dep not in table_map:
                    continue  # FK aponta para tabela fora do conjunto filtrado — ignora
                if dep not in deps:
                    deps.add(dep)
                    in_degree[table.name] += 1
                    dependents[dep].append(table.name)

    queue = [name for name, deg in in_degree.items() if deg == 0]
    order: list[Table] = []
    while queue:
        name = queue.pop(0)
        order.append(table_map[name])
        for child in dependents[name]:
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)

    if len(order) != len(tables):
        raise ValueError("Circular dependency detected in schema (excluding self-references).")
    return order


class DatasetGenerator:
    def __init__(
        self,
        schema: DomainSchema,
        rows: int | None = None,
        seed: int | None = None,
        seq_offsets: dict[str, int] | None = None,
    ):
        self.schema = schema
        self.rows = rows
        self.seed = seed
        self.seq_offsets = seq_offsets or {}
        self.faker = Faker()
        if seed is not None:
            Faker.seed(seed)
            random.seed(seed)

    def generate(self) -> dict[str, pd.DataFrame]:
        order = topological_sort(self.schema.tables)
        pk_pool: dict[str, list] = {}
        result: dict[str, pd.DataFrame] = {}

        for table in order:
            df = self._generate_table(table, pk_pool)
            for col in table.columns:
                if col.primary_key:
                    pk_pool[f"{table.name}.{col.name}"] = df[col.name].tolist()
            result[table.name] = df

        return result

    def _generate_table(self, table: Table, pk_pool: dict[str, list]) -> pd.DataFrame:
        n = self.rows if self.rows is not None else table.default_rows
        seq_start = self.seq_offsets.get(table.name, 0) + 1
        data: dict[str, list] = {}

        self_fk_cols = []
        for col in table.columns:
            if col.foreign_key and col.foreign_key.ref_table == table.name:
                self_fk_cols.append(col)
                continue

            if col.foreign_key:
                ref_key = f"{col.foreign_key.ref_table}.{col.foreign_key.ref_column}"
                pool = pk_pool.get(ref_key, [])
                if pool:
                    values = random.choices(pool, k=n)
                else:
                    # Tabela referenciada não está no conjunto gerado (filtrada via --tables).
                    # Gera valores sintéticos sem constraint referencial.
                    values = generate_column(
                        col.dtype,
                        col.faker_provider,
                        self.faker,
                        n,
                        min_value=col.min_value,
                        max_value=col.max_value,
                    )
            elif col.choices:
                values = random.choices(col.choices, k=n)
            else:
                values = generate_column(
                    col.dtype,
                    col.faker_provider,
                    self.faker,
                    n,
                    min_value=col.min_value,
                    max_value=col.max_value,
                    seq_start=seq_start,
                )

            if col.nullable > 0:
                values = [None if random.random() < col.nullable else v for v in values]

            data[col.name] = values

        df = pd.DataFrame(data)

        # Handle self-referential FKs
        for col in self_fk_cols:
            ref_key = f"{table.name}.{col.foreign_key.ref_column}"
            own_pks = data.get(col.foreign_key.ref_column, [])
            if not own_pks:
                # fallback: use already-generated PK column values
                pk_col = next((c for c in table.columns if c.primary_key), None)
                own_pks = data.get(pk_col.name, []) if pk_col else []
            values = [None] + random.choices(own_pks, k=n - 1) if own_pks else [None] * n
            random.shuffle(values)
            if col.nullable > 0:
                values = [None if random.random() < col.nullable else v for v in values]
            df[col.name] = values

        return df
