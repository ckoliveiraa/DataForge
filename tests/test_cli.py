"""Tests for the CLI commands."""

from __future__ import annotations

from pathlib import Path

import pytest
from click.testing import CliRunner

from dataforge.cli import cli


@pytest.fixture()
def runner():
    return CliRunner()


@pytest.fixture()
def tmp_output(tmp_path):
    return str(tmp_path / "out")


# ---------------------------------------------------------------------------
# list-domains
# ---------------------------------------------------------------------------


def test_list_domains(runner):
    result = runner.invoke(cli, ["list-domains"])
    assert result.exit_code == 0
    for domain in ("ecommerce", "rh", "finance"):
        assert domain in result.output


# ---------------------------------------------------------------------------
# schema-info
# ---------------------------------------------------------------------------


def test_schema_info_valid(runner):
    result = runner.invoke(cli, ["schema-info", "ecommerce"])
    assert result.exit_code == 0
    assert "Table:" in result.output


def test_schema_info_invalid_domain(runner):
    result = runner.invoke(cli, ["schema-info", "nonexistent"])
    assert result.exit_code != 0


# ---------------------------------------------------------------------------
# generate — formats
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("domain", ["ecommerce", "hr", "finance"])
def test_generate_csv(runner, tmp_output, domain):
    result = runner.invoke(
        cli,
        ["generate", "--domain", domain, "--rows", "5", "-f", "csv", "--output", tmp_output],
    )
    assert result.exit_code == 0, result.output
    assert "Done." in result.output
    csv_files = list(Path(tmp_output).rglob("*.csv"))
    assert csv_files, "No CSV files generated"


def test_generate_json_flat(runner, tmp_output):
    result = runner.invoke(
        cli,
        [
            "generate",
            "--domain",
            "hr",
            "--rows",
            "5",
            "-f",
            "json",
            "--json-mode",
            "flat",
            "--output",
            tmp_output,
        ],
    )
    assert result.exit_code == 0, result.output
    assert list(Path(tmp_output).rglob("*.json"))


def test_generate_json_nested(runner, tmp_output):
    result = runner.invoke(
        cli,
        [
            "generate",
            "--domain",
            "hr",
            "--rows",
            "5",
            "-f",
            "json",
            "--json-mode",
            "nested",
            "--output",
            tmp_output,
        ],
    )
    assert result.exit_code == 0, result.output
    assert list(Path(tmp_output).rglob("*.json"))


def test_generate_parquet(runner, tmp_output):
    result = runner.invoke(
        cli,
        ["generate", "--domain", "hr", "--rows", "5", "-f", "parquet", "--output", tmp_output],
    )
    assert result.exit_code == 0, result.output
    assert list(Path(tmp_output).rglob("*.parquet"))


def test_generate_avro(runner, tmp_output):
    result = runner.invoke(
        cli,
        ["generate", "--domain", "hr", "--rows", "5", "-f", "avro", "--output", tmp_output],
    )
    assert result.exit_code == 0, result.output
    assert list(Path(tmp_output).rglob("*.avro"))


# ---------------------------------------------------------------------------
# generate — filters
# ---------------------------------------------------------------------------


def test_generate_table_filter(runner, tmp_output):
    result = runner.invoke(
        cli,
        [
            "generate",
            "--domain",
            "ecommerce",
            "--rows",
            "5",
            "-f",
            "csv",
            "--tables",
            "orders",
            "--output",
            tmp_output,
        ],
    )
    assert result.exit_code == 0, result.output
    csv_files = list(Path(tmp_output).rglob("*.csv"))
    names = [f.stem for f in csv_files]
    assert "orders" in names
    assert "customers" not in names


def test_generate_column_filter(runner, tmp_output):
    import pandas as pd

    result = runner.invoke(
        cli,
        [
            "generate",
            "--domain",
            "ecommerce",
            "--rows",
            "5",
            "-f",
            "csv",
            "--tables",
            "categories",
            "--columns",
            "categories:id,name",
            "--output",
            tmp_output,
        ],
    )
    assert result.exit_code == 0, result.output
    csv_file = next(Path(tmp_output).rglob("categories.csv"))
    df = pd.read_csv(csv_file)
    assert list(df.columns) == ["id", "name"]


def test_generate_partition_by(runner, tmp_output):
    result = runner.invoke(
        cli,
        [
            "generate",
            "--domain",
            "ecommerce",
            "--rows",
            "10",
            "-f",
            "csv",
            "--tables",
            "orders",
            "--partition-by",
            "status",
            "--output",
            tmp_output,
        ],
    )
    assert result.exit_code == 0, result.output
    # Should produce status=<value>/ subdirectories
    partition_dirs = [p for p in Path(tmp_output).rglob("*") if p.is_dir() and "status=" in p.name]
    assert partition_dirs, "No partition directories found"


# ---------------------------------------------------------------------------
# generate — seed reproducibility
# ---------------------------------------------------------------------------


def test_generate_seed_reproducible(runner, tmp_path):
    import pandas as pd

    out1 = str(tmp_path / "a")
    out2 = str(tmp_path / "b")
    for out in (out1, out2):
        runner.invoke(
            cli,
            [
                "generate",
                "--domain",
                "hr",
                "--rows",
                "10",
                "-f",
                "csv",
                "--seed",
                "99",
                "--tables",
                "departments",
                "--output",
                out,
            ],
        )
    df1 = pd.read_csv(next(Path(out1).rglob("departments.csv")))
    df2 = pd.read_csv(next(Path(out2).rglob("departments.csv")))
    assert df1.equals(df2)


# ---------------------------------------------------------------------------
# generate — error cases
# ---------------------------------------------------------------------------


def test_generate_missing_domain(runner, tmp_output):
    result = runner.invoke(cli, ["generate", "--rows", "5", "--output", tmp_output])
    assert result.exit_code != 0


def test_generate_unknown_domain(runner, tmp_output):
    result = runner.invoke(
        cli, ["generate", "--domain", "unknown", "--rows", "5", "--output", tmp_output]
    )
    assert result.exit_code != 0


def test_generate_custom_domain_without_config(runner, tmp_output):
    result = runner.invoke(
        cli, ["generate", "--domain", "custom", "--rows", "5", "--output", tmp_output]
    )
    assert result.exit_code != 0
