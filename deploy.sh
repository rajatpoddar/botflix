#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
#  deploy.sh — Pull latest, stop containers, rebuild & run
#
#  Usage:
#    ./deploy.sh         Deploy with the latest code
#    ./deploy.sh --logs  Deploy and tail logs afterward
#    ./deploy.sh -l      Same as --logs
#    ./deploy.sh -y      Skip confirmation prompt (for CI / cron use)
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 Deploying Jellyfin VOD Platform …"
echo "═══════════════════════════════════════════════════════════════"

# ── Confirmation prompt ───────────────────────────────────────────────────────
if [[ "${1:-}" != "-y" ]]; then
  echo ""
  echo "⚠️  This will stop running containers and rebuild."
  read -r -p "   Proceed? (y/N) " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "   ❌ Canceled."
    exit 0
  fi
fi

# ── 1. Pull latest code from git ─────────────────────────────────────────────
if git rev-parse --is-inside-work-tree &>/dev/null; then
  echo ""
  echo "📦 Pulling latest changes from git …"

  # Stash any uncommitted changes so git pull doesn't fail mid-deploy
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "   ⚠️  Uncommitted changes detected — stashing temporarily …"
    git stash push --include-untracked --message "deploy.sh auto-stash $(date +%Y%m%d-%H%M%S)"
    STASHED=true
  fi

  git pull --rebase
  echo "   ✅ Git pull complete (HEAD: $(git rev-parse --short HEAD))"

  # Restore stashed changes if any
  if [[ "${STASHED:-false}" == "true" ]]; then
    git stash pop 2>/dev/null || echo "   ⚠️  Could not auto-pop stash — resolve manually"
  fi
else
  echo "⚠️  Not a git repository — skipping pull"
fi

# ── 2. Check required files ──────────────────────────────────────────────────
if [ ! -f backend/.env ]; then
  echo "⚠️  backend/.env not found! Copying from .env.example …"
  if [ -f backend/.env.example ]; then
    cp backend/.env.example backend/.env
    echo "   ✅ Created backend/.env from example"
  else
    echo "   ❌ backend/.env.example not found either — please create backend/.env manually"
    exit 1
  fi
fi

if [ ! -f frontend/.env ]; then
  echo "⚠️  frontend/.env not found! Copying from .env.example …"
  if [ -f frontend/.env.example ]; then
    cp frontend/.env.example frontend/.env
    echo "   ✅ Created frontend/.env from example"
  else
    echo "   ❌ frontend/.env.example not found either — please create frontend/.env manually"
    exit 1
  fi
fi

# ── 3. Stop running containers ──────────────────────────────────────────────
echo ""
echo "🛑 Stopping running containers …"
docker compose down --remove-orphans 2>/dev/null || docker-compose down --remove-orphans 2>/dev/null || true
echo "   ✅ Containers stopped"

# ── 4. Rebuild and start ─────────────────────────────────────────────────────
echo ""
echo "🏗️  Building and starting containers …"
docker compose up --build -d 2>/dev/null || docker-compose up --build -d
echo "   ✅ Containers started"

# ── 5. Show status ───────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  📋 Container Status"
echo "═══════════════════════════════════════════════════════════════"
docker compose ps 2>/dev/null || docker-compose ps

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Deploy complete!"
echo ""
echo "  🌐 Frontend : http://localhost:5173"
echo "  🔧 Backend  : http://localhost:8832/docs"
echo "═══════════════════════════════════════════════════════════════"

# ── 6. Tail logs (optional) ──────────────────────────────────────────────────
if [[ "${1:-}" == "--logs" || "${1:-}" == "-l" || "${2:-}" == "--logs" || "${2:-}" == "-l" ]]; then
  echo ""
  echo "📜 Tailing logs (Ctrl+C to stop) …"
  echo "───────────────────────────────────────────"
  docker compose logs -f 2>/dev/null || docker-compose logs -f
fi
