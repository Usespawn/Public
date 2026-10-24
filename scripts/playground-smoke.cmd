@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
npx tsx playground\smoke.ts > playground\smoke.log 2>&1
echo EXITCODE=%ERRORLEVEL% >> playground\smoke.log
