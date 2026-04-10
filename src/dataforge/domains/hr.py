from dataforge.core.schema import Column, DomainSchema, ForeignKey, Table
from dataforge.domains.base import DomainTemplate


class HrDomain(DomainTemplate):
    def get_schema(self) -> DomainSchema:
        departments = Table(
            name="departments",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("name", "str"),
                Column("location", "city"),
            ],
            default_rows=10,
        )
        job_titles = Table(
            name="job_titles",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("title", "str"),
                Column("level", "str"),
            ],
            default_rows=20,
        )
        employees = Table(
            name="employees",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("name", "name"),
                Column("email", "email"),
                Column("hire_date", "date"),
                Column("department_id", "int", foreign_key=ForeignKey("departments", "id")),
                Column("job_title_id", "int", foreign_key=ForeignKey("job_titles", "id")),
                Column(
                    "manager_id", "int", foreign_key=ForeignKey("employees", "id"), nullable=0.1
                ),
            ],
            default_rows=300,
        )
        salaries = Table(
            name="salaries",
            columns=[
                Column("id", "int_seq", primary_key=True),
                Column("employee_id", "int", foreign_key=ForeignKey("employees", "id")),
                Column("amount", "float"),
                Column("currency", "currency"),
                Column("effective_date", "date"),
            ],
            default_rows=300,
        )
        return DomainSchema(
            name="hr",
            tables=[departments, job_titles, employees, salaries],
        )
