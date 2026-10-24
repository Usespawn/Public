@echo off
setlocal
set OUT=C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\diag.txt
set PS=powershell -NoProfile -ExecutionPolicy Bypass -Command
echo SPAWNPAD DIAG %DATE% %TIME% > "%OUT%"
echo. >> "%OUT%"
echo == scripts dir == >> "%OUT%"
%PS% "Get-ChildItem 'C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\scripts' | ForEach-Object { $_.Name }" >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo == BUILD_ID timestamp == >> "%OUT%"
%PS% "Get-Item 'C:\Users\ramad\.cline\data\workspaces\chat\spawnpad\web\.next\BUILD_ID' | ForEach-Object { $_.LastWriteTime }" >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo == next processes == >> "%OUT%"
%PS% "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'next' } | ForEach-Object { \"PID=$($_.ProcessId) :: $($_.CommandLine)\" }" >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo == node processes == >> "%OUT%"
%PS% "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' } | ForEach-Object { \"PID=$($_.ProcessId) :: $($_.CommandLine)\" }" >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo == ports 3000/8899 listeners == >> "%OUT%"
%PS% "netstat -ano | Select-String ':3000 |:8899 ' | ForEach-Object { $_.Line.Trim() }" >> "%OUT%" 2>&1
echo == END == >> "%OUT%"
endlocal