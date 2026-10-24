@echo off
setlocal
set "CH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CH%" set "CH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CH%" (
  echo NO_CHROME > C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\shots-hero.log
  exit /b 1
)
echo chrome: %CH% > C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\shots-hero.log
"%CH%" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\chrome-tmp-profile" --window-size=1440,900 --virtual-time-budget=15000 --screenshot=C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\brand\hero-desktop.png http://127.0.0.1:3000/ > C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\chrome-out.log 2>&1
echo desktop done >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\shots-hero.log
"%CH%" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\chrome-tmp-profile" --window-size=390,844 --virtual-time-budget=15000 --screenshot=C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\brand\hero-mobile.png http://127.0.0.1:3000/ >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\chrome-out.log 2>&1
echo mobile done >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\shots-hero.log
echo SHOTS-HERO-DONE >> C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\shots-hero.log