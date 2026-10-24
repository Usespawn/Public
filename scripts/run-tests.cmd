@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
set HOME=C:\Users\ramad
set USERPROFILE=C:\Users\ramad
set ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
set ANCHOR_WALLET=keypairs\localnet-wallet.json
node_modules\.bin\mocha.cmd --require tsx/cjs -t 1000000 --exit tests/spawnpad-engine.ts > mocha-test.log 2>&1
echo MOCHA_EXIT=%ERRORLEVEL% >> mocha-test.log
