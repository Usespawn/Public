@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\packages\vanity-grinder
npm install --no-fund --no-audit --no-save > grinder-install.log 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> grinder-install.log
