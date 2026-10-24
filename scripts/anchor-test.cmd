@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
set HOME=C:\Users\ramad
set USERPROFILE=C:\Users\ramad
set CARGO=C:\Users\ramad\.cargo\bin\cargo.exe
set RUSTUP_TOOLCHAIN=solana
node scripts\sync-keypair.mjs > anchor-test.log 2>&1
anchor test --skip-build >> anchor-test.log 2>&1
echo ANCHOR_TEST_EXIT=%ERRORLEVEL% >> anchor-test.log
