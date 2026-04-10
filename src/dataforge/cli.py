from __future__ import annotations

import sys
import time
from datetime import datetime
from pathlib import Path

import click

from dataforge.domains import DOMAIN_REGISTRY
from dataforge.writers import WRITER_REGISTRY
from dataforge.uploaders import UPLOADER_REGISTRY


def _load_schema(domain: str, config: str | None):
    from dataforge.config.loader import load_schema

    if domain == "custom":
        if not config:
            raise click.UsageError("--config is required when --domain is 'custom'.")
        return load_schema(Path(config))

    if domain not in DOMAIN_REGISTRY:
        raise click.UsageError(
            f"Unknown domain '{domain}'. Available: {', '.join(DOMAIN_REGISTRY)}"
        )

    base_schema = DOMAIN_REGISTRY[domain]().get_schema()
    if config:
        return load_schema(Path(config), base_schema=base_schema)
    return base_schema


def _filter_schema(schema, tables: tuple[str, ...], columns: tuple[str, ...]):
    if tables:
        schema.tables = [t for t in schema.tables if t.name in tables]

    if columns:
        col_map: dict[str, list[str]] = {}
        for spec in columns:
            tname, cols = spec.split(":", 1)
            col_map[tname] = [c.strip() for c in cols.split(",")]
        for table in schema.tables:
            if table.name in col_map:
                keep = set(col_map[table.name])
                table.columns = [c for c in table.columns if c.name in keep]

    return schema


def _write_batch(
    datasets: dict,
    formats: tuple[str, ...],
    out_path: Path,
    json_mode: str,
    schema,
    batch: int,
    recurrence: bool,
) -> list[Path]:
    """Escreve um batch de datasets nos formatos solicitados. Retorna lista de arquivos escritos."""
    written: list[Path] = []

    for fmt in set(formats):
        if fmt == "json" and json_mode == "nested":
            from dataforge.writers.json_writer import JsonWriter
            writer = JsonWriter(out_path, mode="nested", schema=schema)
            paths = writer.write_nested(datasets)
            for name, path in paths.items():
                click.echo(f"  [json/nested] {path}")
                written.append(path)

        elif fmt == "json":
            # Em recorrência: append de linhas NDJSON no mesmo arquivo
            from dataforge.writers.json_writer import JsonWriter
            if recurrence and batch > 1:
                _append_json_flat(datasets, out_path)
                for name in datasets:
                    written.append(out_path / "json" / f"{name}.json")
            else:
                writer = JsonWriter(out_path, mode="flat")
                for name, df in datasets.items():
                    path = writer.write(name, df)
                    click.echo(f"  [json] {path}")
                    written.append(path)

        elif fmt == "csv":
            # Em recorrência: append de linhas CSV (sem header a partir do batch 2)
            if recurrence and batch > 1:
                _append_csv(datasets, out_path)
                for name in datasets:
                    written.append(out_path / "csv" / f"{name}.csv")
            else:
                writer = WRITER_REGISTRY["csv"](out_path)
                for name, df in datasets.items():
                    path = writer.write(name, df)
                    click.echo(f"  [csv] {path}")
                    written.append(path)

        else:
            # Parquet e Avro: novo arquivo por batch com sufixo de timestamp
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            writer = WRITER_REGISTRY[fmt](out_path)
            for name, df in datasets.items():
                # Renomeia após escrita para incluir o timestamp
                path = writer.write(name, df)
                if recurrence and batch > 1:
                    new_path = path.parent / f"{name}_{ts}{path.suffix}"
                    path.rename(new_path)
                    path = new_path
                click.echo(f"  [{fmt}] {path}")
                written.append(path)

    return written


def _append_csv(datasets: dict, out_path: Path) -> None:
    import pandas as pd
    csv_dir = out_path / "csv"
    csv_dir.mkdir(parents=True, exist_ok=True)
    for name, df in datasets.items():
        path = csv_dir / f"{name}.csv"
        df.to_csv(path, mode="a", index=False, header=not path.exists())
        click.echo(f"  [csv/append] {path} (+{len(df)} rows)")


def _append_json_flat(datasets: dict, out_path: Path) -> None:
    json_dir = out_path / "json"
    json_dir.mkdir(parents=True, exist_ok=True)
    for name, df in datasets.items():
        path = json_dir / f"{name}.json"
        with open(path, "a", encoding="utf-8") as f:
            f.write(df.to_json(orient="records", lines=True, force_ascii=False))
        click.echo(f"  [json/append] {path} (+{len(df)} rows)")


def _do_upload(written_files: list[Path], upload: str, bucket: str, prefix: str, credentials: str | None) -> None:
    uploader_cls = UPLOADER_REGISTRY.get(upload)
    if uploader_cls is None:
        raise click.UsageError(f"Unknown upload target '{upload}'. Available: {list(UPLOADER_REGISTRY)}")
    uploader = uploader_cls(credentials_path=credentials)
    for file_path in written_files:
        uri = uploader.upload(file_path, bucket, prefix)
        click.echo(f"  [upload] {uri}")


def _do_sql(datasets: dict, db_url: str, if_exists: str, db_schema: str | None) -> None:
    from dataforge.loaders.sql_loader import SqlLoader
    loader = SqlLoader(db_url=db_url, if_exists=if_exists, schema=db_schema)
    for name, df in datasets.items():
        result = loader.load(name, df)
        click.echo(f"  [sql] {result}")
    loader.close()


@click.group()
def cli():
    """Dataforge — synthetic relational dataset generator."""


