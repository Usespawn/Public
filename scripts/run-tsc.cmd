@echo off
cd /d "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web"
npx tsc --noEmit > "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\tsc3.log" 2>&1
echo TSC-DONE-EXITCODE-%ERRORLEVEL% >> "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\tsc3.log"