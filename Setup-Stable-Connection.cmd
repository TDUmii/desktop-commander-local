@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title UmiBridge Sakura Console - Stable connection
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-Stable-Connection.ps1" -Launch %*
if errorlevel 1 (
  echo.
  echo Stable connection setup failed. Read the message above and run setup again.
) else (
  echo.
  echo Setup completed. You can close this window.
)
pause >nul
endlocal
