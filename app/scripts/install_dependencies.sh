#!/bin/bash
# ── install_dependencies.sh ───────────────────────────────────────────────────
# CodeDeploy lifecycle hook: AfterInstall (runs after files are copied to /app)
#
# Goal: Install Node.js production dependencies.
# 'npm ci' is preferred over 'npm install' in CI/CD because:
#   - It's faster (installs from package-lock.json exactly)
#   - It fails if package-lock.json is out of sync with package.json
#   - It never updates the lock file (deterministic builds)
# ─────────────────────────────────────────────────────────────────────────────

set -eu
echo "[install_dependencies.sh] Starting..."

cd /app

# Install only production dependencies (exclude devDependencies)
npm ci --only=production --prefer-offline

# Set correct ownership so appuser can read the files
chown -R appuser:appuser /app

echo "[install_dependencies.sh] Dependencies installed successfully."
