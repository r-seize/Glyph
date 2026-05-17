#!/usr/bin/env bash
# Glyph one-line installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/r-seize/Glyph/main/install.sh | bash
#
# This script:
#   1. Downloads docker-compose.prod.yml and .env.example into the current directory
#   2. Generates strong random values for SECRET_KEY, MYSQL_PASSWORD, MEILISEARCH_KEY
#   3. Auto-detects available ports (defaults: frontend 3000, backend 8000)
#   4. Writes a ready-to-use .env
#   5. Starts the stack with `docker compose up -d`
#
# Requires: docker, docker compose, curl, openssl (or python3)

set -euo pipefail

REPO="https://raw.githubusercontent.com/r-seize/Glyph/main"

# ── Dependency checks ─────────────────────────────────────────────────────────

if command -v openssl >/dev/null 2>&1; then
  rand_hex() { openssl rand -hex "$1"; }
elif command -v python3 >/dev/null 2>&1; then
  rand_hex() { python3 -c "import secrets, sys; print(secrets.token_hex(int(sys.argv[1])))" "$1"; }
else
  echo "Error: openssl or python3 required to generate secrets." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed. Install Docker Engine first: https://docs.docker.com/get-docker/" >&2
  exit 1
fi

# ── Port detection ────────────────────────────────────────────────────────────

port_is_free() {
  local port=$1
  if command -v ss >/dev/null 2>&1; then
    ! ss -tlnp 2>/dev/null | grep -q ":${port}[^0-9]"
  elif command -v netstat >/dev/null 2>&1; then
    ! netstat -tlnp 2>/dev/null | grep -q ":${port}[^0-9]"
  elif command -v lsof >/dev/null 2>&1; then
    ! lsof -iTCP:"${port}" -sTCP:LISTEN -t >/dev/null 2>&1
  else
    ! bash -c "echo >/dev/tcp/127.0.0.1/${port}" 2>/dev/null
  fi
}

find_free_port() {
  local port=$1
  while ! port_is_free "$port"; do
    echo "  Port $port is in use, trying $((port + 1))..." >&2
    port=$((port + 1))
  done
  echo "$port"
}

echo "==> Detecting available ports..."
FRONTEND_PORT=$(find_free_port 3000)
BACKEND_PORT=$(find_free_port 8000)

[ "$FRONTEND_PORT" -ne 3000 ] && echo "  Frontend: port 3000 in use → using $FRONTEND_PORT"
[ "$BACKEND_PORT"  -ne 8000 ] && echo "  Backend:  port 8000 in use → using $BACKEND_PORT"

# ── Download files ────────────────────────────────────────────────────────────

echo "==> Downloading Glyph compose file..."
curl -fsSL -o docker-compose.prod.yml "$REPO/docker-compose.prod.yml"
curl -fsSL -o .env.example            "$REPO/.env.example"

# ── Write .env ────────────────────────────────────────────────────────────────

if [ -f .env ]; then
  echo "==> .env already exists, leaving it as-is."
else
  echo "==> Generating .env with secure random secrets..."
  cp .env.example .env

  SECRET_KEY=$(rand_hex 32)
  MYSQL_ROOT_PASSWORD=$(rand_hex 16)
  MYSQL_PASSWORD=$(rand_hex 16)
  MEILISEARCH_KEY=$(rand_hex 32)

  sed -i.bak \
    -e "s|^SECRET_KEY=.*|SECRET_KEY=$SECRET_KEY|" \
    -e "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD|" \
    -e "s|^MYSQL_PASSWORD=.*|MYSQL_PASSWORD=$MYSQL_PASSWORD|" \
    -e "s|^MEILISEARCH_KEY=.*|MEILISEARCH_KEY=$MEILISEARCH_KEY|" \
    -e "s|^FRONTEND_PORT=.*|FRONTEND_PORT=$FRONTEND_PORT|" \
    -e "s|^BACKEND_PORT=.*|BACKEND_PORT=$BACKEND_PORT|" \
    -e "s|^FRONTEND_URL=.*|FRONTEND_URL=http://localhost:$FRONTEND_PORT|" \
    -e "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://localhost:$BACKEND_PORT|" \
    -e "s|^APP_URL=.*|APP_URL=http://localhost:$BACKEND_PORT|" \
    -e "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://localhost:$FRONTEND_PORT|" \
    .env
  rm -f .env.bak
fi

# ── Start ─────────────────────────────────────────────────────────────────────

echo "==> Starting Glyph..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Glyph is starting. Wait ~1 minute for all containers to become healthy."
echo ""
echo "  Frontend: http://localhost:${FRONTEND_PORT}"
echo "  Backend:  http://localhost:${BACKEND_PORT}"
echo ""
echo "Useful commands:"
echo "  docker compose -f docker-compose.prod.yml logs -f      # follow logs"
echo "  docker compose -f docker-compose.prod.yml ps           # status"
echo "  docker compose -f docker-compose.prod.yml down         # stop"
echo ""
echo "Documentation: https://glyph-docs.netlify.app"
