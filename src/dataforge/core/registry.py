from __future__ import annotations

import re
from datetime import date as _date

# Dtypes that support min/max ranges
RANGE_SUPPORTED_DTYPES = {"int", "float", "date"}


def _normalize_date_value(value: str) -> str:
    """Normaliza sufixos de data relativos para o formato aceito pelo Faker.

    Converte 'm' minúsculo para 'M' (meses) e garante que os demais
    sufixos (d, w, y) fiquem em minúsculo, independente do que o usuário digitar.
    """
    return re.sub(
        r"([+-]?\d+)([a-zA-Z])",
        lambda m: m.group(1) + ("M" if m.group(2).lower() == "m" else m.group(2).lower()),
        value,
    )


FAKER_REGISTRY: dict[str, callable] = {
    "uuid": lambda f, n, **kw: [f.uuid4() for _ in range(n)],
    "int_seq": lambda f, n, seq_start=1, **kw: list(range(seq_start, seq_start + n)),
    "int": lambda f, n, min_value=0, max_value=100_000, **kw: [
        f.random_int(min=int(min_value), max=int(max_value)) for _ in range(n)
    ],
    "float": lambda f, n, min_value=0, max_value=10_000, **kw: [
        round(f.pyfloat(min_value=float(min_value), max_value=float(max_value)), 2)
        for _ in range(n)
    ],
    "str": lambda f, n, **kw: [f.word() for _ in range(n)],
    "bool": lambda f, n, **kw: [f.boolean() for _ in range(n)],
    "date": lambda f, n, min_value="-3y", max_value="today", **kw: [
        f.date_between(
            start_date=_normalize_date_value(min_value)
            if isinstance(min_value, str)
            else _date.fromisoformat(str(min_value)),
            end_date=_normalize_date_value(max_value)
            if isinstance(max_value, str)
            else _date.fromisoformat(str(max_value)),
        ).isoformat()
        for _ in range(n)
    ],
    "name": lambda f, n, **kw: [f.name() for _ in range(n)],
    "email": lambda f, n, **kw: [f.email() for _ in range(n)],
    "phone": lambda f, n, **kw: [f.phone_number() for _ in range(n)],
    "address": lambda f, n, **kw: [f.address().replace("\n", ", ") for _ in range(n)],
    "city": lambda f, n, **kw: [f.city() for _ in range(n)],
    "country": lambda f, n, **kw: [f.country() for _ in range(n)],
    "company": lambda f, n, **kw: [f.company() for _ in range(n)],
    "text": lambda f, n, **kw: [f.sentence() for _ in range(n)],
    "url": lambda f, n, **kw: [f.url() for _ in range(n)],
    "currency": lambda f, n, **kw: [f.currency_code() for _ in range(n)],
    "iban": lambda f, n, **kw: [f.iban() for _ in range(n)],
}


def generate_column(
    dtype: str,
    faker_provider: str | None,
    faker_instance,
    n: int,
    min_value=None,
    max_value=None,
    seq_start: int = 1,
) -> list:
    if faker_provider:
        provider_fn = getattr(faker_instance, faker_provider, None)
        if provider_fn:
            return [provider_fn() for _ in range(n)]
    fn = FAKER_REGISTRY.get(dtype)
    if fn is None:
        raise ValueError(f"Unknown dtype '{dtype}'. Available: {list(FAKER_REGISTRY)}")
    kwargs: dict = {}
    if min_value is not None:
        kwargs["min_value"] = min_value
    if max_value is not None:
        kwargs["max_value"] = max_value
    if dtype == "int_seq":
        kwargs["seq_start"] = seq_start
    return fn(faker_instance, n, **kwargs)
