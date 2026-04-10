from dataforge.domains.base import DomainTemplate
from dataforge.core.schema import Column, ForeignKey, Table, DomainSchema


class EcommerceDomain(DomainTemplate):
    def get_schema(self) -> DomainSchema:
        categories = Table(
            name="categories",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("name", "str"),
                Column("description", "text", nullable=0.2),
            ],
            default_rows=20,
        )
        products = Table(
            name="products",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("name", "str"),
                Column("price", "float"),
                Column("stock_quantity", "int"),
                Column("category_id", "int", foreign_key=ForeignKey("categories", "id")),
            ],
            default_rows=200,
        )
        customers = Table(
            name="customers",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("name", "name"),
                Column("email", "email"),
                Column("phone", "phone", nullable=0.1),
                Column("city", "city"),
                Column("country", "country"),
                Column("created_at", "date"),
            ],
            default_rows=500,
        )
        orders = Table(
            name="orders",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("customer_id", "int", foreign_key=ForeignKey("customers", "id")),
                Column("status", "str"),
                Column("total_amount", "float"),
                Column("ordered_at", "date"),
            ],
            default_rows=1000,
        )
        order_items = Table(
            name="order_items",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("order_id", "int", foreign_key=ForeignKey("orders", "id")),
                Column("product_id", "int", foreign_key=ForeignKey("products", "id")),
                Column("quantity", "int"),
                Column("unit_price", "float"),
            ],
            default_rows=3000,
        )
        return DomainSchema(
            name="ecommerce",
            tables=[categories, products, customers, orders, order_items],
        )
