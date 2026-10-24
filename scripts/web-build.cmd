@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web
taskkill /F /FI "WINDOWTITLE eq next*" > nul 2>&1
npx next build > next-build.log 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> next-build.log
npx next dev -p 3000 > next-dev.log 2>&1
echo DEV_EXIT=%ERRORLEVEL% >> next-dev.log
