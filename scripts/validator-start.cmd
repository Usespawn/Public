@echo off
cd /d C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
set HOME=C:\Users\ramad
REM Start a localnet validator with the engine preloaded at genesis and the
REM test wallet funded directly at genesis (faucet is unreliable on Windows).
taskkill /f /im solana-test-validator.exe > nul 2>&1
timeout /t 2 /nobreak > nul
start /b "" "C:\Users\ramad\.local\share\solana\install\active_release\bin\solana-test-validator.exe" --bpf-program 3CNhTgbuB68YC5C2vGTCJL6LpHvTokdsLQ1Xkv37s3mg target\deploy\spawnpad_engine.so --ledger .ledger --reset --account BQfDrbrqbgccAapMsUyZ5o36secvjTsvyoHyQNDJNdmP keypairs\wallet-genesis-account.json --clone-upgradeable-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s --url devnet > validator.log 2>&1
echo VALIDATOR_LAUNCHED
