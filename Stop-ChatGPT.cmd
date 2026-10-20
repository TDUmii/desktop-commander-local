@echo off
title UmiBridge Sakura Console - Stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Stop-ChatGPT.ps1"
if errorlevel 1 pause
