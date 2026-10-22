@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title UmiBridge Sakura Console
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\UmiBridge.ps1" -Monitor %*
if errorlevel 1 (
  echo.
  echo UmiBridge could not start. See .local-data\launcher-error.log.
  pause
)
endlocal
