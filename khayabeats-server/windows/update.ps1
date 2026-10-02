# Updates yt-dlp and server packages. Keep ASCII-only.
. "$PSScriptRoot\common.ps1"

Write-Step "Updating yt-dlp"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile $YtDlpExe -UseBasicParsing
Write-Ok ("yt-dlp " + (& $YtDlpExe --version))

Write-Step "Updating server packages"
Push-Location $ServerDir
& npm.cmd install --omit=dev --no-audit --no-fund | Out-Host
Pop-Location

$key = Get-EnvValue 'KB_SERVER_KEY'
if ((Test-LocalHealth) -and $key) {
  Write-Step "Re-running the YouTube test"
  try {
    $r = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/self-test" -Headers @{ 'x-kb-key' = $key } -TimeoutSec 60
    if ($r.ok) { Write-Ok "YouTube test passed" } else { Write-Bad "YouTube test failed: $($r.error)" }
  } catch { Write-Warn2 "Could not run the test: $($_.Exception.Message)" }
}

Write-Host ""
Write-Host "Done. If you pulled new code from GitHub, close the server window and run START.bat." -ForegroundColor Green
Read-Host "Press Enter to close"
