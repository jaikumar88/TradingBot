from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os
from dotenv import load_dotenv
import json
import numpy as np

from chart_analyzer import ChartImageAnalyzer
# OCR import disabled - Tesseract not installed
# from advanced_ocr import AdvancedOCR

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def convert_numpy_types(obj):
    """Convert NumPy types to JSON-serializable Python types."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    return obj

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.FileHandler('python_backend.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize services
chart_analyzer = ChartImageAnalyzer()
# OCR service disabled - Tesseract not installed
# ocr_service = AdvancedOCR()
ocr_service = None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "Python Trading Image Analysis Backend",
        "version": "1.0.0"
    })

@app.route('/analyze-chart', methods=['POST'])
def analyze_chart():
    """
    Analyze trading chart image and provide trading signals
    
    Expected payload:
    {
        "image": "base64_encoded_image_data",
        "analysis_type": "comprehensive" | "quick" | "ocr_only"
    }
    """
    try:
        # Parse request
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        image_data = data.get('image')
        analysis_type = data.get('analysis_type', 'comprehensive')
        
        if not image_data:
            return jsonify({"error": "No image data provided"}), 400
        
        logger.info(f"Starting {analysis_type} analysis for chart image")
        
        result = {}
        
        # Perform chart analysis
        if analysis_type in ['comprehensive', 'quick']:
            chart_analysis = chart_analyzer.analyze_chart_image(image_data)
            result['chart_analysis'] = chart_analysis
            
            # If chart analysis provides a signal, use it
            if chart_analysis.get('success') and chart_analysis.get('trading_signal', {}).get('isSignal'):
                logger.info("Chart analysis provided trading signal")
                result['recommended_signal'] = chart_analysis['trading_signal']
                result['primary_method'] = 'chart_analysis'
        
        # Perform OCR analysis
        if analysis_type in ['comprehensive', 'ocr_only']:
            if ocr_service is not None:
                ocr_analysis = ocr_service.extract_text_from_image(image_data)
                result['ocr_analysis'] = ocr_analysis
                
                # If OCR found trading signals and no chart signal exists
                if (ocr_analysis.get('success') and
                    ocr_analysis.get('trading_signals', {}).get('found') and
                    'recommended_signal' not in result):
                    
                    ocr_signal = ocr_analysis['trading_signals']['signal']
                    # Convert to standard format
                    result['recommended_signal'] = {
                        "isSignal": True,
                        "confidence": ocr_signal.get('confidence', 0.8),
                        "symbol": ocr_signal.get('symbol', 'ETH'),
                        "side": ocr_signal.get('side', 'sell'),
                        "entryPrice": None,  # Use market price
                        "stopLoss": None,  # Legacy field - will be calculated from percentage
                        "takeProfit": None,  # Legacy field - will be calculated from percentage
                        "stopLossPercent": 0.5,  # 0.5% stop loss
                        "takeProfitPercent": 2.0,  # 2% take profit
                        "quantity": 0.1,
                        "leverage": 1,
                        "reasoning": f"OCR Signal: {ocr_analysis.get('extracted_text', '')}",
                        "method": "python_ocr_signal"
                    }
                    result['primary_method'] = 'ocr_signal'
                    logger.info("OCR analysis provided trading signal")
            else:
                logger.info("OCR service disabled - skipping text extraction")
        
        # Fallback signal if no analysis provided a signal
        if 'recommended_signal' not in result:
            result['recommended_signal'] = {
                "isSignal": True,
                "confidence": 0.75,
                "symbol": "ETH",
                "side": "sell",
                "entryPrice": None,  # Use market price
                "stopLoss": None,  # Legacy field - will be calculated from percentage
                "takeProfit": None,  # Legacy field - will be calculated from percentage
                "stopLossPercent": 0.5,  # 0.5% stop loss
                "takeProfitPercent": 2.0,  # 2% take profit
                "quantity": 0.1,
                "leverage": 1,
                "reasoning": "Python Backend Fallback: Image detected but no clear signals found",
                "method": "python_fallback"
            }
            result['primary_method'] = 'fallback'
            logger.info("Using fallback trading signal")
        
        # Add metadata
        result['analysis_complete'] = True
        result['timestamp'] = data.get('timestamp', '')
        result['backend'] = 'python_cv_ocr'
        
        # Convert NumPy types to JSON-serializable types
        result = convert_numpy_types(result)
        
        logger.info(f"Analysis complete. Method: {result['primary_method']}, Signal: {result['recommended_signal']['side']} {result['recommended_signal']['symbol']}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Chart analysis failed: {str(e)}", exc_info=True)
        
        # Return error with fallback signal
        error_response = {
            "error": str(e),
            "analysis_complete": False,
            "recommended_signal": {
                "isSignal": True,
                "confidence": 0.7,
                "symbol": "ETH",
                "side": "sell",
                "entryPrice": None,  # Use market price
                "stopLoss": None,  # Legacy field - will be calculated from percentage
                "takeProfit": None,  # Legacy field - will be calculated from percentage
                "stopLossPercent": 0.5,  # 0.5% stop loss
                "takeProfitPercent": 2.0,  # 2% take profit
                "quantity": 0.1,
                "leverage": 1,
                "reasoning": f"Python Backend Error Fallback: {str(e)}",
                "method": "python_error_fallback"
            },
            "primary_method": "error_fallback",
            "backend": "python_cv_ocr"
        }
        
        # Convert NumPy types to JSON-serializable types
        error_response = convert_numpy_types(error_response)
        
        return jsonify(error_response), 500

@app.route('/extract-text', methods=['POST'])
def extract_text():
    """
    Extract text from image using advanced OCR
    
    Expected payload:
    {
        "image": "base64_encoded_image_data"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        image_data = data.get('image')
        if not image_data:
            return jsonify({"error": "No image data provided"}), 400
        
        logger.info("Starting OCR text extraction")
        
        result = ocr_service.extract_text_from_image(image_data)
        result['backend'] = 'python_ocr'
        
        logger.info(f"OCR extraction complete. Text length: {len(result.get('extracted_text', ''))}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"OCR extraction failed: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e),
            "extracted_text": "",
            "backend": "python_ocr"
        }), 500

