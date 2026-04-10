from dataforge.core.schema import Column, DomainSchema, ForeignKey, Table
from dataforge.domains.base import DomainTemplate


class FinanceDomain(DomainTemplate):
    def get_schema(self) -> DomainSchema:
        customers = Table(
            name="customers",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("name", "name"),
                Column("email", "email"),
                Column("country", "country"),
                Column("created_at", "date"),
            ],
            default_rows=500,
        )
        categories = Table(
            name="categories",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("name", "str"),
                Column("type", "str"),
            ],
            default_rows=15,
        )
        accounts = Table(
            name="accounts",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("customer_id", "int", foreign_key=ForeignKey("customers", "id")),
                Column("iban", "iban"),
                Column("currency", "currency"),
                Column("balance", "float"),
                Column("opened_at", "date"),
            ],
            default_rows=600,
        )
        transactions = Table(
            name="transactions",
            columns=[
                Column("id", "uuid", primary_key=True),
                Column("account_id", "int", foreign_key=ForeignKey("accounts", "id")),
                Column("category_id", "int", foreign_key=ForeignKey("categories", "id")),
                Column("amount", "float"),
                Column("type", "str"),
                Column("description", "text", nullable=0.3),
                Column("transacted_at", "date"),
            ],
            default_rows=5000,
        )
        return DomainSchema(
            name="finance",
            tables=[customers, categories, accounts, transactions],
        )
