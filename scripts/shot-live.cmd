@echo off
setlocal
set "CH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CH%" set "CH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CH%" (
  echo NO_CHROME > C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\shots-live.log
  exit /b 1
)
echo chrome: %CH% > C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\shots-live.log
"%CH%" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 --virtual-time-budget=15000 --screenshot=C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\brand\live-home.png http://127.0.0.1:3000/ 2>&1
echo home done >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\shots-live.log
"%CH%" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,2000 --virtual-time-budget=15000 --screenshot=C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\brand\live-brand.png http://127.0.0.1:3000/brand 2>&1
echo brand done >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\shots-live.log
echo SHOTS-LIVE-DONE >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\shots-live.log
