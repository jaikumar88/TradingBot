@echo off
echo ========================================
echo       DELTA TRADING BOT - STOP
echo ========================================

REM Add npm global path to current session
set PATH=%PATH%;C:\Users\Owner\npm-global;%APPDATA%\npm

echo.
echo Stopping Trading Bot...
pm2 stop trading-bot
echo.
echo ✅ Trading Bot Stopped!
echo.
echo Press any key to exit...
pause >nul