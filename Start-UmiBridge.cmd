@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Start-UmiBridge.ps1"
if errorlevel 1 (
  echo UmiBridge could not start. Check .local-data\server-error.log.
  pause
)
