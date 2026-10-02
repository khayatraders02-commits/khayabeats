# Removes auto-start and the public address. Leaves files in place. ASCII-only.
. "$PSScriptRoot\common.ps1"

& (Join-Path $PSScriptRoot 'stop.ps1')

$shortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'KhayaBeats Server.lnk'
if (Test-Path $shortcut) { Remove-Item -Force $shortcut; Write-Ok "Removed from Windows startup" }

Write-Host ""
Write-Host "Auto-start removed. To delete everything, delete the khayabeats-server folder." -ForegroundColor Yellow
Write-Host "Node.js and Tailscale can be removed from Windows Settings > Apps."
Read-Host "Press Enter to close"
