from abc import ABC, abstractmethod
from pathlib import Path

import pandas as pd


class BaseWriter(ABC):
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir

    @abstractmethod
    def write(self, name: str, df: pd.DataFrame) -> Path: ...

    def _ensure_dir(self, subdir: str) -> Path:
        path = self.output_dir / subdir
        path.mkdir(parents=True, exist_ok=True)
        return path
