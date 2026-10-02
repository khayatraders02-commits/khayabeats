# Shared helpers for the KhayaBeats Windows scripts. Keep this file ASCII-only.

$ServerDir  = Split-Path -Parent $PSScriptRoot
$EnvFile    = Join-Path $ServerDir '.env'
$LogDir     = Join-Path $ServerDir 'logs'
$PidFile    = Join-Path $ServerDir 'logs\server.pid'
$YtDlpExe   = Join-Path $ServerDir 'yt-dlp.exe'
$CookieFile = Join-Path $ServerDir 'cookies.txt'
$InfoFile   = Join-Path $ServerDir 'SETUP-INFO.txt'
$Port       = 3001

function Write-Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    [!] $msg" -ForegroundColor Yellow }
function Write-Bad($msg)  { Write-Host "    [X] $msg" -ForegroundColor Red }

function Update-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

function Test-Cmd($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Get-TailscaleExe {
  if (Test-Cmd 'tailscale') { return (Get-Command tailscale).Source }
  $default = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
  if (Test-Path $default) { return $default }
  return $null
}

function Get-EnvValue($key) {
  if (-not (Test-Path $EnvFile)) { return $null }
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match "^\s*$key\s*=\s*(.+)\s*$") { return $Matches[1].Trim() }
  }
  return $null
}

function Get-PublicUrl {
  $ts = Get-TailscaleExe
  if (-not $ts) { return $null }
  try {
    $status = & $ts status --json | ConvertFrom-Json
    $dns = $status.Self.DNSName
    if ($dns) { return 'https://' + $dns.TrimEnd('.') }
  } catch { }
  return $null
}

function Install-WithWinget($id, $label) {
  if (-not (Test-Cmd 'winget')) {
    Write-Bad "winget is missing. Install 'App Installer' from the Microsoft Store, then run INSTALL.bat again."
    throw "winget missing"
  }
  Write-Host "    Installing $label (this can take a few minutes)..."
  & winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements | Out-Host
  Update-SessionPath
}

function Test-LocalHealth {
  try {
    return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5
  } catch { return $null }
}
