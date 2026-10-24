@echo off
REM Isolated production build — does NOT touch the running dev server.
REM Source is copied to spawnpad\build-isolate\web; node_modules is a junction.
set BASE=C:\Users\ramad\.cline\data\workspaces\chat\spawnpad
set SRC=%BASE%\web
set DST=%BASE%\build-isolate\web
echo === isolated build started %DATE% %TIME% === > "%BASE%\build-isolate.log"

REM Remove a previous junction FIRST (plain rmdir, no /s) so a later /s /q
REM can never recurse through the junction into the REAL node_modules.
if exist "%DST%\node_modules\" rmdir "%DST%\node_modules" >> "%BASE%\build-isolate.log" 2>&1
if exist "%DST%" rmdir /s /q "%DST%" >> "%BASE%\build-isolate.log" 2>&1
if exist "%DST%" (echo FATAL: could not remove old isolate >> "%BASE%\build-isolate.log" & exit /b 1)

robocopy "%SRC%" "%DST%" /E /XD node_modules .next .git .data /XF *.log tsconfig.tsbuildinfo /NFL /NDL /NJH /NJS >> "%BASE%\build-isolate.log" 2>&1
echo ROBOCOPY_EXIT=%ERRORLEVEL% (0-7 = success) >> "%BASE%\build-isolate.log"

mklink /J "%DST%\node_modules" "%SRC%\node_modules" >> "%BASE%\build-isolate.log" 2>&1
echo JUNCTION_EXIT=%ERRORLEVEL% >> "%BASE%\build-isolate.log"

copy /y "%SRC%\.env.local" "%DST%\.env.local" >> "%BASE%\build-isolate.log" 2>&1
copy /y "%SRC%\.env.example" "%DST%\.env.example" >> "%BASE%\build-isolate.log" 2>&1

cd /d "%DST%"
call npx next build > "%BASE%\build-isolate-next.log" 2>&1
echo BUILD-DONE-EXITCODE-%ERRORLEVEL% >> "%BASE%\build-isolate-next.log"
echo === isolated build finished %DATE% %TIME% === >> "%BASE%\build-isolate.log"