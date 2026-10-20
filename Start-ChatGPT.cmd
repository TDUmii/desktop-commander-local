@echo off
chcp 65001 >nul
cd /d "%~dp0"
title UmiBridge Sakura Console - ChatGPT web
set "NODE_EXE="
if exist "%~dp0.runtime\node\node.exe" set "NODE_EXE=%~dp0.runtime\node\node.exe"
if not defined NODE_EXE for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE (
  echo Node.js was not found. Double-click Install-UmiBridge.cmd first.
  pause
  exit /b 1
)
"%NODE_EXE%" "%~dp0scripts\run-local-web.mjs"
if errorlevel 1 pause
