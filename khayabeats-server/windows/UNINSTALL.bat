@echo off
cd /d "%~dp0"
title KhayaBeats - UNINSTALL
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
