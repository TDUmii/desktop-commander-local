@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title UmiBridge Sakura Console - One-click install
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-Local.ps1" -Launch
if errorlevel 1 (
  echo.
  echo UmiBridge setup failed. Read the error above, then press any key to close.
  pause >nul
)
endlocal
