from __future__ import annotations
from pathlib import Path
import pandas as pd
from dataforge.writers.base import BaseWriter

# Mapeamento pandas dtype -> tipo Avro
_PANDAS_TO_AVRO: dict[str, str] = {
    "int64":   "long",
    "int32":   "int",
    "float64": "double",
    "float32": "float",
    "bool":    "boolean",
    "object":  "string",
}


def _avro_type(dtype: str) -> list:
    """Retorna ["null", tipo] para permitir nulos em todos os campos."""
    avro = _PANDAS_TO_AVRO.get(str(dtype), "string")
    return ["null", avro]


def _infer_schema(name: str, df: pd.DataFrame) -> dict:
    fields = []
    for col, dtype in df.dtypes.items():
        fields.append({
            "name": col,
            "type": _avro_type(str(dtype)),
            "default": None,
        })
    return {
        "type": "record",
        "name": name,
        "fields": fields,
    }


class AvroWriter(BaseWriter):
    def write(self, name: str, df: pd.DataFrame) -> Path:
        try:
            import fastavro
        except ImportError:
            raise ImportError(
                "fastavro is required for Avro output. "
                "Install it with: pip install 'dataforge[avro]'"
            )

        out_dir = self._ensure_dir("avro")
        path = out_dir / f"{name}.avro"

        schema = _infer_schema(name, df)
        parsed_schema = fastavro.parse_schema(schema)

        # Converter para lista de dicts, substituindo NaN por None
        records = df.where(df.notna(), other=None).to_dict(orient="records")

        with open(path, "wb") as f:
            fastavro.writer(f, parsed_schema, records)

        return path
