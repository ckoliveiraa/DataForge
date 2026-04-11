from __future__ import annotations

import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path

import click

from dataforge.domains import DOMAIN_REGISTRY
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
            parts = spec.split(":", 1)
            if len(parts) != 2:
                raise click.UsageError(
                    f"Invalid --columns '{spec}'. Expected format: table:col1,col2"
                )
            tname, cols = parts
            col_map[tname] = [c.strip() for c in cols.split(",")]
        for table in schema.tables:
            if table.name in col_map:
                keep = set(col_map[table.name])
                table.columns = [c for c in table.columns if c.name in keep]

    return schema


def _write_df_direct(df, fmt: str, dest: Path, json_mode: str = "flat") -> None:
    """Escreve um DataFrame diretamente em dest no formato solicitado."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "csv":
        df.to_csv(dest, index=False)
    elif fmt == "json":
        if json_mode == "flat":
            df.to_json(dest, orient="records", lines=True, force_ascii=False)
        else:
            df.to_json(dest, orient="records", force_ascii=False, indent=2)
    elif fmt == "parquet":
        import pyarrow as pa
        import pyarrow.parquet as pq

        pq.write_table(pa.Table.from_pandas(df, preserve_index=False), dest, compression="snappy")
    elif fmt == "avro":
        import fastavro
        import pandas as _pd

        def _avro_type(series):
            if _pd.api.types.is_integer_dtype(series):
                return ["null", "long"]
            if _pd.api.types.is_float_dtype(series):
                return ["null", "double"]
            if _pd.api.types.is_bool_dtype(series):
                return ["null", "boolean"]
            return ["null", "string"]

        records = df.astype(object).where(df.notna(), other=None).to_dict(orient="records")
        schema = {
            "type": "record",
            "name": dest.stem,
            "fields": [{"name": c, "type": _avro_type(df[c]), "default": None} for c in df.columns],
        }
        with open(dest, "wb") as f:
            fastavro.writer(f, schema, records)


def _parse_increments(specs: tuple[str, ...]) -> list[dict]:
    """Parse '--increment table:column:step[:unit]' specs.
    unit: days (default) | hours | weeks | months | years | value (numeric)
    """
    result = []
    for spec in specs:
        parts = spec.split(":")
        if len(parts) < 3:
            raise click.UsageError(
                f"Invalid --increment '{spec}'. Expected: table:column:step[:unit]"
            )
        table, column, step_str = parts[0].strip(), parts[1].strip(), parts[2].strip()
        unit = parts[3].strip() if len(parts) > 3 else "days"
        try:
            step = float(step_str)
        except ValueError:
            raise click.UsageError(f"Invalid step '{step_str}' in --increment '{spec}'.") from None
        result.append({"table": table, "column": column, "step": step, "unit": unit})
    return result


def _apply_increments(datasets: dict, increments: list[dict], batch_index: int) -> dict:
    """Shift column values by step * batch_index for each increment spec."""
    import pandas as pd

    for inc in increments:
        table, column, step, unit = inc["table"], inc["column"], inc["step"], inc["unit"]
        if table not in datasets or column not in datasets[table].columns:
            continue
        df = datasets[table]
        offset = step * batch_index

        df = df.copy()
        if unit == "value":
            df[column] = pd.to_numeric(df[column], errors="coerce") + offset
        else:
            td_kwargs: dict = {
                "days": {"days": offset},
                "hours": {"hours": offset},
                "weeks": {"weeks": offset},
                "months": {"days": round(offset * 30.44)},
                "years": {"days": round(offset * 365.25)},
            }.get(unit, {"days": offset})
            delta = timedelta(**td_kwargs)
            df[column] = pd.to_datetime(df[column], errors="coerce") + delta
            df[column] = df[column].dt.strftime("%Y-%m-%d")

        datasets[table] = df
    return datasets


def _parse_partition_by(partition_by: tuple[str, ...]) -> dict[str, str]:
    """Converte lista de 'table:column' ou 'column' em {table: column}.
    Entradas sem ':' aplicam a coluna a todas as tabelas (chave '*')."""
    result: dict[str, str] = {}
    for spec in partition_by:
        if ":" in spec:
            table, col = spec.split(":", 1)
            result[table.strip()] = col.strip()
        else:
            if "*" in result:
                raise click.UsageError(
                    "Multiple --partition-by entries without 'table:' prefix are not allowed. "
                    "Use 'table:column' format to partition different tables by different columns."
                )
            result["*"] = spec.strip()
    return result


def _parse_date_granularity(specs: tuple[str, ...]) -> dict[str, str]:
    """Converte 'table:gran' ou 'gran' em {table: gran}. Chave '*' = todas as tabelas."""
    result: dict[str, str] = {}
    for spec in specs:
        if ":" in spec:
            table, gran = spec.split(":", 1)
            result[table.strip()] = gran.strip()
        else:
            result["*"] = spec.strip()
    return result


def _truncate_date_value(val, granularity: str) -> str:
    """Trunca um valor de data conforme granularidade ('year' → YYYY, 'month' → YYYY-MM)."""
    import pandas as pd

    try:
        ts = pd.Timestamp(val)
        if granularity == "year":
            return str(ts.year)
        elif granularity == "month":
            return f"{ts.year:04d}-{ts.month:02d}"
    except Exception:
        pass
    return str(val).replace("/", "-").replace(" ", "_")


def _write_batch(
    datasets: dict,
    formats: tuple[str, ...],
    out_path: Path,
    json_mode: str,
    schema,
    batch: int,
    recurrence: bool,
    partition_map: dict[str, str] | None = None,
    max_workers: int = 16,
    date_granularity_map: dict[str, str] | None = None,
) -> list[tuple[Path, str]]:
    """Escreve um batch de datasets. Retorna lista de (local_path, remote_sub) onde
    remote_sub é o caminho relativo ao prefix: 'dataset/table_name/[col=val/]filename.ext'."""
    written: list[tuple[Path, str]] = []

    for fmt in set(formats):
        ext = {"csv": ".csv", "json": ".json", "parquet": ".parquet", "avro": ".avro"}[fmt]

        if fmt == "json" and json_mode == "nested":
            from dataforge.writers.json_writer import JsonWriter

            writer = JsonWriter(out_path / schema.name, mode="nested", schema=schema)
            paths = writer.write_nested(datasets)
            for name, path in paths.items():
                click.echo(f"  [json/nested] {path}")
                written.append((path, f"{schema.name}/{name}/{path.name}"))

        elif fmt == "json" and recurrence and batch > 1:
            paths = _append_json_flat(
                datasets, out_path, schema.name, partition_map, date_granularity_map
            )
            for p, remote_sub in paths:
                written.append((p, remote_sub))

        elif fmt == "csv" and recurrence and batch > 1:
            paths = _append_csv(
                datasets, out_path, schema.name, partition_map, date_granularity_map
            )
            for p, remote_sub in paths:
                written.append((p, remote_sub))

        else:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")

            for name, df in datasets.items():
                # Resolve coluna de partição para esta tabela
                partition_by = None
                if partition_map:
                    partition_by = partition_map.get(name) or partition_map.get("*")

                # Resolve granularidade para esta tabela
                date_granularity: str | None = None
                if date_granularity_map:
                    date_granularity = date_granularity_map.get(name) or date_granularity_map.get(
                        "*"
                    )

                if partition_by and partition_by in df.columns:
                    # Escrita particionada: uma subpasta por valor da coluna — paralela
                    appendable = fmt in ("csv", "json")

                    def _write_partition(
                        val_group,
                        _fmt=fmt,
                        _ext=ext,
                        _name=name,
                        _partition_by=partition_by,
                        _ts=ts,
                        _recurrence=recurrence,
                        _appendable=appendable,
                        _date_granularity=date_granularity,
                    ):
                        val, group = val_group
                        if _date_granularity:
                            safe_val = _truncate_date_value(val, _date_granularity)
                        else:
                            safe_val = str(val).replace("/", "-").replace(" ", "_")
                        filename = (
                            f"{_name}_{_ts}{_ext}"
                            if _recurrence and not _appendable
                            else f"{_name}{_ext}"
                        )
                        dest = (
                            out_path
                            / schema.name
                            / _name
                            / f"{_partition_by}={safe_val}"
                            / filename
                        )
                        _write_df_direct(group, _fmt, dest, json_mode)
                        remote_sub = f"{schema.name}/{_name}/{_partition_by}={safe_val}/{filename}"
                        return dest, remote_sub

                    if date_granularity:
                        _grp_col = f"__partition_key_{partition_by}__"
                        df[_grp_col] = df[partition_by].apply(
                            lambda v, _g=date_granularity: _truncate_date_value(v, _g)
                        )
                        partitions = list(df.groupby(_grp_col))
                        df.drop(columns=[_grp_col], inplace=True)
                        for _key, _grp in partitions:
                            _grp.drop(columns=[_grp_col], inplace=True, errors="ignore")
                    else:
                        partitions = list(df.groupby(partition_by))
                    max_workers = min(max_workers, len(partitions))
                    results: list[tuple[Path, str]] = []
                    with ThreadPoolExecutor(max_workers=max_workers) as pool:
                        futures = {pool.submit(_write_partition, vg): vg for vg in partitions}
                        for fut in as_completed(futures):
                            dest, remote_sub = fut.result()
                            results.append((dest, remote_sub))

                    # Exibe e registra em ordem determinística
                    for dest, remote_sub in sorted(results, key=lambda x: str(x[0])):
                        click.echo(f"  [{fmt}] {dest}")
                        written.append((dest, remote_sub))
                else:
                    # Escrita normal: pasta por tabela
                    # CSV/JSON: mesmo nome (batch 1 cria, batch 2+ não chega aqui — vai p/ append)
                    # Parquet/Avro: sempre timestamp em recorrência para não sobrescrever batch anterior
                    appendable = fmt in ("csv", "json")
                    if recurrence and not appendable:
                        filename = f"{name}_{ts}{ext}"
                    else:
                        filename = f"{name}{ext}"
                    dest = out_path / schema.name / name / filename
                    _write_df_direct(df, fmt, dest, json_mode)
                    remote_sub = f"{schema.name}/{name}/{filename}"
                    click.echo(f"  [{fmt}] {dest}")
                    written.append((dest, remote_sub))

    return written


def _append_csv(
    datasets: dict,
    out_path: Path,
    dataset_name: str,
    partition_map: dict[str, str] | None = None,
    date_granularity_map: dict[str, str] | None = None,
) -> list[tuple[Path, str]]:
    written: list[tuple[Path, str]] = []
    for name, df in datasets.items():
        partition_by = (
            (partition_map.get(name) or partition_map.get("*")) if partition_map else None
        )
        date_granularity = (
            (date_granularity_map.get(name) or date_granularity_map.get("*"))
            if date_granularity_map
            else None
        )
        if partition_by and partition_by in df.columns:
            if date_granularity:
                _grp_col = f"__pk_{partition_by}__"
                df = df.copy()
                df[_grp_col] = df[partition_by].apply(
                    lambda v, _g=date_granularity: _truncate_date_value(v, _g)
                )
                groups = [(k, g.drop(columns=[_grp_col])) for k, g in df.groupby(_grp_col)]
            else:
                groups = list(df.groupby(partition_by))
            for val, group in groups:
                safe_val = (
                    str(val).replace("/", "-").replace(" ", "_")
                    if not date_granularity
                    else str(val)
                )
                dest_dir = out_path / dataset_name / name / f"{partition_by}={safe_val}"
                dest_dir.mkdir(parents=True, exist_ok=True)
                path = dest_dir / f"{name}.csv"
                group.to_csv(path, mode="a", index=False, header=not path.exists())
                click.echo(f"  [csv/append] {path} (+{len(group)} rows)")
                written.append(
                    (path, f"{dataset_name}/{name}/{partition_by}={safe_val}/{path.name}")
                )
        else:
            dest_dir = out_path / dataset_name / name
            dest_dir.mkdir(parents=True, exist_ok=True)
            path = dest_dir / f"{name}.csv"
            df.to_csv(path, mode="a", index=False, header=not path.exists())
            click.echo(f"  [csv/append] {path} (+{len(df)} rows)")
            written.append((path, f"{dataset_name}/{name}/{path.name}"))
    return written


def _append_json_flat(
    datasets: dict,
    out_path: Path,
    dataset_name: str,
    partition_map: dict[str, str] | None = None,
    date_granularity_map: dict[str, str] | None = None,
) -> list[tuple[Path, str]]:
    written: list[tuple[Path, str]] = []
    for name, df in datasets.items():
        partition_by = (
            (partition_map.get(name) or partition_map.get("*")) if partition_map else None
        )
        date_granularity = (
            (date_granularity_map.get(name) or date_granularity_map.get("*"))
            if date_granularity_map
            else None
        )
        if partition_by and partition_by in df.columns:
            if date_granularity:
                _grp_col = f"__pk_{partition_by}__"
                df = df.copy()
                df[_grp_col] = df[partition_by].apply(
                    lambda v, _g=date_granularity: _truncate_date_value(v, _g)
                )
                groups = [(k, g.drop(columns=[_grp_col])) for k, g in df.groupby(_grp_col)]
            else:
                groups = list(df.groupby(partition_by))
            for val, group in groups:
                safe_val = (
                    str(val).replace("/", "-").replace(" ", "_")
                    if not date_granularity
                    else str(val)
                )
                dest_dir = out_path / dataset_name / name / f"{partition_by}={safe_val}"
                dest_dir.mkdir(parents=True, exist_ok=True)
                path = dest_dir / f"{name}.json"
                with open(path, "a", encoding="utf-8") as f:
                    f.write(group.to_json(orient="records", lines=True, force_ascii=False))
                click.echo(f"  [json/append] {path} (+{len(group)} rows)")
                written.append(
                    (path, f"{dataset_name}/{name}/{partition_by}={safe_val}/{path.name}")
                )
        else:
            dest_dir = out_path / dataset_name / name
            dest_dir.mkdir(parents=True, exist_ok=True)
            path = dest_dir / f"{name}.json"
            with open(path, "a", encoding="utf-8") as f:
                f.write(df.to_json(orient="records", lines=True, force_ascii=False))
            click.echo(f"  [json/append] {path} (+{len(df)} rows)")
            written.append((path, f"{dataset_name}/{name}/{path.name}"))
    return written


def _do_upload(
    written_files: list[tuple[Path, str]],
    upload: str,
    bucket: str,
    prefix: str,
    credentials: str | None,
) -> None:
    uploader_cls = UPLOADER_REGISTRY.get(upload)
    if uploader_cls is None:
        raise click.UsageError(
            f"Unknown upload target '{upload}'. Available: {list(UPLOADER_REGISTRY)}"
        )
    uploader = uploader_cls(credentials_path=credentials)
    base = prefix.rstrip("/")
    for file_path, remote_sub in written_files:
        blob_name = f"{base}/{remote_sub}"
        uri = uploader.upload(file_path, bucket, blob_name)
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
@click.option(
    "--config", "-c", default=None, help="Path to YAML config (required for custom domain)."
)
@click.option(
    "--rows", "-r", default=None, type=int, help="Rows per table (overrides domain default)."
)
@click.option("--tables", "-t", multiple=True, help="Tables to include (repeatable). Default: all.")
@click.option("--columns", multiple=True, help="'table:col1,col2' column filter (repeatable).")
@click.option(
    "--format",
    "-f",
    "formats",
    multiple=True,
    default=["csv"],
    type=click.Choice(["csv", "json", "parquet", "avro"]),
    help="Output format (repeatable). Default: csv.",
)
@click.option("--output", "-o", default="./output", help="Output directory. Default: ./output")
@click.option(
    "--json-mode",
    "json_mode",
    default="flat",
    type=click.Choice(["flat", "nested"]),
    help="JSON mode: flat (NDJSON) or nested. Default: flat.",
)
@click.option("--seed", default=None, type=int, help="Random seed for reproducibility.")
# Cloud upload
@click.option(
    "--upload",
    default=None,
    type=click.Choice(["gcs", "s3", "azure"]),
    help="Cloud upload destination: gcs, s3 or azure.",
)
@click.option("--bucket", default=None, help="Bucket/container name for cloud upload.")
@click.option("--prefix", default="datasets/", help="Remote prefix/folder. Default: datasets/")
@click.option("--credentials", default=None, help="Path to cloud credentials file.")
@click.option(
    "--partition-by",
    "partition_by",
    multiple=True,
    help="Partition output Hive-style. Use 'column' (all tables) or 'table:column' (per table). Repeatable.",
)
@click.option(
    "--partition-date-granularity",
    "partition_date_granularity",
    multiple=True,
    help=(
        "Truncate date partition values. "
        "Use 'granularity' (all tables) or 'table:granularity' (per table). "
        "Granularity options: year (→ YYYY) or month (→ YYYY-MM). "
        "Example: --partition-date-granularity month  or  --partition-date-granularity orders:year"
    ),
)
# SQL loading
@click.option(
    "--db-url",
    default=None,
    help="SQLAlchemy connection URL. Examples: sqlite:///output.db | "
    "postgresql+psycopg2://user:pass@host/db",
)
@click.option(
    "--if-exists",
    default="replace",
    type=click.Choice(["replace", "append", "fail"]),
    help="Behaviour if SQL table already exists. Default: replace.",
)
@click.option("--db-schema", default=None, help="Database schema to write tables into.")
# Recurrence
@click.option(
    "--recurrence",
    "-R",
    default=None,
    type=float,
    help="Interval in seconds between batches. Enables recurrence mode (Ctrl+C to stop).",
)
@click.option(
    "--count",
    default=0,
    type=int,
    help="Number of batches to run in recurrence mode. 0 = infinite. Default: 0.",
)
@click.option(
    "--increment",
    multiple=True,
    help=(
        "Shift a column's values by step × batch_index. "
        "Format: table:column:step[:unit]. "
        "Units: days (default), hours, weeks, months, years, value. "
        "Example: orders:created_at:1:days  or  sales:amount:100:value"
    ),
)
@click.option(
    "--workers",
    default=16,
    type=int,
    help="Max parallel threads for partitioned writes. Default: 16.",
)
def generate(
    domain,
    config,
    rows,
    tables,
    columns,
    formats,
    output,
    json_mode,
    seed,
    upload,
    bucket,
    prefix,
    credentials,
    partition_by,
    partition_date_granularity,
    db_url,
    if_exists,
    db_schema,
    recurrence,
    count,
    increment,
    workers,
):
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
    seq_offsets: dict[str, int] = {}  # tracks cumulative rows per table for int_seq continuity
    try:
        while True:
            batch += 1
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            if is_recurrent:
                click.echo(f"\n[Batch {batch}] {ts}")

            # Seed incremental por batch para dados sempre diferentes
            batch_seed = (seed + batch - 1) if seed is not None else None
            generator = DatasetGenerator(
                schema, rows=rows, seed=batch_seed, seq_offsets=seq_offsets
            )
            datasets = generator.generate()

            # Apply column increments (shift values by step × batch_index)
            increment_specs = _parse_increments(increment) if increment else []
            if increment_specs:
                datasets = _apply_increments(datasets, increment_specs, batch - 1)

            # Atualiza offset de sequência para o próximo batch
            for tname, df in datasets.items():
                seq_offsets[tname] = seq_offsets.get(tname, 0) + len(df)

            # Arquivo
            written_files = _write_batch(
                datasets,
                formats,
                out_path,
                json_mode,
                schema,
                batch=batch,
                recurrence=is_recurrent,
                partition_map=_parse_partition_by(partition_by) if partition_by else None,
                max_workers=workers,
                date_granularity_map=_parse_date_granularity(partition_date_granularity)
                if partition_date_granularity
                else None,
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
    for name in sorted(DOMAIN_REGISTRY):
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
