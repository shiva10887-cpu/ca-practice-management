#!/bin/bash
# Run this ONCE from a WSL terminal to set up PostgreSQL + Redis for local dev.
# Usage: bash scripts/wsl-setup.sh

set -e

REDIS_PASSWORD="redis_secret"
PG_USER="capm"
PG_PASSWORD="capm_secret"
PG_DB="ca_practice"

echo "==> Updating apt and installing services..."
sudo apt-get update -qq
sudo apt-get install -y redis-server postgresql

echo "==> Configuring Redis password..."
REDIS_CONF="/etc/redis/redis.conf"
if sudo grep -q "^requirepass" "$REDIS_CONF"; then
  sudo sed -i "s/^requirepass .*/requirepass $REDIS_PASSWORD/" "$REDIS_CONF"
else
  echo "requirepass $REDIS_PASSWORD" | sudo tee -a "$REDIS_CONF" > /dev/null
fi
# Bind to all interfaces so Windows host can reach it
sudo sed -i 's/^bind 127.0.0.1 ::1/bind 0.0.0.0/' "$REDIS_CONF" 2>/dev/null || true

echo "==> Starting services..."
sudo service redis-server start
sudo service postgresql start

echo "==> Creating PostgreSQL user and database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER $PG_USER WITH PASSWORD '$PG_PASSWORD' CREATEDB;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" | grep -q 1 \
  || sudo -u postgres createdb -O "$PG_USER" "$PG_DB"

echo "==> Allowing passwordless sudo for service start/stop (dev only)..."
SUDOERS_FILE="/etc/sudoers.d/dev-services"
echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/service redis-server *, /usr/sbin/service postgresql *" \
  | sudo tee "$SUDOERS_FILE" > /dev/null
sudo chmod 440 "$SUDOERS_FILE"

echo ""
echo "==> Setup complete!"
echo "    PostgreSQL : localhost:5432  user=$PG_USER  db=$PG_DB"
echo "    Redis      : localhost:6379  password=$REDIS_PASSWORD"
echo ""
echo "From now on, start services with:  .\\start-dev.ps1  (in PowerShell)"
