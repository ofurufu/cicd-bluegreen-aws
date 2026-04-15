#!/bin/bash
# ── start_app.sh ──────────────────────────────────────────────────────────────
# CodeDeploy lifecycle hook: ApplicationStart
#
# Goal: Start the application service and verify it came up.
# ─────────────────────────────────────────────────────────────────────────────

set -eu
echo "[start_app.sh] Starting..."

# Reload systemd in case the service file changed
systemctl daemon-reload

# Start the app
systemctl start app

# Give it 3 seconds to initialize
sleep 3

# Verify it's actually running
if systemctl is-active --quiet app; then
  echo "[start_app.sh] App service started successfully."
else
  echo "[start_app.sh] ERROR: App service failed to start!"
  echo "[start_app.sh] Last 50 lines of app log:"
  tail -50 /app/logs/app.log 2>/dev/null || journalctl -u app -n 50
  exit 1
fi

echo "[start_app.sh] Done."