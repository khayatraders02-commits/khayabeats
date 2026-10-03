@echo off
cd /d "%~dp0"
title KhayaBeats - IMPORT-COOKIES
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0import-cookies.ps1"
