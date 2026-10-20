@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title UmiBridge Sakura Console - Private Gemini pairing
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-Gemini.ps1" -PairedUrl
if errorlevel 1 (
  echo.
  echo Gemini pairing failed. Read the error above, then press any key to close.
  pause >nul
)
endlocal
