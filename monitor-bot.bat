@echo off
echo ========================================
echo      DELTA TRADING BOT - MONITOR
echo ========================================

REM Add npm global path to current session
set PATH=%PATH%;C:\Users\Owner\npm-global;%APPDATA%\npm

echo.
echo Real-time monitoring dashboard starting...
echo Press Ctrl+C to exit monitoring
echo.
timeout /t 2 >nul
pm2 monit