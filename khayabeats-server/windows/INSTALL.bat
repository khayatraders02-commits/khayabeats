@echo off
cd /d "%~dp0"
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Asking Windows for permission to install...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
title KhayaBeats - INSTALL
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
