@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
cargo test --manifest-path programs/spawnpad-engine/Cargo.toml > cargo-test.log 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> cargo-test.log
