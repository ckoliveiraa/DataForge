from __future__ import annotations

import copy
from pathlib import Path

import yaml

from dataforge.core.schema import Column, DomainSchema, ForeignKey, Table


def load_schema(config_path: Path, base_schema: DomainSchema | None = None) -> DomainSchema:
    """Load a YAML config and merge with an optional base domain schema."""
    with open(config_path, encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    schema = _merge_with_base(raw, base_schema) if base_schema is not None else _parse_schema(raw)

    _validate_fks(schema)
    return schema


def _parse_schema(raw: dict) -> DomainSchema:
    tables = []
    for tname, tconf in raw.get("tables", {}).items():
        columns = []
        for cname, cconf in tconf.get("columns", {}).items():
            fk = None
            if "foreign_key" in cconf:
                fk_conf = cconf["foreign_key"]
                if "table" not in fk_conf or "column" not in fk_conf:
                    raise ValueError(
                        f"FK on '{cname}' is missing required fields. "
                        f"Expected: foreign_key: {{table: <name>, column: <name>}}"
                    )
                fk = ForeignKey(
                    ref_table=fk_conf["table"],
                    ref_column=fk_conf["column"],
                )
            raw_choices = cconf.get("choices")
            columns.append(
                Column(
                    name=cname,
                    dtype=cconf.get("dtype", "str"),
                    faker_provider=cconf.get("faker_provider"),
                    nullable=float(cconf.get("nullable", 0.0)),
                    primary_key=bool(cconf.get("primary_key", False)),
                    foreign_key=fk,
                    min_value=cconf.get("min"),
                    max_value=cconf.get("max"),
                    choices=[str(v) for v in raw_choices] if raw_choices else None,
                )
            )
        tables.append(
            Table(
                name=tname,
                columns=columns,
                default_rows=int(tconf.get("rows", 1000)),
            )
        )
    return DomainSchema(name=raw.get("domain", "custom"), tables=tables)


def _merge_with_base(raw: dict, base: DomainSchema) -> DomainSchema:
    schema = copy.deepcopy(base)
    overrides = raw.get("tables", {})
    for table in schema.tables:
        if table.name in overrides:
            tconf = overrides[table.name]
            if "rows" in tconf:
                table.default_rows = int(tconf["rows"])
            col_overrides = tconf.get("columns", {})
            for col in table.columns:
                if col.name in col_overrides:
                    conf = col_overrides[col.name]
                    if "dtype" in conf:
                        col.dtype = conf["dtype"]
                    if "nullable" in conf:
                        col.nullable = float(conf["nullable"])
                    if "faker_provider" in conf:
                        col.faker_provider = conf["faker_provider"]
                    if "min" in conf:
                        col.min_value = conf["min"]
                    if "max" in conf:
                        col.max_value = conf["max"]
                    if "choices" in conf:
                        col.choices = [str(v) for v in conf["choices"]] if conf["choices"] else None
    return schema


def _validate_fks(schema: DomainSchema) -> None:
    table_cols: dict[str, set[str]] = {t.name: {c.name for c in t.columns} for t in schema.tables}
    for table in schema.tables:
        for col in table.columns:
            if col.foreign_key:
                fk = col.foreign_key
                if fk.ref_table not in table_cols:
                    raise ValueError(
                        f"FK error in '{table.name}.{col.name}': "
                        f"table '{fk.ref_table}' not found in schema."
                    )
                if fk.ref_column not in table_cols[fk.ref_table]:
                    raise ValueError(
                        f"FK error in '{table.name}.{col.name}': "
                        f"column '{fk.ref_column}' not found in '{fk.ref_table}'."
                    )
