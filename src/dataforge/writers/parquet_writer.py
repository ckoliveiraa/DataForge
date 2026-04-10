from pathlib import Path

import pandas as pd

from dataforge.writers.base import BaseWriter


class ParquetWriter(BaseWriter):
    def write(self, name: str, df: pd.DataFrame) -> Path:
        try:
            import pyarrow  # noqa: F401
        except ImportError as err:
            raise ImportError(
                "pyarrow is required for Parquet output. "
                "Install it with: pip install 'dataforge[parquet]'"
            ) from err
        out_dir = self._ensure_dir("parquet")
        path = out_dir / f"{name}.parquet"
        df.to_parquet(path, engine="pyarrow", compression="snappy", index=False)
        return path
