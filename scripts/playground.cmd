@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
npx tsx playground\server.ts > playground\server.log 2>&1
echo EXITCODE=%ERRORLEVEL% >> playground\server.log
