from __future__ import annotations
from pathlib import Path
import json
import pandas as pd
from dataforge.writers.base import BaseWriter
from dataforge.core.schema import DomainSchema, ForeignKey


class JsonWriter(BaseWriter):
    def __init__(self, output_dir: Path, mode: str = "flat", schema: DomainSchema | None = None):
        super().__init__(output_dir)
        self.mode = mode  # "flat" (NDJSON) or "nested"
        self.schema = schema

    def write(self, name: str, df: pd.DataFrame) -> Path:
        out_dir = self._ensure_dir("json")
        path = out_dir / f"{name}.json"
        if self.mode == "flat":
            df.to_json(path, orient="records", lines=True, force_ascii=False)
        else:
            records = df.to_dict(orient="records")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2, default=str)
        return path

    def write_nested(self, datasets: dict[str, pd.DataFrame]) -> dict[str, Path]:
        """Write nested JSON where child records are embedded in parent rows."""
        if self.schema is None:
            raise ValueError("schema is required for nested JSON mode")

        out_dir = self._ensure_dir("json")
        written: dict[str, Path] = {}
        embedded: set[str] = set()

        # Build FK map: child_table -> list of (child_col, parent_table, parent_col)
        fk_map: dict[str, list[tuple[str, str, str]]] = {}
        for table in self.schema.tables:
            for col in table.columns:
                if col.foreign_key and col.foreign_key.ref_table != table.name:
                    fk_map.setdefault(table.name, []).append(
                        (col.name, col.foreign_key.ref_table, col.foreign_key.ref_column)
                    )

        # Build parent -> list of child tables
        parent_children: dict[str, list[str]] = {}
        for child, fks in fk_map.items():
            for _, parent, _ in fks:
                parent_children.setdefault(parent, []).append(child)

        def embed(parent_name: str, parent_records: list[dict]) -> list[dict]:
            children = parent_children.get(parent_name, [])
            for child_name in children:
                child_df = datasets.get(child_name)
                if child_df is None:
                    continue
                embedded.add(child_name)
                child_records = child_df.to_dict(orient="records")
                fks = fk_map.get(child_name, [])
                parent_fks = [(cc, pc) for cc, pt, pc in fks if pt == parent_name]
                if not parent_fks:
                    continue
                child_col, parent_col = parent_fks[0]
                # Group children by FK value
                groups: dict = {}
                for rec in child_records:
                    key = rec.get(child_col)
                    groups.setdefault(key, []).append(rec)
                for prec in parent_records:
                    key = prec.get(parent_col)
                    prec[child_name] = embed(child_name, groups.get(key, []))
            return parent_records

        # Find root tables (not a child of any other)
        all_children = {c for children in parent_children.values() for c in children}
        root_tables = [t for t in datasets if t not in all_children]

        for root in root_tables:
            df = datasets[root]
            records = embed(root, df.to_dict(orient="records"))
            path = out_dir / f"{root}.json"
            with open(path, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2, default=str)
            written[root] = path

        return written
