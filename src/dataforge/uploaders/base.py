from abc import ABC, abstractmethod
from pathlib import Path


class BaseUploader(ABC):
    @abstractmethod
    def upload(self, file_path: Path, bucket: str, prefix: str) -> str:
        """Upload file and return the remote URI."""
        ...
