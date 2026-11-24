@echo off
rem Double-click to update the app and start Expo. Scan the QR code with Expo Go.
rem npm.cmd/npx.cmd: plain npx fails on this laptop with "unknown option: -n" (see CLAUDE.md).
cd /d "%~dp0"
git checkout -- package.json package-lock.json
git pull
call npm.cmd install
call npx.cmd expo start --tunnel ngrok -c
pause
