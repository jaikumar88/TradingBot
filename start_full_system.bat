@echo off
echo ========================================
echo Starting Trading Bot with Python Backend
echo ========================================

cd /d "%~dp0"

echo.
echo Starting Python Backend...
start "Python Backend" cmd /k "cd python-backend && call venv\Scripts\activate.bat && python app.py"

echo.
echo Waiting 5 seconds for Python backend to start...
timeout /t 5 /nobreak >nul

echo.
echo Starting Node.js Trading Bot...
start "Trading Bot" cmd /k "npm start"

echo.
echo ========================================
echo Both services are starting!
echo ========================================
echo.
echo Python Backend: http://localhost:5000
echo Trading Bot: Running in separate terminal
echo.
echo Press any key to close this window...
pause >nul