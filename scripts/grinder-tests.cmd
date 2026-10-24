@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\packages\vanity-grinder
npx tsx verify-suite.ts > verify-suite.log 2>&1
echo EXITCODE=%ERRORLEVEL% >> verify-suite.log
