#!/usr/bin/env bash
# Deploy compro — git pull + restart PM2
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BRANCH="${BRANCH:-main}"

log() { echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# --- Preflight ---
command -v pm2 >/dev/null 2>&1 || die "PM2 belum terinstall (npm i -g pm2)"
command -v npx >/dev/null 2>&1 || die "npx tidak ditemukan"

# --- Git pull ---
if [ -d .git ] && git remote get-url origin >/dev/null 2>&1; then
  log "Pull origin/${BRANCH}"
  git fetch origin "$BRANCH"
  git reset --hard "origin/${BRANCH}"
  git clean -fd -e node_modules 2>/dev/null || true
else
  log "Skip git (bukan repo git)"
fi

# --- PM2 ---
if pm2 describe compro >/dev/null 2>&1; then
  log "Restart PM2 compro"
  pm2 restart compro
else
  log "Start PM2 compro"
  pm2 start ecosystem.config.cjs
fi

pm2 save

log "Deploy OK — http://127.0.0.1:8765"
