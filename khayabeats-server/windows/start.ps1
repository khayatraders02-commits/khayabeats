# Runs the KhayaBeats server and restarts it if it crashes. Keep ASCII-only.
$ErrorActionPreference = 'Continue'
. "$PSScriptRoot\common.ps1"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if (Test-LocalHealth) {
  Write-Host "KhayaBeats server is already running." -ForegroundColor Green
  Start-Sleep -Seconds 4
  exit 0
}

if (-not (Get-EnvValue 'KB_SERVER_KEY')) {
  Write-Host "Setup is not finished. Run INSTALL.bat first." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

$PID | Set-Content -Path $PidFile -Encoding ASCII

Write-Host "Updating yt-dlp..." -ForegroundColor Cyan
if (Test-Path $YtDlpExe) { & $YtDlpExe -U 2>&1 | Out-Host }

$ts = Get-TailscaleExe
if ($ts) {
  Write-Host "Opening the public address..." -ForegroundColor Cyan
  & $ts funnel --bg $Port 2>&1 | Out-Host
  $url = Get-PublicUrl
  if ($url) { Write-Host "Public address: $url" -ForegroundColor Green }
} else {
  Write-Host "Tailscale is missing - phones cannot reach this PC. Run INSTALL.bat." -ForegroundColor Yellow
}

$log = Join-Path $LogDir 'server.log'
Write-Host "Server running. Keep this window open (you can minimise it)." -ForegroundColor Green
Write-Host "Log file: $log"

Push-Location $ServerDir
while ($true) {
  if ((Test-Path $log) -and ((Get-Item $log).Length -gt 20MB)) {
    Move-Item -Force $log (Join-Path $LogDir 'server.old.log')
  }
  "[$(Get-Date -Format s)] starting server" | Add-Content $log
  & node server.js 2>&1 | Tee-Object -FilePath $log -Append
  "[$(Get-Date -Format s)] server stopped (exit $LASTEXITCODE), restarting in 5s" | Add-Content $log
  Write-Host "Server stopped - restarting in 5 seconds..." -ForegroundColor Yellow
  Start-Sleep -Seconds 5
}
