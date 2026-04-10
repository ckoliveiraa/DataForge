from pathlib import Path

from dataforge.uploaders.base import BaseUploader


class S3Uploader(BaseUploader):
    def __init__(self, credentials_path: str | None = None):
        try:
            import boto3
        except ImportError as err:
            raise ImportError(
                "boto3 is required for S3 uploads. Install it with: pip install 'dataforge[aws]'"
            ) from err
        self._boto3 = boto3

    def upload(self, file_path: Path, bucket: str, blob_name: str) -> str:
        client = self._boto3.client("s3")
        client.upload_file(str(file_path), bucket, blob_name)
        return f"s3://{bucket}/{blob_name}"
