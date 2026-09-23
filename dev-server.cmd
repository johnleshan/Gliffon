@echo off
rem Watchdog: keeps the Gliffon dev server alive in a restart loop.
cd /d "C:\Users\JOHN LESHAN\Documents\PROJECTS\Glyph"
:loop
call npm run dev -- --host 127.0.0.1 --port 5173 >> "%TEMP%\opencode\glifon-dev.log" 2>&1
choice /t 2 /c y /d y > nul
goto loop
