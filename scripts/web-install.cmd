@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web
if exist node_modules\bufferutil rmdir /s /q node_modules\bufferutil
if exist node_modules\utf-8-validate rmdir /s /q node_modules\utf-8-validate
npm install bufferutil utf-8-validate --no-audit --no-fund > repair.log 2>&1
echo REPAIR_EXIT=%ERRORLEVEL% >> repair.log
