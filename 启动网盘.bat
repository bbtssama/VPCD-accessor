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

rem auto-kill a stale instance of this service (port 8443)
powershell -NoProfile -Command "$p = Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($id in $p) { $c = (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $id) -ErrorAction SilentlyContinue).CommandLine; if ($c -like '*server.py*') { Write-Host ('Stopping stale instance PID ' + $id); Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }"
timeout /t 2 /nobreak >nul

rem if the port is still occupied by another program (not this service), report it
netstat -ano | findstr /C:":8443 " | findstr /C:"LISTENING" >nul
if %errorlevel%==0 (
  echo Port 8443 is in use by another program. Please close it first:
  echo   netstat -ano ^| findstr :8443
  echo   taskkill /F /PID [pid]
  pause
  exit /b 1
)

:loop
echo [%date% %time%] Starting drive service, token=transfer, port=8443 ...
"%PY%" server.py --serve auto --port 8443 --token transfer
echo.
echo Service stopped or crashed. Restarting in 30 seconds...
echo Close this window to stop permanently.
timeout /t 30 /nobreak >nul
goto loop