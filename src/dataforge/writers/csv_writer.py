from pathlib import Path

import pandas as pd

from dataforge.writers.base import BaseWriter


class CsvWriter(BaseWriter):
    def write(self, name: str, df: pd.DataFrame) -> Path:
        out_dir = self._ensure_dir("csv")
        path = out_dir / f"{name}.csv"
        df.to_csv(path, index=False)
        return path
