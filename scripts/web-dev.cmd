@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web
npx next dev -p 3000 > next-dev.log 2>&1
echo DEV_EXIT=%ERRORLEVEL% >> next-dev.log
