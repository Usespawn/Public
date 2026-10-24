@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
node node_modules\@spawnpad\vanity-grinder\dist\cli.js --json -t 8 > vanity-ground.json 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> vanity-ground.json
