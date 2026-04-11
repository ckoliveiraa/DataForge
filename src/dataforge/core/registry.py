from __future__ import annotations

import random
import re
from datetime import date as _date
from datetime import timedelta as _timedelta

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


def _generate_floats(n: int, min_value: float, max_value: float) -> list[float]:
    """Gera floats com distribuição log-normal, espelhando valores monetários reais.

    Valores monetários reais seguem uma distribuição log-normal: muitas transações
    pequenas/médias e poucas muito grandes. A distribuição é calibrada para que
    a mediana fique em ~20% do range e a média em ~35%, com cauda longa para cima.
    """
    import math

    span = max_value - min_value
    if span <= 0:
        return [round(min_value, 2)] * n

    # Calibra mu/sigma para que a mediana fique em ~20% do span
    # log-normal: mediana = exp(mu), mean = exp(mu + sigma²/2)
    target_median = min_value + span * 0.20
    sigma = 1.1  # cauda longa — realista para transações
    mu = math.log(max(target_median - min_value, 1e-9))

    results = []
    for _ in range(n):
        raw = random.lognormvariate(mu, sigma)
        # Clamp dentro do range e arredonda para 2 casas
        value = round(min(max(raw + min_value, min_value), max_value), 2)
        results.append(value)
    return results


def _resolve_date(f, value) -> _date:
    """Converte min/max para objeto date."""
    if not isinstance(value, str):
        return _date.fromisoformat(str(value))
    normalized = _normalize_date_value(value)
    return f.date_between(start_date=normalized, end_date=normalized)


def _generate_dates(f, n: int, min_value, max_value) -> list[str]:
    """Gera n datas simulando o padrão de transações reais.

    Combina três efeitos independentes para cada data do range:

    1. Ruído base aleatório (log-normal) — dias "quentes" e "frios" surgem
       organicamente, sem padrão fixo.
    2. Dia da semana — seg-sex recebem ~2× mais volume que sáb-dom,
       refletindo o comportamento típico de transações comerciais.
    3. Fim de mês — os últimos 3 dias do mês recebem um spike de 1.5×,
       simulando fechamentos, pagamentos e renovações.

    O produto dos três fatores forma o peso final de cada data.
    """
    import math

    start = _resolve_date(f, min_value)
    end = _resolve_date(f, max_value)
    total_days = max((end - start).days, 1)

    # Gera todas as datas do range
    all_dates = [start + _timedelta(days=d) for d in range(total_days + 1)]

    weights = []
    for d in all_dates:
        # 1. Ruído log-normal: media=0, sigma=0.6 → maioria entre 0.5x e 2x
        noise = math.exp(random.gauss(0, 0.6))

        # 2. Efeito dia da semana: seg=0 ... dom=6; fim de semana leva 50% do volume
        weekday_factor = 1.0 if d.weekday() < 5 else 0.5

        # 3. Spike de fim de mês: últimos 3 dias do mês
        import calendar

        last_day = calendar.monthrange(d.year, d.month)[1]
        month_end_factor = 1.5 if d.day >= last_day - 2 else 1.0

        weights.append(noise * weekday_factor * month_end_factor)

    return [random.choices(all_dates, weights=weights, k=1)[0].isoformat() for _ in range(n)]


FAKER_REGISTRY: dict[str, callable] = {
    "uuid": lambda f, n, **kw: [f.uuid4() for _ in range(n)],
    "int_seq": lambda f, n, seq_start=1, **kw: list(range(seq_start, seq_start + n)),
    "int": lambda f, n, min_value=0, max_value=100_000, **kw: [
        f.random_int(min=int(min_value), max=int(max_value)) for _ in range(n)
    ],
    "float": lambda f, n, min_value=0, max_value=10_000, **kw: _generate_floats(
        n, float(min_value), float(max_value)
    ),
    "str": lambda f, n, **kw: [f.word() for _ in range(n)],
    "bool": lambda f, n, **kw: [f.boolean() for _ in range(n)],
    "date": lambda f, n, min_value="-3y", max_value="today", **kw: _generate_dates(
        f, n, min_value, max_value
    ),
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
