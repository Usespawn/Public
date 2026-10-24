@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
cargo test --locked --manifest-path programs\spawnpad-engine\Cargo.toml --lib > unit-tests3.log 2>&1
echo EXITCODE=%ERRORLEVEL% >> unit-tests3.log
