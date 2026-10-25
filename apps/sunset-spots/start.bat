@echo off
rem Double-click to update the app and start Expo. Scan the QR code with Expo Go.
cd /d "%~dp0"
git pull
call npm install
call npx expo start
pause
