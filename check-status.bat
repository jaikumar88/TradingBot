@echo off
echo ========================================
echo      DELTA TRADING BOT - STATUS
echo ========================================

REM Add npm global path to current session
set PATH=%PATH%;C:\Users\Owner\npm-global;%APPDATA%\npm

echo.
echo Checking Trading Bot Status...
echo.
pm2 status
echo.
echo.
echo Bot Management Commands:
echo - pm2 logs trading-bot    (View logs)
echo - pm2 restart trading-bot (Restart bot)
echo - pm2 stop trading-bot    (Stop bot)
echo - pm2 delete trading-bot  (Remove bot)
echo.
echo 📊 Dashboard: http://localhost:3000
echo.
echo Press any key to exit...
pause >nul