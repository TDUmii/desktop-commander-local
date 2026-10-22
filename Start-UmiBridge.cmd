@echo off
setlocal
cd /d "%~dp0"
call "%~dp0UmiBridge.cmd"
set "exitCode=%errorlevel%"
if not "%exitCode%"=="0" (
  echo UmiBridge could not start. Check .local-data\server-error.log.
  pause
)
endlocal & exit /b %exitCode%
