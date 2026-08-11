@echo off
title Drive Service (transfer)
cd /d "%~dp0server"

rem detect a usable Python (system 'python' may be a WindowsApps stub without an interpreter)
set "PY="
if exist "D:\ANACONDA\python.exe" set "PY=D:\ANACONDA\python.exe"
if not defined PY if exist "C:\Users\user\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\vm\tools\python\python.exe" set "PY=C:\Users\user\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\vm\tools\python\python.exe"
if not defined PY if exist "C:\Python312\python.exe" set "PY=C:\Python312\python.exe"
if not defined PY if exist "C:\Python311\python.exe" set "PY=C:\Python311\python.exe"
if not defined PY set "PY=python"

:loop
echo [%date% %time%] Starting drive service, token=transfer, port=8443/8444 ...
"%PY%" server.py --serve auto --port 8443 --token transfer
echo.
echo Service stopped or crashed. Restarting in 30 seconds...
echo Close this window to stop permanently.
timeout /t 30 /nobreak >nul
goto loop