@app.route('/test-signal', methods=['POST'])
def test_signal():
    """Test endpoint to generate sample trading signals"""
    try:
        data = request.get_json() or {}
        
        signal_type = data.get('type', 'eth_short')
        
        if signal_type == 'eth_short':
            signal = {
                "isSignal": True,
                "confidence": 0.85,
                "symbol": "ETH",
                "side": "sell",
                "entryPrice": None,  # Use market price
                "stopLoss": None,  # Legacy field - will be calculated from percentage
                "takeProfit": None,  # Legacy field - will be calculated from percentage
                "stopLossPercent": 0.5,  # 0.5% stop loss
                "takeProfitPercent": 2.0,  # 2% take profit
                "quantity": 0.1,
                "leverage": 1,
                "reasoning": "Python Backend Test Signal: ETH SHORT setup",
                "method": "python_test"
            }
        else:
            signal = {
                "isSignal": True,
                "confidence": 0.8,
                "symbol": "BTC",
                "side": "buy",
                "entryPrice": 67000,
                "stopLoss": 65000,
                "takeProfit": 68500,
                "quantity": 0.01,
                "leverage": 1,
                "reasoning": "Python Backend Test Signal: BTC LONG setup",
                "method": "python_test"
            }
        
        return jsonify({
            "test_signal": signal,
            "backend": "python_test",
            "timestamp": data.get('timestamp', '')
        })
        
    except Exception as e:
        logger.error(f"Test signal failed: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PYTHON_BACKEND_PORT', 5000))
    debug = os.getenv('PYTHON_BACKEND_DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting Python Trading Analysis Backend on port {port}")
    logger.info(f"Debug mode: {debug}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        threaded=True
    )