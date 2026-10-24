@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
set HOME=C:\Users\ramad
set USERPROFILE=C:\Users\ramad
REM Route ALL cargo invocations (metadata + build) through the rustup shim to
REM the platform-tools 1.75 toolchain, so the v3 lockfile stays consistent.
set CARGO=C:\Users\ramad\.cargo\bin\cargo.exe
set RUSTUP_TOOLCHAIN=solana
echo STEP1_START > sbf-build.log
where cargo-build-sbf >> sbf-build.log 2>&1
cargo-build-sbf --help > nul 2>&1
echo SBF_HELP_EXIT=%ERRORLEVEL% >> sbf-build.log
echo STEP2_BUILDING >> sbf-build.log
cargo-build-sbf >> sbf-build.log 2>&1
echo SBF_BUILD_EXIT=%ERRORLEVEL% >> sbf-build.log
echo STEP3_ANCHOR >> sbf-build.log
anchor build >> sbf-build.log 2>&1
echo ANCHOR_EXIT=%ERRORLEVEL% >> sbf-build.log
