#!/bin/bash
# ── validate_service.sh ───────────────────────────────────────────────────────
# CodeDeploy lifecycle hook: ValidateService
#
# Goal: Confirm the app is serving traffic correctly before CodeDeploy
#       shifts traffic from Blue to Green.
#
# This is your last chance to catch a broken deployment.
# If this script exits with a non-zero code, CodeDeploy rolls back.
# ─────────────────────────────────────────────────────────────────────────────

set -eu
echo "[validate_service.sh] Starting health check validation..."

MAX_RETRIES=12      # Try 12 times
RETRY_INTERVAL=10   # Wait 10 seconds between tries
HEALTH_URL="http://localhost:3000/health"

for attempt in $(seq 1 $MAX_RETRIES); do
  echo "[validate_service.sh] Attempt ${attempt}/${MAX_RETRIES} — checking ${HEALTH_URL}"
  
  # Use curl to hit the health endpoint
  # -s = silent (no progress bar)
  # -o /dev/null = discard body (we only care about status code)
  # -w "%{http_code}" = print only the HTTP status code
  # --max-time 5 = fail if no response in 5 seconds
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${HEALTH_URL}" || echo "000")
  
  if [ "${HTTP_STATUS}" = "200" ]; then
    echo "[validate_service.sh] ✓ Health check PASSED (HTTP ${HTTP_STATUS}) on attempt ${attempt}"
    
    # Also validate the response body has 'healthy' status
    BODY=$(curl -s --max-time 5 "${HEALTH_URL}" || echo '{}')
    STATUS_FIELD=$(echo "${BODY}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unknown")
    
    if [ "${STATUS_FIELD}" = "healthy" ]; then
      echo "[validate_service.sh] ✓ Response body confirms status=healthy"
      echo "[validate_service.sh] Validation complete. Deployment proceeding."
      exit 0
    else
      echo "[validate_service.sh] ✗ Response body status is '${STATUS_FIELD}', expected 'healthy'"
    fi
  else
    echo "[validate_service.sh] ✗ Health check FAILED (HTTP ${HTTP_STATUS})"
  fi
  
  if [ "${attempt}" -lt "${MAX_RETRIES}" ]; then
    echo "[validate_service.sh] Waiting ${RETRY_INTERVAL}s before retry..."
    sleep "${RETRY_INTERVAL}"
  fi
done

echo "[validate_service.sh] ✗ VALIDATION FAILED after ${MAX_RETRIES} attempts"
echo "[validate_service.sh] Last 50 lines of app log:"
tail -50 /app/logs/app.log 2>/dev/null || echo "No app log found"
echo "[validate_service.sh] Systemd service status:"
systemctl status app || true

exit 1  # Non-zero exit triggers CodeDeploy rollback