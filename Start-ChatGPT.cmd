@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Desktop Commander Local - ChatGPT web
node "%~dp0scripts\run-local-web.mjs"
if errorlevel 1 pause
