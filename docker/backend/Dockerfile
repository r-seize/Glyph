FROM python:3.12-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock* ./

RUN uv pip install --system \
    "alembic>=1.13" \
    "bcrypt>=4.1" \
    "cryptography>=42" \
    "email-validator>=2.1" \
    "fastapi>=0.115" \
    "gitpython>=3.1.40" \
    "httpx>=0.27" \
    "meilisearch>=0.31" \
    "pydantic>=2.7" \
    "pydantic-settings>=2.5" \
    "pymysql>=1.1" \
    "python-jose[cryptography]>=3.3" \
    "python-multipart>=0.0.9" \
    "sqlalchemy>=2.0" \
    "uvicorn[standard]>=0.30"

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
