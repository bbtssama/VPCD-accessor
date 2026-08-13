@echo off
rem ============================================================
rem  启动网盘.bat（幂等修复版）
rem  * 强杀残留实例：按端口列出 PID -> taskkill /F /T 连进程树删除
rem  * 清理"启动中/崩溃循环"但尚未在监听的同端口残留 python
rem  * 等待端口真正释放（轮询 bind，最多约 8 秒）
rem  * 端口被外来程序占用：报告原因并要求手动处理（不误杀）
rem  * 启动后自检：server.py 打印"本机自检: OK / FAIL"
rem  * 假死（僵尸监听：端口开着但请求无人处理）由 server.py 看门狗
rem    自动退出，本脚本 5 秒后快速重启；普通崩溃 30 秒后自动重启
rem ============================================================
title TransferMCP-8443
setlocal EnableExtensions
cd /d "%~dp0server"

rem ---- 1) 探测可用 Python（系统 python 可能是 WindowsApps 占位 stub）----
set "PY="
if exist "D:\ANACONDA\python.exe" set "PY=D:\ANACONDA\python.exe"
if not defined PY if exist "C:\Users\user\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\vm\tools\python\python.exe" set "PY=C:\Users\user\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\vm\tools\python\python.exe"
if not defined PY if exist "C:\Python312\python.exe" set "PY=C:\Python312\python.exe"
if not defined PY if exist "C:\Python311\python.exe" set "PY=C:\Python311\python.exe"
if not defined PY set "PY=python"

rem ---- 2) 强杀本服务残留实例 ----
rem     按端口列出监听进程：命令行含 server.py 的判定为本服务，taskkill /F /T 连树杀；
rem     再清一次"命令行含 --port 8443 但尚未监听"的启动中/崩溃循环实例（防其与
rem     新实例抢端口）；其他程序的进程一律不碰。
echo [kill] cleaning stale instances on port 8443 ...
powershell -NoProfile -Command "$port=8443; $killed=@(); $ids=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); foreach($id in $ids){ $cl=(Get-CimInstance Win32_Process -Filter ('ProcessId='+$id) -ErrorAction SilentlyContinue).CommandLine; if($cl -like '*server.py*'){ Write-Host ('[kill] stale service PID '+$id+' (with tree)'); taskkill /F /T /PID $id 2>$null | Out-Null; $killed+=$id } else { Write-Host ('[info] port '+$port+' held by foreign PID '+$id+', will not touch') } }; $boot=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*server.py*' -and $_.CommandLine -like '*--port 8443*' -and $_.ProcessId -notin $killed } | Select-Object -ExpandProperty ProcessId -Unique); foreach($id in $boot){ Write-Host ('[kill] booting/looping stale PID '+$id); taskkill /F /T /PID $id 2>$null | Out-Null }; if($killed.Count -eq 0 -and $boot.Count -eq 0){ Write-Host '[kill] no stale instance found' }; Start-Sleep -Milliseconds 500"

rem ---- 3) 等待端口真正释放（轮询 bind，最多约 8 秒）----
powershell -NoProfile -Command "$port=8443; $deadline=[DateTime]::Now.AddSeconds(8); $free=$false; while([DateTime]::Now -lt $deadline){ $ok=$true; try { $sock=[Net.Sockets.Socket]::new([Net.Sockets.AddressFamily]::InterNetworkV6,[Net.Sockets.SocketType]::Stream,[Net.Sockets.ProtocolType]::Tcp); try{$sock.SetSocketOption([Net.Sockets.SocketOptionLevel]::IPv6,[Net.Sockets.SocketOptionName]::IPv6Only,$false)}catch{}; $sock.Bind([Net.IPEndPoint]::new([Net.IPAddress]::IPv6Any,$port)); $sock.Close() } catch { $ok=$false; Start-Sleep -Milliseconds 500 }; if($ok){ $free=$true; break } }; if($free){ Write-Host '[port] released, ready to start' } else { Write-Host '[port] still held after 8s, productive startup will use bind-retry' }"

rem ---- 4) 端口仍被占用：报告原因，不误杀外来程序，由用户决定 ----
netstat -ano | findstr /C:":8443 " | findstr /C:"LISTENING" >nul
if %errorlevel%==0 (
  echo.
  echo [FAIL] Port 8443 is still in use by another program. Please check:
  echo   netstat -ano ^| findstr :8443
  echo   taskkill /F /T /PID [pid]
  echo If the holder is this service from an elevated window, run this script
  echo *as Administrator*, or close that window first.
  pause
  exit /b 1
)

rem ---- 5) 启动 + 崩溃/假死自动重启 ----
set "BIND_RETRY=0"

:loop
echo [%date% %time%] Starting drive service, token=transfer, port=8443 ...
call "%PY%" server.py --serve auto --port 8443 --token transfer
set "RC=%errorlevel%"
if "%RC%"=="2" (
  echo [restart] zombie detected by self-check, fast restart in 5s ...
  timeout /t 5 /nobreak >nul
  goto loop
)
netstat -ano | findstr /C:":8443 " | findstr /C:"LISTENING" >nul
if not %errorlevel%==0 goto crash
set /a BIND_RETRY+=1
if %BIND_RETRY% GEQ 4 (
  echo.
  echo [RETRY-EXIT] Port 8443 stays occupied. Another instance of this
  echo script or another program may be running. Close it, then rerun.
  pause
  exit /b 1
)
echo [retry] port occupied, retrying in 15s (%BIND_RETRY%/4) ...
timeout /t 15 /nobreak >nul
goto loop

:crash
echo.
echo Service stopped or crashed. Restarting in 30 seconds...
echo Close this window to stop permanently.
timeout /t 30 /nobreak >nul
set "BIND_RETRY=0"
goto loop