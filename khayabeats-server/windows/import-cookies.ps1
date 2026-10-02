# Copies an exported YouTube cookies.txt into the server folder. ASCII-only.
. "$PSScriptRoot\common.ps1"
Add-Type -AssemblyName System.Windows.Forms

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title  = 'Choose your exported YouTube cookies.txt'
$dialog.Filter = 'Text files (*.txt)|*.txt|All files (*.*)|*.*'
if ($dialog.ShowDialog() -ne 'OK') { Write-Host "Cancelled."; exit 0 }

$content = Get-Content -Raw -Path $dialog.FileName
if ($content -notmatch 'youtube\.com') {
  Write-Bad "That file does not contain YouTube cookies. Export it while on youtube.com."
  Read-Host "Press Enter to close"
  exit 1
}

Copy-Item -Force $dialog.FileName $CookieFile
Write-Ok "Cookies saved. They are used immediately - no restart needed."

$key = Get-EnvValue 'KB_SERVER_KEY'
if ((Test-LocalHealth) -and $key) {
  Write-Step "Testing YouTube with the new cookies"
  try {
    $r = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/self-test" -Headers @{ 'x-kb-key' = $key } -TimeoutSec 60
    if ($r.ok) { Write-Ok "YouTube test passed" } else { Write-Bad "YouTube test failed: $($r.error)" }
  } catch { Write-Warn2 "Could not run the test: $($_.Exception.Message)" }
}
Read-Host "Press Enter to close"
