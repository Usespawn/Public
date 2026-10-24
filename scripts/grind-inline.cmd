@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
node scripts\grind-inline.cjs > grind-inline.log 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> grind-inline.log
