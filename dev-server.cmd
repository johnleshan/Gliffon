@echo off
cd /d "C:\Users\JOHN LESHAN\Documents\PROJECTS\Glyph"
npm run dev -- --host 127.0.0.1 --port 5173 > "%TEMP%\opencode\glifon-dev.log" 2>&1
