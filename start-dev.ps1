# Start local dev environment (WSL services + Node dev servers)
# Run from project root: .\start-dev.ps1
# First-time? Run in WSL first: bash scripts/wsl-setup.sh

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

# ── 1. Start WSL services ──────────────────────────────────────────────────────
Write-Step "Starting Redis in WSL..."
$redisResult = wsl bash -c "sudo service redis-server status 2>/dev/null | grep -q running && echo running || sudo service redis-server start && echo started"
Write-Ok "Redis: $redisResult"

Write-Step "Starting PostgreSQL in WSL..."
$pgResult = wsl bash -c "sudo service postgresql status 2>/dev/null | grep -q online && echo running || sudo service postgresql start && echo started"
Write-Ok "PostgreSQL: $pgResult"

# ── 2. Give services a moment to bind ─────────────────────────────────────────
Start-Sleep -Seconds 2

# ── 3. Run Prisma migrations ───────────────────────────────────────────────────
Write-Step "Running Prisma migrations..."
Push-Location "$Root\backend"
try {
    npx prisma migrate deploy
    Write-Ok "Migrations applied."
} catch {
    Write-Warn "Migration failed (may already be up to date). Continuing..."
} finally {
    Pop-Location
}

# ── 4. Start dev servers ───────────────────────────────────────────────────────
Write-Step "Starting backend + frontend dev servers..."
Write-Ok "Backend  → http://localhost:4000"
Write-Ok "Frontend → http://localhost:3000"
Write-Host ""

Set-Location $Root
npm run dev
