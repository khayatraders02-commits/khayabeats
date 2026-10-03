@echo off
cd /d "%~dp0"
title KhayaBeats - STOP
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
pause
