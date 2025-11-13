@echo off
echo Debug: Setting PATH
set PATH=%PATH%;C:\Users\Owner\npm-global;%APPDATA%\npm

echo Debug: Checking PM2
where pm2
if errorlevel 1 (
    echo PM2 not found
    exit /b 1
) else (
    echo PM2 found
)

echo Debug: Checking trading-bot status
pm2 describe trading-bot >nul 2>&1
if errorlevel 1 (
    echo Trading bot not running, starting it
    pm2 start src/app.js --name "trading-bot" --time
) else (
    echo Trading bot running, restarting it
    pm2 restart trading-bot
)

echo Debug: Done