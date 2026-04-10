from pathlib import Path
from dataforge.uploaders.base import BaseUploader


class GcsUploader(BaseUploader):
    def __init__(self, credentials_path: str | None = None):
        try:
            from google.cloud import storage
        except ImportError:
            raise ImportError(
                "google-cloud-storage is required for GCS uploads. "
                "Install it with: pip install 'dataforge[gcp]'"
            )
        self._storage = storage
        self.credentials_path = credentials_path

    def _client(self):
        if self.credentials_path:
            return self._storage.Client.from_service_account_json(self.credentials_path)
        return self._storage.Client()

    def upload(self, file_path: Path, bucket: str, prefix: str) -> str:
        client = self._client()
        blob_name = f"{prefix.rstrip('/')}/{file_path.name}"
        bucket_obj = client.bucket(bucket)
        blob = bucket_obj.blob(blob_name)
        blob.upload_from_filename(str(file_path))
        uri = f"gs://{bucket}/{blob_name}"
        return uri
