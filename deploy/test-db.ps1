# 在 deploy 目录执行: powershell -ExecutionPolicy Bypass -File test-db.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path .env)) {
    Write-Host "缺少 .env，请先 copy .env.example .env 并填写 DATABASE_URL" -ForegroundColor Red
    exit 1
}

Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*DATABASE_URL=(.+)$') {
        $script:DbUrl = $matches[1].Trim()
    }
}

if (-not $DbUrl) {
    Write-Host ".env 中未找到 DATABASE_URL" -ForegroundColor Red
    exit 1
}

Write-Host "测试数据库连接..." -ForegroundColor Cyan
Write-Host "DATABASE_URL=$($DbUrl -replace '://([^:]+):([^@]+)@', '://$1:***@')"

docker run --rm postgres:16-alpine psql "$DbUrl" -c "SELECT 1 AS ok"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n数据库连接成功，可执行: docker compose up -d" -ForegroundColor Green
} else {
    Write-Host "`n数据库连接失败，请检查 IP/端口/账号密码/防火墙" -ForegroundColor Red
    exit 1
}
