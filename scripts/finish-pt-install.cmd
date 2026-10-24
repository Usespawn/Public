@echo off
cd /d C:\Users\ramad\.cache\solana
echo STEP_A_CHECK > spawnpad-install.log
if exist platform-tools\version.md (
  echo ALREADY_INSTALLED >> spawnpad-install.log
  exit /b 0
)
echo STEP_B_MOVE >> spawnpad-install.log
robocopy v1.41\platform-tools platform-tools /E /MOVE /NFL /NDL /NJH /NJS >> spawnpad-install.log 2>&1
echo ROBOCOPY_EXIT=%ERRORLEVEL% >> spawnpad-install.log
echo STEP_B_DONE >> spawnpad-install.log
