from __future__ import annotations

import pandas as pd


class SqlLoader:
    """
    Carrega DataFrames em um banco SQL via SQLAlchemy.

    Suporte nativo (sem driver extra):
        SQLite:      sqlite:///caminho/banco.db
                     sqlite:///:memory:

    Com driver adicional:
        PostgreSQL:  postgresql+psycopg2://user:pass@host:5432/db
        MySQL:       mysql+pymysql://user:pass@host:3306/db
        SQL Server:  mssql+pyodbc://user:pass@host/db?driver=ODBC+Driver+17+for+SQL+Server
        BigQuery:    bigquery://project/dataset
    """

    def __init__(
        self,
        db_url: str,
        if_exists: str = "replace",
        schema: str | None = None,
        chunksize: int | None = None,
    ):
        try:
            from sqlalchemy import create_engine, text

            self._text = text
        except ImportError as err:
            raise ImportError(
                "sqlalchemy is required for SQL loading. "
                "Install it with: pip install 'dataforge[sql]'"
            ) from err

        self.engine = create_engine(db_url)
        self.if_exists = if_exists
        self.schema = schema
        self.chunksize = chunksize

        if schema:
            with self.engine.begin() as conn:
                conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))

    def load(self, name: str, df: pd.DataFrame) -> str:
        """Insere o DataFrame na tabela `name`. Retorna mensagem de confirmação."""
        df.to_sql(
            name=name,
            con=self.engine,
            if_exists=self.if_exists,
            index=False,
            schema=self.schema,
            chunksize=self.chunksize,
        )
        return f"{self.engine.url.get_backend_name()}://{name} ({len(df)} rows)"

    def close(self) -> None:
        self.engine.dispose()
