"""Tests for core dataset generator."""

from __future__ import annotations

import pytest

from dataforge.core.generator import DatasetGenerator, topological_sort
from dataforge.core.schema import Column, DomainSchema, ForeignKey, Table
from dataforge.domains import DOMAIN_REGISTRY


def _simple_schema(with_fk: bool = False) -> DomainSchema:
    tables = [
        Table(
            name="categories",
            columns=[Column(name="id", dtype="int_seq", primary_key=True)],
            default_rows=5,
        ),
    ]
    if with_fk:
        tables.append(
            Table(
                name="products",
                columns=[
                    Column(name="id", dtype="int_seq", primary_key=True),
                    Column(
                        name="category_id",
                        dtype="int",
                        foreign_key=ForeignKey(ref_table="categories", ref_column="id"),
                    ),
                ],
                default_rows=10,
            )
        )
    return DomainSchema(name="test", tables=tables)


# ---------------------------------------------------------------------------
# topological_sort
# ---------------------------------------------------------------------------


def test_topological_sort_no_fk():
    schema = _simple_schema(with_fk=False)
    order = topological_sort(schema.tables)
    assert [t.name for t in order] == ["categories"]


def test_topological_sort_with_fk():
    schema = _simple_schema(with_fk=True)
    order = topological_sort(schema.tables)
    names = [t.name for t in order]
    assert names.index("categories") < names.index("products")


def test_topological_sort_filtered_tables_no_keyerror():
    """--tables filtering should not crash topological_sort even when FK points to removed table."""
    schema = _simple_schema(with_fk=True)
    # Simulate --tables products (categories removed)
    filtered = [t for t in schema.tables if t.name == "products"]
    order = topological_sort(filtered)
    assert [t.name for t in order] == ["products"]


# ---------------------------------------------------------------------------
# DatasetGenerator
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("domain", list(DOMAIN_REGISTRY))
def test_generate_all_domains(domain):
    schema = DOMAIN_REGISTRY[domain]().get_schema()
    gen = DatasetGenerator(schema, rows=10, seed=42)
    datasets = gen.generate()

    assert len(datasets) == len(schema.tables)
    for table in schema.tables:
        df = datasets[table.name]
        assert len(df) == 10, f"{table.name} should have 10 rows"
        assert list(df.columns), f"{table.name} should have columns"


def test_generate_respects_seed():
    schema = DOMAIN_REGISTRY["ecommerce"]().get_schema()
    df1 = DatasetGenerator(schema, rows=5, seed=0).generate()
    df2 = DatasetGenerator(schema, rows=5, seed=0).generate()
    assert df1["customers"]["email"].tolist() == df2["customers"]["email"].tolist()


def test_generate_different_seeds_differ():
    schema = DOMAIN_REGISTRY["ecommerce"]().get_schema()
    df1 = DatasetGenerator(schema, rows=20, seed=1).generate()
    df2 = DatasetGenerator(schema, rows=20, seed=2).generate()
    assert df1["customers"]["email"].tolist() != df2["customers"]["email"].tolist()


def test_fk_values_are_valid():
    """FK column values must be a subset of the referenced PK pool."""
    schema = _simple_schema(with_fk=True)
    gen = DatasetGenerator(schema, rows=20, seed=7)
    datasets = gen.generate()

    cat_ids = set(datasets["categories"]["id"].tolist())
    prod_cat_ids = set(datasets["products"]["category_id"].dropna().tolist())
    assert prod_cat_ids.issubset(cat_ids)


def test_generate_filtered_tables_no_fk_pool_error():
    """When a FK parent table is filtered out, generation must not raise."""
    schema = _simple_schema(with_fk=True)
    schema.tables = [t for t in schema.tables if t.name == "products"]
    gen = DatasetGenerator(schema, rows=5, seed=0)
    datasets = gen.generate()
    assert "products" in datasets
    assert len(datasets["products"]) == 5
