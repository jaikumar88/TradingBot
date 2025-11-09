@echo off
echo 🤖 Delta Exchange Trading Bot - Background Manager
echo.

:menu
echo Choose an option:
echo [1] Start Trading Bot (Background)
echo [2] Stop Trading Bot
echo [3] Restart Trading Bot
echo [4] View Status
echo [5] View Live Logs
echo [6] Open Dashboard (http://localhost:3000)
echo [7] Setup Auto-start on Boot
echo [8] Exit
echo.

set /p choice="Enter your choice (1-8): "

if "%choice%"=="1" (
    echo Starting Trading Bot in background...
    pm2 start ecosystem.config.js
    echo ✅ Trading Bot started! Access dashboard at: http://localhost:3000
    pause
    goto menu
)

if "%choice%"=="2" (
    echo Stopping Trading Bot...
    pm2 stop trading-bot
    echo ✅ Trading Bot stopped!
    pause
    goto menu
)

if "%choice%"=="3" (
    echo Restarting Trading Bot...
    pm2 restart trading-bot
    echo ✅ Trading Bot restarted!
    pause
    goto menu
)

if "%choice%"=="4" (
    echo Trading Bot Status:
    pm2 status
    pause
    goto menu
)

if "%choice%"=="5" (
    echo Live logs (Press Ctrl+C to exit):
    pm2 logs trading-bot
    goto menu
)

if "%choice%"=="6" (
    echo Opening Dashboard...
    start http://localhost:3000
    goto menu
)

if "%choice%"=="7" (
    echo Setting up auto-start on boot...
    pm2 startup
    echo Run the command above, then run: pm2 save
    pause
    goto menu
)

if "%choice%"=="8" (
    echo Goodbye! 👋
    exit
)

echo Invalid choice. Please try again.
goto menu