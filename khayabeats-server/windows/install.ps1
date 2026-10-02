# KhayaBeats Home Server - one-time Windows setup. Keep this file ASCII-only.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\common.ps1"

Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "   KhayaBeats Home Music Server - Setup"       -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# 1. Node.js
Write-Step "Checking Node.js"
if (-not (Test-Cmd 'node')) { Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js LTS' }
if (-not (Test-Cmd 'node')) { Write-Bad "Node.js did not install. Restart the PC and run INSTALL.bat again."; exit 1 }
Write-Ok ("Node.js " + (& node --version))

# 2. Tailscale (gives the PC a free, permanent public HTTPS address)
Write-Step "Checking Tailscale"
if (-not (Get-TailscaleExe)) { Install-WithWinget 'Tailscale.Tailscale' 'Tailscale' }
$ts = Get-TailscaleExe
if (-not $ts) { Write-Bad "Tailscale did not install. Restart the PC and run INSTALL.bat again."; exit 1 }
Write-Ok "Tailscale installed"

# 3. FFmpeg (optional, helps yt-dlp with some formats)
Write-Step "Checking FFmpeg"
if (-not (Test-Cmd 'ffmpeg')) {
  try { Install-WithWinget 'Gyan.FFmpeg' 'FFmpeg' } catch { Write-Warn2 "FFmpeg skipped (optional)." }
}
if (Test-Cmd 'ffmpeg') { Write-Ok "FFmpeg available" }

# 4. yt-dlp (always latest)
Write-Step "Downloading the latest yt-dlp"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile $YtDlpExe -UseBasicParsing
Write-Ok ("yt-dlp " + (& $YtDlpExe --version))

# 5. Server packages
Write-Step "Installing server packages"
Push-Location $ServerDir
& npm.cmd install --omit=dev --no-audit --no-fund | Out-Host
Pop-Location
Write-Ok "Packages installed"

# 6. Private server key
Write-Step "Creating the private server key"
$key = Get-EnvValue 'KB_SERVER_KEY'
if (-not $key) {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
  @(
    "# KhayaBeats home server settings. Never upload this file anywhere."
    "PORT=$Port"
    "HOST=127.0.0.1"
    "KB_SERVER_KEY=$key"
    "# Extra website addresses allowed to call the server, comma separated:"
    "ALLOWED_ORIGINS="
  ) | Set-Content -Path $EnvFile -Encoding ASCII
  Write-Ok "New key created"
} else {
  Write-Ok "Existing key kept"
}

# 7. Tailscale sign-in
Write-Step "Signing in to Tailscale (a browser window may open)"
& $ts up | Out-Host
$tries = 0
while (-not (Get-PublicUrl) -and $tries -lt 60) { Start-Sleep -Seconds 3; $tries++ }
$publicUrl = Get-PublicUrl
if (-not $publicUrl) { Write-Bad "Tailscale sign-in did not finish. Run INSTALL.bat again."; exit 1 }
Write-Ok "Signed in"

# 8. Public HTTPS address via Funnel
Write-Step "Publishing the server with Tailscale Funnel"
Write-Host "    If Tailscale shows a link to enable Funnel, open it, approve, then come back." -ForegroundColor Yellow
& $ts funnel --bg $Port | Out-Host
Write-Ok "Public address: $publicUrl"

# 9. Keep the PC awake while plugged in
Write-Step "Keeping the PC awake while plugged in"
& powercfg /change standby-timeout-ac 0 | Out-Null
& powercfg /change hibernate-timeout-ac 0 | Out-Null
Write-Ok "Sleep disabled on mains power"

# 10. Start automatically when Windows signs in
Write-Step "Starting automatically with Windows"
$startup  = [Environment]::GetFolderPath('Startup')
$shortcut = Join-Path $startup 'KhayaBeats Server.lnk'
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($shortcut)
$lnk.TargetPath = Join-Path $PSScriptRoot 'START.bat'
$lnk.WorkingDirectory = $PSScriptRoot
$lnk.WindowStyle = 7
$lnk.Save()
Write-Ok "Added to Windows startup"

# 11. Save the two values the app needs
@(
  "KhayaBeats Home Server - keep this private"
  ""
  "1) Music server address:"
  "   $publicUrl"
  ""
  "2) Music server key:"
  "   $key"
  ""
  "Give both values to the KhayaBeats app setup (Lovable chat asks for them)."
  "Never post the key publicly or upload this file to GitHub."
) | Set-Content -Path $InfoFile -Encoding ASCII

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " Setup finished!"                              -ForegroundColor Green
Write-Host " Address: $publicUrl"                          -ForegroundColor Green
Write-Host " The address and key are saved in SETUP-INFO.txt" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

Start-Process notepad.exe $InfoFile
Start-Process -FilePath (Join-Path $PSScriptRoot 'START.bat') -WorkingDirectory $PSScriptRoot
