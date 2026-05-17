#!/usr/bin/env bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ██████╗ ██╗  ██╗   ██╗██████╗ ██╗  ██╗"
echo "  ██╔════╝ ██║  ╚██╗ ██╔╝██╔══██╗██║  ██║"
echo "  ██║  ███╗██║   ╚████╔╝ ██████╔╝███████║"
echo "  ██║   ██║██║    ╚██╔╝  ██╔═══╝ ██╔══██║"
echo "  ╚██████╔╝███████╗██║   ██║     ██║  ██║"
echo "   ╚═════╝ ╚══════╝╚═╝   ╚═╝     ╚═╝  ╚═╝"
echo -e "${NC}"
echo "  Git-versioned technical documentation"
echo ""

# ── Check Docker ──────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${RED}Error: Docker is not installed.${NC}"
  echo "Install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

if ! docker info &>/dev/null; then
  echo -e "${RED}Error: Docker daemon is not running.${NC}"
  echo "Please start Docker Desktop and try again."
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo -e "${RED}Error: Docker Compose v2 is required.${NC}"
  echo "Please update Docker Desktop to the latest version."
  exit 1
fi

echo -e "${GREEN}✓ Docker found${NC}"

# ── Setup .env ────────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  if [ -f "backend/.env.example" ]; then
    cp backend/.env.example .env
    echo -e "${YELLOW}⚠ Created .env from .env.example - edit it before going to production${NC}"
  else
    echo -e "${RED}Error: backend/.env.example not found. Are you in the glyph root directory?${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ .env already exists${NC}"
fi

# ── Create data directories ───────────────────────────────────────────────────
mkdir -p data/repos data/docs data/cache
echo -e "${GREEN}✓ Data directories ready${NC}"

# ── Pull & start ──────────────────────────────────────────────────────────────
echo ""
echo "Starting Glyph services..."
docker compose pull --quiet 2>/dev/null || true
docker compose up -d --build

# ── Wait for backend healthcheck ─────────────────────────────────────────────
echo ""
echo -n "Waiting for backend to be ready"
RETRIES=30
until curl -sf http://localhost:8000/health &>/dev/null || [ $RETRIES -eq 0 ]; do
  echo -n "."
  sleep 3
  RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
  echo -e "\n${RED}Backend did not become healthy in time. Check logs:${NC}"
  echo "  docker compose logs backend"
  exit 1
fi

echo ""
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Glyph is running!                 ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  App:      http://localhost:3000       ║${NC}"
echo -e "${GREEN}║  API:      http://localhost:8000       ║${NC}"
echo -e "${GREEN}║  API docs: http://localhost:8000/docs  ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo "To stop:    docker compose down"
echo "Logs:       docker compose logs -f"
echo "Reset DB:   bash scripts/reset_db.sh"