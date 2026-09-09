#!/usr/bin/env bash
# Deploy compro — update folder yang dilayani PM2, lalu restart
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${BRANCH:-main}"

log() { echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

command -v pm2 >/dev/null 2>&1 || die "PM2 belum terinstall (npm i -g pm2)"

pm2_cwd() {
  command -v node >/dev/null 2>&1 || return 0
  pm2 jlist 2>/dev/null | node -e '
    let raw = "";
    process.stdin.on("data", (c) => { raw += c; });
    process.stdin.on("end", () => {
      try {
        const apps = JSON.parse(raw);
        const app = apps.find((a) => a.name === "compro");
        const cwd = app && app.pm2_env && app.pm2_env.pm_cwd;
        if (cwd) process.stdout.write(cwd);
      } catch (_) {}
    });
  '
}

if [ -z "${APP_DIR:-}" ]; then
  DETECTED="$(pm2_cwd || true)"
  if [ -n "${DETECTED}" ]; then
    APP_DIR="$DETECTED"
  else
    APP_DIR="$ROOT"
  fi
fi

log "Deploy ke ${APP_DIR}"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ -d .git ] && git remote get-url origin >/dev/null 2>&1; then
  log "Pull origin/${BRANCH}"
  git fetch origin "$BRANCH"
  git reset --hard "origin/${BRANCH}"
  git clean -fd -e node_modules 2>/dev/null || true
elif [ "$APP_DIR" != "$ROOT" ]; then
  log "Salin file dari ${ROOT}"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --exclude .git --exclude node_modules --exclude .github "$ROOT"/ "$APP_DIR"/
  else
    tar -C "$ROOT" --exclude .git --exclude node_modules --exclude .github -cf - . | tar -C "$APP_DIR" -xf -
  fi
else
  log "Skip git (bukan repo git)"
fi

if pm2 describe compro >/dev/null 2>&1; then
  log "Restart PM2 compro"
  pm2 restart compro
else
  command -v npx >/dev/null 2>&1 || die "npx tidak ditemukan"
  log "Start PM2 compro (npx serve :8765)"
  pm2 start npx --name compro --cwd "$APP_DIR" -- serve -l 8765 .
fi

pm2 save

log "Deploy OK — http://127.0.0.1:8765"
