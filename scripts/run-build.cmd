@echo off
cd /d "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web"
call npx next build > "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web-build3.log" 2>&1
echo BUILD-DONE-EXITCODE-%ERRORLEVEL% >> "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web-build3.log"