@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
set HOME=C:\Users\ramad
set USERPROFILE=C:\Users\ramad
anchor build > anchor-build.log 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> anchor-build.log
