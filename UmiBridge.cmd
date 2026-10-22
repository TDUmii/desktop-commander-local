@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title UmiBridge Sakura Console
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0UmiBridge.ps1"
if errorlevel 1 (
  echo.
  echo UmiBridge could not start. See .local-data\launcher-error.log.
  pause
)
endlocal
