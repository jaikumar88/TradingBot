@echo off
echo ========================================
echo      DELTA TRADING BOT - RESTART
echo ========================================

REM Add npm global path to current session
set PATH=%PATH%;C:\Users\Owner\npm-global;%APPDATA%\npm

echo.
echo Restarting Trading Bot...
pm2 restart trading-bot
echo.
echo ✅ Trading Bot Restarted!
echo.
echo 📊 Dashboard: http://localhost:3000
echo 📝 View Logs: pm2 logs trading-bot
echo ⚡ Check Status: pm2 status
echo.
echo Press any key to exit...
pause >nul