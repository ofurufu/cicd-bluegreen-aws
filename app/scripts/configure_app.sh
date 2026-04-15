#!/bin/bash 

# ── configure_app.sh ──────────────────────────────────────────────────────────
# CodeDeploy lifecycle hook: AfterInstall (runs after install_dependencies.sh)
#
# Goal: Pull runtime configuration from SSM Parameter Store and write it
#       to /app/.env for the app to read on startup.
#
# Why SSM? So config lives in AWS, not in GitHub or the AMI.
# ─────────────────────────────────────────────────────────────────────────────

set -eu
echo "[configure_app.sh] Starting..."

# Pull values from SSM Parameter Store
ENVIRONMENT=$(aws ssm get-parameter \
  --name "/cicd-bluegreen/environment" \
  --region us-east-1 \
  --query "Parameter.Value" \
  --output text)

# Read the app version from the VERSION file baked into the AMI by Packer
APP_VERSION=$(cat /app/VERSION 2>/dev/null || echo "unknown")

# Write environment file
# chmod 600 = owner read/write only (protects any sensitive values)
cat > /app/.env << EOF
NODE_ENV=production
PORT=3000
ENVIRONMENT=${ENVIRONMENT}
APP_VERSION=${APP_VERSION}
EOF

chmod 600 /app/.env
chown appuser:appuser /app/.env

echo "[configure_app.sh] Configuration written:"
cat /app/.env

echo "[configure_app.sh] Done."