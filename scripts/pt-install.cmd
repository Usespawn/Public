@echo off
REM Manual platform-tools v1.41 install for cargo-build-sbf (workaround for
REM tar-unpack os error 5 inside cargo-build-sbf on this machine).
set HOME=C:\Users\ramad
set CACHE=C:\Users\ramad\.cache\solana
set TARGET=%CACHE%\v1.41\platform-tools
set URL=https://github.com/solana-labs/platform-tools/releases/download/v1.41/platform-tools-windows-x86_64.tar.bz2

echo STEP1_MKDIR > C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pt-install.log
if not exist "%TARGET%" mkdir "%TARGET%" >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pt-install.log 2>&1

echo STEP2_DOWNLOAD >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pt-install.log
curl -L --fail --retry 3 -o "%CACHE%\pt.tar.bz2" "%URL%" >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pt-install.log 2>&1
echo DL_EXIT=%ERRORLEVEL% >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pt-install.log

echo STEP3_EXTRACT >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pt-install.log
tar -xjf "%CACHE%\pt.tar.bz2" -C "%TARGET%" >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pt-install.log 2>&1
echo TAR_EXIT=%ERRORLEVEL% >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pt-install.log

echo STEP4_LIST >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pt-install.log
dir "%TARGET%" >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pt-install.log 2>&1
dir "%TARGET%\rust\bin" >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\pt-install.log 2>&1
