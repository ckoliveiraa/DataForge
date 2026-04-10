# ─── Stage 1: Python deps ────────────────────────────────────────────────────
FROM python:3.12-slim AS python-deps

WORKDIR /app

# Install build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install --no-cache-dir poetry==1.8.3

# Copy only dependency files first (layer cache)
COPY pyproject.toml poetry.lock ./

# Export deps to requirements.txt (sem poetry overhead em runtime)
RUN poetry export -f requirements-txt --without-hashes -o requirements.txt
RUN poetry export -f requirements-txt --without-hashes --extras "parquet avro sql postgres" -o requirements-extras.txt


# ─── Stage 2: Final image (Python + Node) ────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install Node.js 20 LTS
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ──
COPY --from=python-deps /app/requirements.txt .
COPY --from=python-deps /app/requirements-extras.txt .

RUN pip install --no-cache-dir -r requirements-extras.txt

# ── Source Python ──
COPY src/ ./src/
COPY schemas/ ./schemas/

# Install the package in editable mode
RUN pip install --no-cache-dir -e .

# ── Frontend dependencies ──
COPY src/dataforge/frontend/package.json src/dataforge/frontend/package-lock.json ./src/dataforge/frontend/
RUN npm ci --prefix src/dataforge/frontend

# ── Copy remaining frontend source ──
COPY src/dataforge/frontend/ ./src/dataforge/frontend/

# Output directory (datasets gerados)
RUN mkdir -p /app/output

# Expose Vite dev server port
EXPOSE 5173

ENV PYTHONPATH=/app/src

CMD ["npm", "run", "dev", "--prefix", "src/dataforge/frontend", "--", "--host", "0.0.0.0"]
