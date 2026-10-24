@echo off
REM Phase 7 validation: run the web test suite via the ROOT tsx package
REM (web/node_modules has no tsx; spawnpad/node_modules does).
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web
set HOME=C:\Users\ramad
set USERPROFILE=C:\Users\ramad
node "C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\node_modules\tsx\dist\cli.mjs" --test tests/metadata.test.ts tests/vanity.test.ts tests/devbuy.test.ts > C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\env-test7.log 2>&1
echo WEBTEST_EXIT=%ERRORLEVEL% >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\env-test7.log
