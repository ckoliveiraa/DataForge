# ─── Stage 1: Python build ────────────────────────────────────────────────────
FROM python:3.12-slim AS python-build

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Instala wheel e build backend
RUN pip install --no-cache-dir pip==24.0 build wheel

# Copia apenas o necessário para resolver dependências
COPY pyproject.toml poetry.lock ./
COPY src/ ./src/

# Instala as dependências + extras diretamente via pip (sem poetry)
RUN pip install --no-cache-dir ".[parquet,avro,sql,postgres]"


# ─── Stage 2: Final image (Python + Node) ─────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Instala Node.js 20 LTS
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Copia pacotes Python instalados do stage anterior ──
COPY --from=python-build /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-build /usr/local/bin/dataset-gen /usr/local/bin/dataset-gen

# ── Source Python ──
COPY src/ ./src/
COPY schemas/ ./schemas/

# ── Frontend: instala dependências (cache de layer) ──
COPY src/dataforge/frontend/package.json src/dataforge/frontend/package-lock.json \
     ./src/dataforge/frontend/
RUN npm ci --prefix src/dataforge/frontend

# ── Frontend: restante dos arquivos ──
COPY src/dataforge/frontend/ ./src/dataforge/frontend/

# Pasta de output persistida via volume
RUN mkdir -p /app/output

EXPOSE 5173

ENV PYTHONPATH=/app/src

CMD ["npm", "run", "dev", "--prefix", "src/dataforge/frontend", "--", "--host", "0.0.0.0"]
