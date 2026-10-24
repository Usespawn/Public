@echo off
REM Kill anything on port 3000, wipe .next, start fresh dev server (hidden)
setlocal
set ROOT=%~dp0..
cd /d %ROOT%\web

echo === killing port 3000 === > "%~dp0restart-out.log"
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($c) { $c | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Write-Output ('killing ' + $_); Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } else { Write-Output 'no listener' }" >> "%~dp0restart-out.log" 2>&1
timeout /t 3 /nobreak >nul

echo === wiping .next === >> "%~dp0restart-out.log"
rmdir /s /q .next >> "%~dp0restart-out.log" 2>&1
if exist .next (echo WARN: .next still present >> "%~dp0restart-out.log") else (echo .next deleted >> "%~dp0restart-out.log")

echo === starting dev server === >> "%~dp0restart-out.log"
powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList '/c cd /d \"%ROOT%\web\" && npx next dev -p 3000 > \"%ROOT%\web\next-dev.log\" 2>&1'" >> "%~dp0restart-out.log" 2>&1

timeout /t 8 /nobreak >nul
powershell -NoProfile -Command "$l = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($l) { Write-Output ('listening PID ' + ($l | Select-Object -First 1 -ExpandProperty OwningProcess)) } else { Write-Output 'NOT LISTENING YET' }" >> "%~dp0restart-out.log" 2>&1
echo === done === >> "%~dp0restart-out.log"