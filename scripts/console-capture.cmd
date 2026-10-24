@echo off
setlocal
set "CH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CH%" set "CH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CH%" (
  echo NO_CHROME > C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\console-cap.log
  exit /b 1
)
echo CONSOLE-CAP-START > C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\console-cap.log
"%CH%" --headless=new --disable-gpu --enable-logging=stderr --v=0 --user-data-dir="C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\chrome-console-profile" --window-size=1440,900 --virtual-time-budget=15000 --screenshot="C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\brand\console-check.png" http://127.0.0.1:3000/ >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\console-cap.log 2>&1
echo CONSOLE-CAP-DONE >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\console-cap.log
