@echo off
echo ========================================
echo      DELTA TRADING BOT - LOGS
echo ========================================

REM Add npm global path to current session
set PATH=%PATH%;C:\Users\Owner\npm-global;%APPDATA%\npm

echo.
echo Viewing Trading Bot Logs (Ctrl+C to exit)...
echo.
pm2 logs trading-bot