#!/bin/bash
# ── stop_app.sh ───────────────────────────────────────────────────────────────
# CodeDeploy lifecycle hook: BeforeInstall
# 
# This runs on the GREEN instances BEFORE new files are copied.
# Goal: Ensure no old app process is running before we install new files.
# ─────────────────────────────────────────────────────────────────────────────

set -eu
echo "[stop_app.sh] Starting..."

# Stop the app service if it's running
# '|| true' means don't fail if the service doesn't exist yet (first deploy)
if systemctl is-active --quiet app; then
  echo "[stop_app.sh] App service is running. Stopping gracefully..."
  systemctl stop app
  echo "[stop_app.sh] App service stopped."
else
  echo "[stop_app.sh] App service is not running. Nothing to stop."
fi

echo "[stop_app.sh] Done."