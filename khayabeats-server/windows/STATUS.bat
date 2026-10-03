@echo off
cd /d "%~dp0"
title KhayaBeats - STATUS
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0status.ps1"
