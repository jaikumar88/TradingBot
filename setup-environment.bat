@echo off
echo ========================================
echo    TRADING BOT - SETUP ENVIRONMENT
echo ========================================
echo.
echo Setting up PM2 and Node.js environment...
echo.

REM Install PM2 globally if not installed
echo Installing PM2 globally...
npm install -g pm2
echo.

REM Get npm global path
for /f %%i in ('npm config get prefix') do set NPM_PREFIX=%%i

echo NPM Global Path: %NPM_PREFIX%
echo.

echo Adding NPM path to current session...
set PATH=%PATH%;%NPM_PREFIX%;%APPDATA%\npm
echo.

REM Check if PM2 is working
echo Testing PM2 installation...
pm2 --version
if errorlevel 1 (
    echo ❌ PM2 installation failed!
    echo.
    echo Manual fix:
    echo 1. Close this window
    echo 2. Restart PowerShell/Command Prompt as Administrator
    echo 3. Run: npm install -g pm2
    echo 4. Add to PATH: %NPM_PREFIX% and %APPDATA%\npm
    pause
    exit /b 1
) else (
    echo ✅ PM2 is working correctly!
)

echo.
echo ========================================
echo          SETUP COMPLETE!
echo ========================================
echo.
echo Next steps:
echo 1. Run: .\start-bot.bat
echo 2. Open: http://localhost:3000
echo 3. Check status: .\check-status.bat
echo.
echo Press any key to exit...
pause >nul