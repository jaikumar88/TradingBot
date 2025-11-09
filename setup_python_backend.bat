@echo off
echo ========================================
echo Setting up Python Backend for Trading Bot
echo ========================================

cd /d "%~dp0"

echo.
echo 1. Creating Python virtual environment...
python -m venv python-backend\venv
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to create virtual environment. Make sure Python is installed.
    pause
    exit /b 1
)

echo.
echo 2. Activating virtual environment...
call python-backend\venv\Scripts\activate.bat

echo.
echo 3. Upgrading pip...
python -m pip install --upgrade pip

echo.
echo 4. Installing Python dependencies...
pip install -r python-backend\requirements.txt
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo 5. Installing Tesseract OCR (if not installed)...
echo Note: If this fails, download Tesseract manually from:
echo https://github.com/UB-Mannheim/tesseract/wiki
pip install tesseract-ocr

echo.
echo 6. Creating Python backend environment file...
if not exist "python-backend\.env" (
    echo FLASK_ENV=development > python-backend\.env
    echo FLASK_DEBUG=True >> python-backend\.env
    echo TESSERACT_CMD=tesseract >> python-backend\.env
)

echo.
echo ========================================
echo Python Backend Setup Complete!
echo ========================================
echo.
echo To start the Python backend:
echo   cd python-backend
echo   call venv\Scripts\activate.bat
echo   python app.py
echo.
echo The backend will run on http://localhost:5000
echo.
pause