# Shows whether the KhayaBeats server works locally and from the internet. ASCII-only.
. "$PSScriptRoot\common.ps1"

Write-Step "Local server"
$h = Test-LocalHealth
if ($h) {
  Write-Ok "Running (version $($h.version), uptime $([int]$h.uptime)s)"
  if ($h.keyConfigured) { Write-Ok "Server key configured" } else { Write-Bad "Server key missing - run INSTALL.bat" }
  if ($h.selfTest.ok -eq $true) { Write-Ok "YouTube test passed" }
  elseif ($h.selfTest.ok -eq $false) { Write-Bad "YouTube test failed - run UPDATE.bat, then IMPORT-COOKIES.bat if needed" }
  else { Write-Warn2 "YouTube test still running" }
  Write-Host "    Cached songs: $($h.cache.totalFiles)"
} else {
  Write-Bad "Not running - double-click START.bat"
}

Write-Step "Public address"
$url = Get-PublicUrl
if ($url) {
  Write-Host "    $url"
  try {
    $p = Invoke-RestMethod -Uri "$url/health" -TimeoutSec 15
    if ($p.server -eq 'khayabeats') { Write-Ok "Reachable from the internet" } else { Write-Bad "Unexpected response" }
  } catch {
    Write-Bad "Not reachable from the internet. Run START.bat, and approve Funnel in Tailscale if asked."
  }
} else {
  Write-Bad "Tailscale is not signed in - run INSTALL.bat"
}

Write-Host ""
Read-Host "Press Enter to close"
