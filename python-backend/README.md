# Python Backend for Advanced Chart Analysis

This Python backend provides sophisticated computer vision and OCR capabilities for trading chart analysis using OpenCV, scikit-image, and multi-engine OCR.

## Features

### 🎯 Advanced Chart Analysis
- **Trend Detection**: HSV color space analysis for trend identification
- **Candlestick Patterns**: Edge detection and pattern recognition
- **Support/Resistance**: HoughLines algorithm for key level detection
- **Price Action Analysis**: Contour detection for market structure
- **Trading Signal Generation**: Weighted confidence scoring system

### 📖 Multi-Engine OCR
- **EasyOCR**: Neural network-based OCR with high accuracy
- **Tesseract**: Traditional OCR engine with extensive language support
- **Preprocessing**: Image enhancement and noise reduction
- **Trading Pattern Extraction**: Regex patterns for signal detection

### 🔧 REST API
- **POST /analyze-chart**: Comprehensive chart analysis with trading signals
- **POST /extract-text**: Multi-engine OCR text extraction
- **GET /health**: Backend health check and status

## Installation

### Windows (Recommended)
```bash
# Run the automated setup script
setup_python_backend.bat
```

### Manual Installation
```bash
# 1. Create virtual environment
python -m venv python-backend/venv

# 2. Activate environment
# Windows:
python-backend\venv\Scripts\activate.bat
# Linux/macOS:
source python-backend/venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Install Tesseract OCR
# Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
# Ubuntu: sudo apt-get install tesseract-ocr
# macOS: brew install tesseract
```

## Dependencies

### Core Computer Vision
- **opencv-python**: Advanced computer vision algorithms
- **Pillow**: Image processing and manipulation
- **numpy**: Numerical computing for image arrays
- **scikit-image**: Scientific image processing

### OCR Engines
- **easyocr**: Neural network OCR with 80+ languages
- **pytesseract**: Python wrapper for Tesseract OCR

### Machine Learning & Analysis
- **pandas**: Data analysis and manipulation
- **scikit-learn**: Machine learning algorithms
- **matplotlib**: Plotting and visualization
- **TA-Lib**: Technical analysis indicators

### Web Framework
- **Flask**: Lightweight REST API server
- **Flask-CORS**: Cross-origin resource sharing

## Configuration

### Environment Variables (.env)
```bash
FLASK_ENV=development
FLASK_DEBUG=True
TESSERACT_CMD=tesseract
```

### Tesseract Configuration
- Ensure Tesseract is installed and in PATH
- Default command: `tesseract`
- Custom path: Set `TESSERACT_CMD` environment variable

## Usage

### Start the Backend
```bash
cd python-backend
source venv/bin/activate  # or venv\Scripts\activate.bat on Windows
python app.py
```

The server will start on `http://localhost:5000`

### API Endpoints

#### Chart Analysis
```bash
POST /analyze-chart
Content-Type: application/json

{
    "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "analysis_type": "comprehensive"  // or "quick", "detailed"
}
```

**Response:**
```json
{
    "success": true,
    "signal": {
        "isSignal": true,
        "symbol": "BTC",
        "side": "buy",
        "entryPrice": 42500,
        "stopLoss": 41800,
        "takeProfit": 44200,
        "confidence": 0.85,
        "reasoning": "Strong bullish trend with support at $42000",
        "method": "advanced_cv_analysis"
    },
    "analysis": {
        "trend_direction": "bullish",
        "trend_strength": 0.78,
        "support_levels": [42000, 41500],
        "resistance_levels": [43500, 44000],
        "candlestick_patterns": ["hammer", "doji"],
        "price_action": "consolidation_breakout"
    }
}
```

#### Text Extraction
```bash
POST /extract-text
Content-Type: application/json

{
    "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**Response:**
```json
{
    "success": true,
    "text": "BUY BTCUSDT Entry: $42500 SL: $41800 TP: $44200",
    "confidence": 0.92,
    "trading_signals": [
        {
            "symbol": "BTCUSDT",
            "side": "buy",
            "entry": 42500,
            "stop_loss": 41800,
            "take_profit": 44200
        }
    ],
    "ocr_engines": {
        "easyocr": {
            "text": "BUY BTCUSDT Entry: $42500",
            "confidence": 0.89
        },
        "tesseract": {
            "text": "BUY BTCUSDT Entry: $42500",
            "confidence": 0.95
        }
    }
}
```

## Integration with Node.js Bot

The Python backend is seamlessly integrated with the Node.js trading bot through the `PythonAnalysisService.js`:

```javascript
const pythonService = new PythonAnalysisService();

// Analyze chart image
const result = await pythonService.analyzeChartImage(imageData, 'comprehensive');

// Extract text from image
const textResult = await pythonService.extractTextFromImage(imageData);
```

## Architecture

### Chart Analysis Pipeline
1. **Image Preprocessing**: Resize, enhance contrast, reduce noise
2. **Color Analysis**: HSV color space trend detection
3. **Pattern Detection**: Edge detection for candlestick patterns
4. **Level Identification**: HoughLines for support/resistance
5. **Signal Generation**: Weighted scoring and confidence calculation

### OCR Pipeline
1. **Image Preprocessing**: Grayscale conversion, noise reduction
2. **EasyOCR Engine**: Neural network-based text recognition
3. **Tesseract Engine**: Traditional OCR with language models
4. **Text Processing**: Pattern matching for trading signals
5. **Confidence Scoring**: Weighted average of engine confidence

## Performance

- **Chart Analysis**: ~2-5 seconds for comprehensive analysis
- **OCR Extraction**: ~1-3 seconds for text recognition
- **Memory Usage**: ~200-500MB depending on image size
- **CPU Usage**: Optimized for real-time analysis

## Error Handling

The backend includes comprehensive error handling:
- Image format validation
- Timeout protection (30s default)
- Graceful fallbacks for analysis failures
- Detailed error logging
- Health check monitoring

## Troubleshooting

### Common Issues
1. **Tesseract not found**: Install Tesseract OCR and add to PATH
2. **OpenCV import error**: Reinstall opencv-python with `pip install opencv-python --force-reinstall`
3. **Memory errors**: Reduce image size or increase system RAM
4. **Slow analysis**: Use 'quick' analysis type for faster results

### Logging
Enable detailed logging by setting `FLASK_DEBUG=True` in the environment.

## Development

### Adding New Analysis Methods
1. Extend `ChartImageAnalyzer` class in `chart_analyzer.py`
2. Add new endpoints in `app.py`
3. Update API documentation

### Testing
```bash
# Test chart analysis
curl -X POST http://localhost:5000/analyze-chart \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/png;base64,...", "analysis_type": "quick"}'

# Health check
curl http://localhost:5000/health
```

## License

This project is part of the DeltaExchange Trading Bot system and follows the same license terms.