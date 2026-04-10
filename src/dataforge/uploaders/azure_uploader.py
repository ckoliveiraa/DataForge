import os
from pathlib import Path

from dataforge.uploaders.base import BaseUploader


class AzureUploader(BaseUploader):
    def __init__(self, credentials_path: str | None = None):
        try:
            from azure.storage.blob import BlobServiceClient
        except ImportError as err:
            raise ImportError(
                "azure-storage-blob is required for Azure uploads. "
                "Install it with: pip install 'dataforge[azure]'"
            ) from err
        self._BlobServiceClient = BlobServiceClient
        conn_str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
        if not conn_str:
            raise OSError("AZURE_STORAGE_CONNECTION_STRING environment variable is not set.")
        self._client = BlobServiceClient.from_connection_string(conn_str)

    def upload(self, file_path: Path, bucket: str, blob_name: str) -> str:
        container_client = self._client.get_container_client(bucket)
        with open(file_path, "rb") as f:
            container_client.upload_blob(name=blob_name, data=f, overwrite=True)
        return f"az://{bucket}/{blob_name}"
