# Stops the KhayaBeats server and closes the public address. Keep ASCII-only.
. "$PSScriptRoot\common.ps1"

if (Test-Path $PidFile) {
  $loopPid = (Get-Content $PidFile | Select-Object -First 1).Trim()
  if ($loopPid) { & taskkill /PID $loopPid /T /F 2>&1 | Out-Null }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

# Also stop any node process still holding the port.
try {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
  foreach ($c in $conn) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
} catch { }

$ts = Get-TailscaleExe
if ($ts) { & $ts funnel reset 2>&1 | Out-Null }

Write-Host "KhayaBeats server stopped. Music will not play until you run START.bat." -ForegroundColor Yellow
