#!/bin/bash
# Fix PostgreSQL + Redis so Windows can reach them via localhost from WSL2
# Run from WSL terminal: bash /mnt/d/Projects/Practice\ Management/scripts/wsl-fix.sh

set -e

PG_USER="capm"
PG_PASSWORD="capm_secret"
PG_DB="ca_practice"
REDIS_PASSWORD="redis_secret"

echo "==> Fixing PostgreSQL..."

# Find the pg config dir (works for any installed version)
PG_CONF=$(sudo find /etc/postgresql -name "postgresql.conf" | head -1)
PG_HBA=$(sudo find /etc/postgresql -name "pg_hba.conf" | head -1)
PG_VERSION=$(echo "$PG_CONF" | grep -oP '\d+' | head -1)

echo "    Config: $PG_CONF"
echo "    HBA:    $PG_HBA"

# Listen on all interfaces (needed for WSL2 → Windows localhost forwarding)
sudo sed -i "s/#\?listen_addresses\s*=\s*'[^']*'/listen_addresses = '*'/" "$PG_CONF"

# Allow password auth from any host (WSL2 subnet varies per boot)
if ! sudo grep -q "0.0.0.0/0" "$PG_HBA"; then
  echo "host    all             all             0.0.0.0/0               scram-sha-256" | sudo tee -a "$PG_HBA" > /dev/null
fi

# Ensure user exists with correct password
sudo service postgresql start
sleep 2
sudo -u postgres psql -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$PG_USER') THEN
    CREATE USER $PG_USER WITH PASSWORD '$PG_PASSWORD' CREATEDB;
  ELSE
    ALTER USER $PG_USER WITH PASSWORD '$PG_PASSWORD';
  END IF;
END \$\$;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" | grep -q 1 \
  || sudo -u postgres createdb -O "$PG_USER" "$PG_DB"

sudo service postgresql restart
echo "    PostgreSQL OK"

echo "==> Fixing Redis..."
REDIS_CONF="/etc/redis/redis.conf"

# Bind to all interfaces
sudo sed -i 's/^bind .*/bind 0.0.0.0/' "$REDIS_CONF"

# Set password
if sudo grep -q "^requirepass" "$REDIS_CONF"; then
  sudo sed -i "s/^requirepass .*/requirepass $REDIS_PASSWORD/" "$REDIS_CONF"
else
  echo "requirepass $REDIS_PASSWORD" | sudo tee -a "$REDIS_CONF" > /dev/null
fi

# Disable protected-mode (required when binding to 0.0.0.0 without TLS)
sudo sed -i 's/^protected-mode yes/protected-mode no/' "$REDIS_CONF"
sudo grep -q "^protected-mode" "$REDIS_CONF" || echo "protected-mode no" | sudo tee -a "$REDIS_CONF" > /dev/null

sudo service redis-server restart
sleep 1

echo "    Redis OK"

echo ""
echo "==> Testing connections..."
# Test Redis
redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null && echo "    Redis PING: OK" || echo "    Redis PING: FAILED"

# Test PostgreSQL
PGPASSWORD="$PG_PASSWORD" psql -h 127.0.0.1 -U "$PG_USER" -d "$PG_DB" -c "SELECT 'PostgreSQL OK';" 2>/dev/null \
  || echo "    PostgreSQL: FAILED (check above errors)"

echo ""
echo "==> Done. Now run in PowerShell:  .\start-dev.ps1"
