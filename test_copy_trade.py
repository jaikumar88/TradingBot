#!/usr/bin/env python3

import requests
import json
import base64

def test_copy_trade():
    """Test the copy trade functionality with the backend"""
    
    # Test image (you can replace with actual chart image path)
    test_image_path = "sample_chart.png"  # Replace with actual chart image
    
    try:
        # Read and encode the image
        with open(test_image_path, 'rb') as img_file:
            image_data = base64.b64encode(img_file.read()).decode('utf-8')
        
        # Send to backend for analysis
        url = "http://localhost:5000/analyze-chart"
        payload = {
            "image": image_data,
            "force_copy_mode": True  # Force copy mode for testing
        }
        
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            result = response.json()
            print("\n🎯 === COPY TRADE TEST RESULT ===")
            print(f"✅ Analysis successful!")
            print(f"📊 Signal detected: {result.get('analysis', {}).get('isSignal', False)}")
            print(f"🔄 Trade mode: {result.get('analysis', {}).get('side', 'unknown')}")
            print(f"📈 Confidence: {result.get('analysis', {}).get('confidence', 0)}")
            print(f"💯 Stop Loss: {result.get('analysis', {}).get('stopLossPercent', 0)}%")
            print(f"💯 Take Profit: {result.get('analysis', {}).get('takeProfitPercent', 0)}%")
            print(f"📋 Method: {result.get('analysis', {}).get('method', 'unknown')}")
            
            # Print detailed markers
            markers = result.get('analysis', {}).get('analysis_details', {}).get('markers_detected', {})
            if markers:
                print(f"\n📊 Detected Trade Markers:")
                for marker_type, count in markers.items():
                    print(f"   - {marker_type}: {count}")
                    
            return True
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return False
            
    except FileNotFoundError:
        print(f"❌ Image file not found: {test_image_path}")
        print("📸 Please provide a valid chart image to test copy functionality")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Testing Copy Trade Functionality...")
    success = test_copy_trade()
    
    if success:
        print("\n✅ Copy trade test completed successfully!")
    else:
        print("\n❌ Copy trade test failed!")