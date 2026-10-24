@echo off
REM Clean restart of the Next.js dev server (stale .next artifacts cause old markup to be served)
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'next (dev|start)' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 3 /nobreak >nul
rmdir /s /q C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web\.next
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web
npx next dev -p 3000 > next-dev.log 2>&1
