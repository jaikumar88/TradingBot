#!/bin/bash

echo "========================================"
echo "Setting up Python Backend for Trading Bot"
echo "========================================"

cd "$(dirname "$0")"

echo
echo "1. Creating Python virtual environment..."
python3 -m venv python-backend/venv
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create virtual environment. Make sure Python 3 is installed."
    exit 1
fi

echo
echo "2. Activating virtual environment..."
source python-backend/venv/bin/activate

echo
echo "3. Upgrading pip..."
python -m pip install --upgrade pip

echo
echo "4. Installing Python dependencies..."
pip install -r python-backend/requirements.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies."
    exit 1
fi

echo
echo "5. Installing system dependencies..."
echo "Note: You may need to install tesseract-ocr using your system package manager:"
echo "  Ubuntu/Debian: sudo apt-get install tesseract-ocr"
echo "  macOS: brew install tesseract"
echo "  CentOS/RHEL: sudo yum install tesseract"

echo
echo "6. Creating Python backend environment file..."
if [ ! -f "python-backend/.env" ]; then
    cat > python-backend/.env << EOF
FLASK_ENV=development
FLASK_DEBUG=True
TESSERACT_CMD=tesseract
EOF
fi

echo
echo "========================================"
echo "Python Backend Setup Complete!"
echo "========================================"
echo
echo "To start the Python backend:"
echo "  cd python-backend"
echo "  source venv/bin/activate"
echo "  python app.py"
echo
echo "The backend will run on http://localhost:5000"
echo