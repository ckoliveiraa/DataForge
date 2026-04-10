from dataforge.uploaders.gcs_uploader import GcsUploader
from dataforge.uploaders.s3_uploader import S3Uploader
from dataforge.uploaders.azure_uploader import AzureUploader

UPLOADER_REGISTRY = {
    "gcs": GcsUploader,
    "s3": S3Uploader,
    "azure": AzureUploader,
}
