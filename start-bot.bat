@echo off
echo ========================================
echo       DELTA TRADING BOT - START
echo ========================================

@echo off
echo ========================================
echo       DELTA TRADING BOT - START
echo ========================================

echo Setting up environment...

REM Add npm global path to current session
set "PATH=%PATH%;C:\Users\Owner\npm-global;%APPDATA%\npm"

REM Check if PM2 is available
where pm2 >nul 2>nul
if errorlevel 1 (
    echo Installing PM2...
    npm install -g pm2
    echo PM2 installed!
)

echo Starting Trading Bot in background...

REM Check if trading-bot is already running
pm2 describe trading-bot >nul 2>nul
if errorlevel 1 (
    echo Starting new trading bot instance...
    pm2 start src/app.js --name "trading-bot" --time
    if errorlevel 1 (
        echo Failed to start trading bot!
        pause
        exit /b 1
    )
    echo Trading Bot Started Successfully!
) else (
    echo Trading Bot already running, restarting...
    pm2 restart trading-bot
    if errorlevel 1 (
        echo Failed to restart trading bot!
        pause
        exit /b 1
    )
    echo Trading Bot Restarted Successfully!
)

echo.
echo Trading Bot Started Successfully!
echo.
echo Dashboard: http://localhost:3000
echo View Logs: pm2 logs trading-bot
echo Check Status: pm2 status
echo.
pause