@echo off
REM Kill port 3000, wipe .next, start dev server, warm it, verify CSS emits
setlocal
set ROOT=C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
set LOG=%ROOT%\scripts\restart2-out.log

echo === killing port 3000 === > "%LOG%"
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($c) { $c | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Write-Output ('killing ' + $_); Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } else { Write-Output 'no listener' }" >> "%LOG%" 2>&1
timeout /t 5 /nobreak >nul

echo === wiping .next === >> "%LOG%"
rmdir /s /q "%ROOT%\web\.next" >> "%LOG%" 2>&1
if exist "%ROOT%\web\.next" (echo WARN: .next still present >> "%LOG%") else (echo .next deleted >> "%LOG%")
timeout /t 3 /nobreak >nul

echo === starting dev server === >> "%LOG%"
powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList '/c cd /d \"%ROOT%\web\" && npx next dev -p 3000 > \"%ROOT%\web\next-dev.log\" 2>&1'" >> "%LOG%" 2>&1

timeout /t 10 /nobreak >nul
echo === warming pages === >> "%LOG%"
powershell -NoProfile -Command "1..2 | ForEach-Object { try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/' -TimeoutSec 120 | Out-Null } catch {} }" >> "%LOG%" 2>&1
timeout /t 5 /nobreak >nul

echo === css dir after warm === >> "%LOG%"
dir "%ROOT%\web\.next\static\css\app" >> "%LOG%" 2>&1
echo === done === >> "%LOG%"
