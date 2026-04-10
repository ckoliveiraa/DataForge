from dataforge.writers.avro_writer import AvroWriter
from dataforge.writers.csv_writer import CsvWriter
from dataforge.writers.json_writer import JsonWriter
from dataforge.writers.parquet_writer import ParquetWriter

WRITER_REGISTRY = {
    "csv": CsvWriter,
    "json": JsonWriter,
    "parquet": ParquetWriter,
    "avro": AvroWriter,
}
