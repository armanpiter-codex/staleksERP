#!/usr/bin/env bash
# ── Staleks ERP — Deploy to VPS ───────────────────────────────────────────────
# Usage:
#   ./deploy.sh <VPS_IP> [SSH_USER]
#
# Prerequisites on VPS:
#   - Ubuntu 22.04+ (or any Linux with Docker)
#   - Docker & Docker Compose installed
#   - SSH key access configured
#
# Example:
#   ./deploy.sh 185.100.50.25 root
#   ./deploy.sh 185.100.50.25 deploy

set -euo pipefail

# ── Arguments ─────────────────────────────────────────────────────────────────
VPS_IP="${1:?Usage: ./deploy.sh <VPS_IP> [SSH_USER]}"
SSH_USER="${2:-root}"
REMOTE="${SSH_USER}@${VPS_IP}"
REMOTE_DIR="/opt/staleks-erp"

echo "============================================"
echo "  Staleks ERP — Deploy to ${VPS_IP}"
echo "============================================"

# ── Step 1: Check .env.prod exists locally ────────────────────────────────────
if [ ! -f ".env.prod" ]; then
    echo ""
    echo "ERROR: .env.prod not found!"
    echo "Copy the template and fill in real values:"
    echo "  cp .env.prod.example .env.prod"
    echo "  nano .env.prod"
    echo ""
    exit 1
fi

# ── Step 2: Sync project to VPS ──────────────────────────────────────────────
echo ""
echo "[1/5] Syncing project to ${REMOTE}:${REMOTE_DIR}..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude '.env' \
    --exclude '.env.local' \
    --exclude '.env.prod' \
    --exclude 'postgres_data' \
    --exclude 'redis_data' \
    --exclude '.git' \
    --exclude '.vscode' \
    --exclude '.idea' \
    ./ "${REMOTE}:${REMOTE_DIR}/"

# ── Step 3: Copy .env.prod as .env on VPS ────────────────────────────────────
echo ""
echo "[2/5] Copying .env.prod to VPS as .env..."
scp .env.prod "${REMOTE}:${REMOTE_DIR}/.env"

# ── Step 4: Build and start on VPS ───────────────────────────────────────────
echo ""
echo "[3/5] Building production images on VPS..."
ssh "${REMOTE}" "cd ${REMOTE_DIR} && docker compose -f docker-compose.prod.yml build"

echo ""
echo "[4/5] Starting production stack..."
ssh "${REMOTE}" "cd ${REMOTE_DIR} && docker compose -f docker-compose.prod.yml up -d"

# ── Step 5: Run migrations and seed ──────────────────────────────────────────
echo ""
echo "[5/5] Running migrations and seeding..."
ssh "${REMOTE}" "cd ${REMOTE_DIR} && sleep 10 && \
    docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head && \
    docker compose -f docker-compose.prod.yml exec -T backend python -m app.scripts.seed_db && \
    docker compose -f docker-compose.prod.yml exec -T backend python -m app.scripts.seed_configurator"

# ── Step 6: Health check ─────────────────────────────────────────────────────
echo ""
echo "Checking health..."
sleep 5
HEALTH=$(ssh "${REMOTE}" "curl -sf http://localhost/health" || echo "FAILED")
echo "Health: ${HEALTH}"

echo ""
echo "============================================"
echo "  Deploy complete!"
echo "  URL: http://${VPS_IP}"
echo "  Login: owner / ChangeMe123!"
echo "============================================"
