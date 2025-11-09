#!/usr/bin/env python3
"""
Test script for Python Backend Chart Analysis
"""

import sys
import os
import requests
import json
import base64
from PIL import Image, ImageDraw, ImageFont
import io

def create_test_chart():
    """Create a simple test chart image"""
    width, height = 800, 600
    img = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple candlestick pattern
    # Green candle (bullish)
    draw.rectangle([100, 200, 120, 300], fill='green', outline='black')
    draw.line([110, 180, 110, 200], fill='black', width=2)  # Upper wick
    draw.line([110, 300, 110, 320], fill='black', width=2)  # Lower wick
    
    # Red candle (bearish) 
    draw.rectangle([140, 250, 160, 350], fill='red', outline='black')
    draw.line([150, 230, 150, 250], fill='black', width=2)
    draw.line([150, 350, 150, 370], fill='black', width=2)
    
    # Add text
    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except:
        font = ImageFont.load_default()
    
    draw.text((200, 100), "BUY BTCUSDT", fill='green', font=font)
    draw.text((200, 140), "Entry: $42500", fill='black', font=font)
    draw.text((200, 180), "SL: $41800", fill='red', font=font)
    draw.text((200, 220), "TP: $44200", fill='green', font=font)
    
    return img

def test_python_backend():
    """Test the Python backend functionality"""
    print("🧪 Testing Python Backend for Trading Bot")
    print("=" * 50)
    
    # Test 1: Health check
    print("\n1. Testing health endpoint...")
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Backend is healthy: {health_data}")
        else:
            print(f"❌ Health check failed with status: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to backend: {e}")
        print("💡 Make sure the Python backend is running on http://localhost:5000")
        return False
    
    # Test 2: Create test image
    print("\n2. Creating test chart image...")
    test_image = create_test_chart()
    
    # Convert to base64
    img_buffer = io.BytesIO()
    test_image.save(img_buffer, format='PNG')
    img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
    img_data_uri = f"data:image/png;base64,{img_base64}"
    print("✅ Test chart image created")
    
    # Test 3: Chart analysis
    print("\n3. Testing chart analysis...")
    try:
        payload = {
            "image": img_data_uri,
            "analysis_type": "comprehensive"
        }
        
        response = requests.post(
            'http://localhost:5000/analyze-chart',
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Chart analysis successful!")
            
            if result.get('success') and result.get('signal'):
                signal = result['signal']
                print(f"📊 Signal: {signal.get('side', '').upper()} {signal.get('symbol', '')}")
                print(f"💰 Entry: ${signal.get('entryPrice', 0)}")
                print(f"🛑 Stop Loss: ${signal.get('stopLoss', 0)}")
                print(f"🎯 Take Profit: ${signal.get('takeProfit', 0)}")
                print(f"📈 Confidence: {(signal.get('confidence', 0) * 100):.1f}%")
                print(f"🔍 Method: {signal.get('method', '')}")
                print(f"📝 Reasoning: {signal.get('reasoning', '')}")
                
                if result.get('analysis'):
                    analysis = result['analysis']
                    print(f"\n📋 Analysis Details:")
                    print(f"  Trend: {analysis.get('trend_direction', '')} ({analysis.get('trend_strength', 0):.2f})")
                    print(f"  Support: {analysis.get('support_levels', [])}")
                    print(f"  Resistance: {analysis.get('resistance_levels', [])}")
                    print(f"  Patterns: {analysis.get('candlestick_patterns', [])}")
            else:
                print(f"⚠️ No trading signal generated: {result}")
                
        else:
            print(f"❌ Chart analysis failed with status: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Chart analysis request failed: {e}")
    
    # Test 4: OCR extraction
    print("\n4. Testing OCR text extraction...")
    try:
        payload = {"image": img_data_uri}
        
        response = requests.post(
            'http://localhost:5000/extract-text',
            json=payload,
            timeout=20
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ OCR extraction successful!")
            
            if result.get('success'):
                print(f"📖 Extracted Text: '{result.get('text', '')}'")
                print(f"📊 Confidence: {(result.get('confidence', 0) * 100):.1f}%")
                
                if result.get('trading_signals'):
                    signals = result['trading_signals']
                    print(f"🎯 Trading Signals Found: {len(signals)}")
                    for i, sig in enumerate(signals, 1):
                        print(f"  Signal {i}: {sig.get('side', '').upper()} {sig.get('symbol', '')}")
                        print(f"    Entry: ${sig.get('entry', 0)} | SL: ${sig.get('stop_loss', 0)} | TP: ${sig.get('take_profit', 0)}")
                
                if result.get('ocr_engines'):
                    engines = result['ocr_engines']
                    print(f"\n🔍 OCR Engines:")
                    for engine, data in engines.items():
                        print(f"  {engine}: {(data.get('confidence', 0) * 100):.1f}% - '{data.get('text', '')[:50]}...'")
            else:
                print(f"⚠️ OCR extraction failed: {result}")
                
        else:
            print(f"❌ OCR extraction failed with status: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ OCR extraction request failed: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Python Backend Test Complete!")
    print("💡 If all tests passed, your backend is ready for trading!")
    
    return True

if __name__ == "__main__":
    test_python_backend()