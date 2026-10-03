@echo off
cd /d "%~dp0"
title KhayaBeats - UPDATE
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1"
