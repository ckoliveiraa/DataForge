from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ForeignKey:
    ref_table: str
    ref_column: str


@dataclass
class Column:
    name: str
    dtype: str  # "int", "str", "float", "date", "bool", "email", "uuid", "int_seq"
    faker_provider: str | None = None
    nullable: float = 0.0
    primary_key: bool = False
    foreign_key: ForeignKey | None = None
    min_value: str | int | float | None = None  # for int/float: numeric; for date: "YYYY-MM-DD"
    max_value: str | int | float | None = None  # for int/float: numeric; for date: "YYYY-MM-DD"
    choices: list[str] | None = (
        None  # fixed set of values to sample from (overrides dtype/faker_provider)
    )


@dataclass
class Table:
    name: str
    columns: list[Column]
    default_rows: int = 1000


@dataclass
class DomainSchema:
    name: str
    tables: list[Table] = field(default_factory=list)
