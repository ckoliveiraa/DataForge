from abc import ABC, abstractmethod
from pathlib import Path


class BaseUploader(ABC):
    @abstractmethod
    def upload(self, file_path: Path, bucket: str, blob_name: str) -> str:
        """Upload file_path to bucket at blob_name and return the remote URI."""
        ...