@cli.command()
@click.option("--domain", "-d", required=True, help="Domain: ecommerce | hr | finance | custom")
@click.option("--config", "-c", default=None, help="Path to YAML config (required for custom domain).")
@click.option("--rows", "-r", default=None, type=int, help="Rows per table (overrides domain default).")
@click.option("--tables", "-t", multiple=True, help="Tables to include (repeatable). Default: all.")
@click.option("--columns", multiple=True, help="'table:col1,col2' column filter (repeatable).")
@click.option("--format", "-f", "formats", multiple=True, default=["csv"],
              type=click.Choice(["csv", "json", "parquet", "avro"]),
              help="Output format (repeatable). Default: csv.")
@click.option("--output", "-o", default="./output", help="Output directory. Default: ./output")
@click.option("--json-mode", "json_mode", default="flat", type=click.Choice(["flat", "nested"]),
              help="JSON mode: flat (NDJSON) or nested. Default: flat.")
@click.option("--seed", default=None, type=int, help="Random seed for reproducibility.")
# Cloud upload
@click.option("--upload", default=None, type=click.Choice(["gcs", "s3", "azure"]),
              help="Cloud upload destination: gcs, s3 or azure.")
@click.option("--bucket", default=None, help="Bucket/container name for cloud upload.")
@click.option("--prefix", default="datasets/", help="Remote prefix/folder. Default: datasets/")
@click.option("--credentials", default=None, help="Path to cloud credentials file.")
# SQL loading
@click.option("--db-url", default=None,
              help="SQLAlchemy connection URL. Examples: sqlite:///output.db | "
                   "postgresql+psycopg2://user:pass@host/db")
@click.option("--if-exists", default="replace",
              type=click.Choice(["replace", "append", "fail"]),
              help="Behaviour if SQL table already exists. Default: replace.")
@click.option("--db-schema", default=None, help="Database schema to write tables into.")
# Recurrence
@click.option("--recurrence", "-R", default=None, type=float,
              help="Interval in seconds between batches. Enables recurrence mode (Ctrl+C to stop).")
@click.option("--count", default=0, type=int,
              help="Number of batches to run in recurrence mode. 0 = infinite. Default: 0.")
def generate(domain, config, rows, tables, columns, formats, output, json_mode,
             seed, upload, bucket, prefix, credentials,
             db_url, if_exists, db_schema,
             recurrence, count):
    """Generate synthetic datasets and optionally write to files, cloud or SQL.

    Use --recurrence <seconds> to keep generating batches continuously.
    """
    from dataforge.core.generator import DatasetGenerator

    schema = _load_schema(domain, config)
    schema = _filter_schema(schema, tables, columns)
    out_path = Path(output)

    # Em modo recorrente, SQL deve usar append a partir do batch 2
    is_recurrent = recurrence is not None
    sql_if_exists = if_exists

    if is_recurrent:
        click.echo(
            f"Recurrence mode: interval={recurrence}s | "
            f"batches={'infinite' if count == 0 else count} | "
            f"Ctrl+C to stop"
        )
        click.echo("-" * 60)

    batch = 0
    try:
        while True:
            batch += 1
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            if is_recurrent:
                click.echo(f"\n[Batch {batch}] {ts}")

            # Seed incremental por batch para dados sempre diferentes
            batch_seed = (seed + batch - 1) if seed is not None else None
            generator = DatasetGenerator(schema, rows=rows, seed=batch_seed)
            datasets = generator.generate()

            # Arquivo
            written_files = _write_batch(
                datasets, formats, out_path, json_mode, schema,
                batch=batch, recurrence=is_recurrent,
            )

            # Upload
            if upload:
                if not bucket:
                    raise click.UsageError("--bucket is required when --upload is set.")
                _do_upload(written_files, upload, bucket, prefix, credentials)

            # SQL — append a partir do batch 2 para não apagar dados anteriores
            if db_url:
                effective_if_exists = sql_if_exists if batch == 1 else "append"
                _do_sql(datasets, db_url, effective_if_exists, db_schema)

            if not is_recurrent:
                break

            # Verificar limite de batches
            if count > 0 and batch >= count:
                click.echo(f"\nConcluido: {batch} batch(es) gerado(s).")
                break

            click.echo(f"  Aguardando {recurrence}s... (Ctrl+C para parar)")
            time.sleep(recurrence)

    except KeyboardInterrupt:
        click.echo(f"\n\nInterrompido pelo usuario. {batch} batch(es) gerado(s).")

    if not is_recurrent:
        click.echo("Done.")


@cli.command("list-domains")
def list_domains():
    """List available built-in domains."""
    for name in DOMAIN_REGISTRY:
        click.echo(f"  {name}")


@cli.command("schema-info")
@click.argument("domain")
def schema_info(domain: str):
    """Display tables, columns and FKs for a domain."""
    if domain not in DOMAIN_REGISTRY:
        click.echo(f"Unknown domain '{domain}'. Available: {', '.join(DOMAIN_REGISTRY)}", err=True)
        sys.exit(1)

    schema = DOMAIN_REGISTRY[domain]().get_schema()
    click.echo(f"Domain: {schema.name}")
    for table in schema.tables:
        click.echo(f"\n  Table: {table.name}  (default rows: {table.default_rows})")
        for col in table.columns:
            flags = []
            if col.primary_key:
                flags.append("PK")
            if col.foreign_key:
                flags.append(f"FK->{col.foreign_key.ref_table}.{col.foreign_key.ref_column}")
            if col.nullable:
                flags.append(f"nullable={col.nullable}")
            flag_str = f"  [{', '.join(flags)}]" if flags else ""
            click.echo(f"    {col.name}: {col.dtype}{flag_str}")
