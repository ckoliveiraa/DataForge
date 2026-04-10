# ─── Stage 1: Python build ────────────────────────────────────────────────────
FROM python:3.12-slim AS python-build

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Instala o build backend que o pyproject.toml exige
RUN pip install --no-cache-dir --upgrade pip "poetry-core>=2.0.0,<3.0.0"

# Copia apenas o necessário para resolver dependências
COPY pyproject.toml poetry.lock README.md ./
COPY src/ ./src/

# Instala o pacote e todos os extras necessários
RUN pip install --no-cache-dir ".[parquet,avro,sql,postgres,gcp,aws,azure]"


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
# Usa npm install (não npm ci) para resolver binários nativos corretos para Linux
COPY src/dataforge/frontend/package.json ./src/dataforge/frontend/
RUN npm install --prefix src/dataforge/frontend

# ── Frontend: restante dos arquivos ──
COPY src/dataforge/frontend/ ./src/dataforge/frontend/

# Pasta de output persistida via volume
RUN mkdir -p /app/output

EXPOSE 5173

ENV PYTHONPATH=/app/src

CMD ["npm", "run", "dev", "--prefix", "src/dataforge/frontend", "--", "--host", "0.0.0.0"]
