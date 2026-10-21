@echo off
REM Double-click on Windows to start Naadamy (needs Node.js from nodejs.org).
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download it free from https://nodejs.org & pause & exit /b 1)
node server.js
pause
