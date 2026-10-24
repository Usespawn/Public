@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
npm install --no-fund --no-audit > npm-install.log 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> npm-install.log
