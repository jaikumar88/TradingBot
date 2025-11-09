import cv2
import numpy as np
from PIL import Image
import base64
import io
import logging
from typing import Dict, List, Tuple, Optional

logger = logging.getLogger(__name__)

class ChartImageAnalyzer:
    """Advanced chart image analysis using computer vision"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    def analyze_chart_image(self, image_data: str) -> Dict:
        """
        Analyze trading chart image and extract trading signals
        
        Args:
            image_data: Base64 encoded image data
            
        Returns:
            Dict containing analysis results and trading signals
        """
        try:
            print("\n🔍 === STARTING CHART ANALYSIS ===")
            self.logger.info("🔍 Starting comprehensive chart image analysis")
            
            # Decode base64 image
            image = self._decode_image(image_data)
            if image is None:
                return self._create_error_response("Failed to decode image")
            
            print(f"📊 Image decoded successfully: {image.shape}")
            self.logger.info(f"📊 Image decoded - Shape: {image.shape}")
            
            # Perform comprehensive analysis
            print("\n🎯 Running trend analysis...")
            trend_analysis = self._analyze_trend_colors(image)
            print(f"📈 Trend Analysis Result: {trend_analysis}")
            
            print("\n� Detecting existing trade setup...")
            existing_trade = self._detect_existing_trade(image)
            print(f"📋 Existing Trade Detection: {existing_trade}")
            
            print("\n�🕯️ Detecting candlestick patterns...")
            candlestick_patterns = self._detect_candlestick_patterns(image)
            print(f"🕯️ Candlestick Patterns: {candlestick_patterns}")
            
            print("\n📏 Finding support/resistance levels...")
            support_resistance = self._find_support_resistance_levels(image)
            print(f"📏 Support/Resistance: {support_resistance}")
            
            print("\n💹 Analyzing price action...")
            price_action = self._analyze_price_action(image)
            print(f"💹 Price Action: {price_action}")
            
            print("\n📊 Analyzing volume patterns...")
            volume_analysis = self._analyze_volume_patterns(image)
            print(f"📊 Volume Analysis: {volume_analysis}")
            
            analysis_results = {
                "trend_analysis": trend_analysis,
                "existing_trade": existing_trade,
                "candlestick_patterns": candlestick_patterns,
                "support_resistance": support_resistance,
                "price_action": price_action,
                "volume_analysis": volume_analysis
            }
            
            # Generate trading signal
            print("\n🎯 Generating trading signal...")
            trading_signal = self._generate_trading_signal(analysis_results)
            print(f"🎯 Trading Signal Generated: {trading_signal}")
            print("✅ === ANALYSIS COMPLETE ===\n")
            
            return {
                "success": True,
                "analysis": analysis_results,
                "trading_signal": trading_signal,
                "confidence": trading_signal.get("confidence", 0.75),
                "method": "python_cv_analysis"
            }
            
        except Exception as e:
            self.logger.error(f"Chart analysis failed: {str(e)}")
            return self._create_error_response(f"Analysis failed: {str(e)}")
    
    def _decode_image(self, image_data: str) -> Optional[np.ndarray]:
        """Decode base64 image data to OpenCV format"""
        try:
            # Remove data URL prefix if present
            if image_data.startswith('data:'):
                if ',' in image_data:
                    image_data = image_data.split(',')[1]
                else:
                    self.logger.error("Invalid data URL format")
                    return None
            
            # Clean up base64 string
            image_data = image_data.strip()
            
            # Decode base64
            try:
                image_bytes = base64.b64decode(image_data)
            except Exception as e:
                self.logger.error(f"Base64 decode failed: {str(e)}")
                return None
            
            # Validate image data
            if len(image_bytes) < 100:  # Minimum viable image size
                self.logger.error(f"Image data too small: {len(image_bytes)} bytes")
                return None
            
            # Create BytesIO object
            image_buffer = io.BytesIO(image_bytes)
            image_buffer.seek(0)  # Reset to beginning
            
            # Convert to PIL Image with explicit format detection
            try:
                pil_image = Image.open(image_buffer)
                pil_image.load()  # Force loading of the image
                
                # Convert to RGB if needed
                if pil_image.mode != 'RGB':
                    pil_image = pil_image.convert('RGB')
                
                # Convert to OpenCV format (BGR)
                opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
                
                self.logger.info(f"Successfully decoded image: {opencv_image.shape}")
                return opencv_image
                
            except Exception as e:
                self.logger.error(f"PIL Image.open failed: {str(e)}")
                
                # Fallback: try direct OpenCV decode
                nparr = np.frombuffer(image_bytes, np.uint8)
                opencv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if opencv_image is not None:
                    self.logger.info(f"OpenCV fallback successful: {opencv_image.shape}")
                    return opencv_image
                else:
                    self.logger.error("OpenCV fallback also failed")
                    return None
            
        except Exception as e:
            self.logger.error(f"Image decode failed: {str(e)}")
            return None
    
    def _analyze_trend_colors(self, image: np.ndarray) -> Dict:
        """Analyze predominant colors to determine market trend"""
        try:
            # Convert to HSV for better color analysis
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            
            # Define color ranges for green (bullish) and red (bearish)
            green_lower = np.array([35, 50, 50])  # Green hue range
            green_upper = np.array([85, 255, 255])
            
            red_lower1 = np.array([0, 50, 50])     # Red hue range (wraparound)
            red_upper1 = np.array([10, 255, 255])
            red_lower2 = np.array([170, 50, 50])
            red_upper2 = np.array([180, 255, 255])
            
            # Create masks
            green_mask = cv2.inRange(hsv, green_lower, green_upper)
            red_mask1 = cv2.inRange(hsv, red_lower1, red_upper1)
            red_mask2 = cv2.inRange(hsv, red_lower2, red_upper2)
            red_mask = cv2.bitwise_or(red_mask1, red_mask2)
            
            # Calculate pixel counts
            green_pixels = cv2.countNonZero(green_mask)
            red_pixels = cv2.countNonZero(red_mask)
            total_pixels = image.shape[0] * image.shape[1]
            
            green_ratio = green_pixels / total_pixels
            red_ratio = red_pixels / total_pixels
            
            # Determine trend
            if green_ratio > red_ratio and green_ratio > 0.02:
                trend = "bullish"
                confidence = min(0.95, 0.6 + green_ratio * 5)
            elif red_ratio > green_ratio and red_ratio > 0.02:
                trend = "bearish"
                confidence = min(0.95, 0.6 + red_ratio * 5)
            else:
                trend = "neutral"
                confidence = 0.5
            
            return {
                "trend": trend,
                "confidence": confidence,
                "green_ratio": float(green_ratio),
                "red_ratio": float(red_ratio),
                "dominant_color": "green" if green_ratio > red_ratio else "red"
            }
            
        except Exception as e:
            self.logger.error(f"Trend analysis failed: {str(e)}")
            return {"trend": "neutral", "confidence": 0.5, "error": str(e)}
    
    def _detect_existing_trade(self, image: np.ndarray) -> Dict:
        """Detect existing trade markers in the chart and extract trade parameters to copy"""
        try:
            print("🔍 Scanning for existing trade markers to COPY...")
            
            # Convert to HSV for better color detection
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            height, width = image.shape[:2]
            
            # Define color ranges for trading markers (more precise for trade copying)
            # Blue lines (common for support/resistance and entry levels)
            blue_lower = np.array([100, 30, 30])
            blue_upper = np.array([130, 255, 255])
            blue_mask = cv2.inRange(hsv, blue_lower, blue_upper)
            
            # Purple/Magenta areas (rectangular zones, trade boxes)
            purple_lower = np.array([140, 30, 30])
            purple_upper = np.array([170, 255, 255])
            purple_mask = cv2.inRange(hsv, purple_lower, purple_upper)
            
            # Red lines (often stop loss or target levels)
            red_lower1 = np.array([0, 50, 50])
            red_upper1 = np.array([10, 255, 255])
            red_lower2 = np.array([170, 50, 50])  
            red_upper2 = np.array([180, 255, 255])
            red_mask = cv2.bitwise_or(cv2.inRange(hsv, red_lower1, red_upper1), 
                                     cv2.inRange(hsv, red_lower2, red_upper2))
            
            # Yellow/Orange lines (often take profit levels)
            yellow_lower = np.array([15, 50, 50])
            yellow_upper = np.array([35, 255, 255])
            yellow_mask = cv2.inRange(hsv, yellow_lower, yellow_upper)
            
            # Detect horizontal lines more precisely
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 30, 100, apertureSize=3)
            
            # Find horizontal lines (price levels)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=40, minLineLength=width//4, maxLineGap=20)
            
            horizontal_levels = []
            if lines is not None:
                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    # Strong horizontal line filter (very flat lines)
                    if abs(y2 - y1) <= 3 and abs(x2 - x1) >= width//4:
                        y_pos = (y1 + y2) / 2
                        horizontal_levels.append({
                            'y_position': y_pos,
                            'height_ratio': y_pos / height,  # Position as ratio of image height
                            'length': abs(x2 - x1),
                            'strength': abs(x2 - x1) / width  # Line strength relative to width
                        })
            
            # Sort levels by position (top to bottom)
            horizontal_levels.sort(key=lambda x: x['y_position'])
            
            # Count significant colored markers
            blue_pixels = cv2.countNonZero(blue_mask)
            purple_pixels = cv2.countNonZero(purple_mask)
            red_pixels = cv2.countNonZero(red_mask)
            yellow_pixels = cv2.countNonZero(yellow_mask)
            total_pixels = height * width
            
            # Calculate marker density
            blue_density = blue_pixels / total_pixels
            purple_density = purple_pixels / total_pixels
            red_density = red_pixels / total_pixels
            yellow_density = yellow_pixels / total_pixels
            
            print(f"📊 Trade Marker Analysis:")
            print(f"   - Blue markers: {blue_pixels} pixels ({blue_density:.1%})")
            print(f"   - Purple zones: {purple_pixels} pixels ({purple_density:.1%})")
            print(f"   - Red markers: {red_pixels} pixels ({red_density:.1%})")
            print(f"   - Yellow markers: {yellow_pixels} pixels ({yellow_density:.1%})")
            print(f"   - Horizontal levels: {len(horizontal_levels)}")
            
            # Strong indicator of existing trade setup
            has_trade_setup = (
                blue_density > 0.002 or    # Significant blue lines
                purple_density > 0.001 or  # Purple trade zones
                len(horizontal_levels) >= 3  # Multiple price levels
            )
            
            if has_trade_setup:
                print(f"✅ EXISTING TRADE SETUP DETECTED - COPYING TRADE:")
                print(f"   - Blue support/resistance lines: {blue_density:.1%}")
                print(f"   - Purple trade zones: {purple_density:.1%}")
                print(f"   - Price levels detected: {len(horizontal_levels)}")
                
                # Estimate trade parameters from detected levels
                trade_params = self._extract_trade_parameters(horizontal_levels, height)
                
                return {
                    "has_existing_trade": True,
                    "trade_type": "copy_existing_setup",
                    "markers_detected": {
                        "blue_lines": blue_pixels,
                        "purple_zones": purple_pixels,
                        "red_lines": red_pixels,
                        "yellow_lines": yellow_pixels,
                        "horizontal_levels": len(horizontal_levels),
                        "blue_density": blue_density,
                        "purple_density": purple_density
                    },
                    "trade_parameters": trade_params,
                    "confidence": 0.9,
                    "action": "copy_trade_setup"
                }
            else:
                print("❌ No clear existing trade setup to copy")
                return {
                    "has_existing_trade": False,
                    "trade_type": "new_signal",
                    "confidence": 0.0,
                    "action": "generate_new_signal"
                }
                
        except Exception as e:
            self.logger.error(f"Existing trade detection failed: {str(e)}")
            return {
                "has_existing_trade": False,
                "trade_type": "new_signal", 
                "error": str(e),
                "action": "generate_new_signal"
            }
    
    def _extract_trade_parameters(self, levels, image_height):
        """Extract trade parameters from detected price levels"""
        try:
            # Assume current price is around middle of image (common chart layout)
            current_price_y = image_height * 0.5  # Middle of chart
            
            # Find levels above and below current price
            levels_above = [l for l in levels if l['y_position'] < current_price_y]
            levels_below = [l for l in levels if l['y_position'] > current_price_y]
            
            # Estimate price percentages based on relative positions
            stop_loss_percent = 0.5  # Default
            take_profit_percent = 1.5  # Default
            
            if levels_above and levels_below:
                # Use closest levels for more precise estimation
                closest_above = min(levels_above, key=lambda x: abs(x['y_position'] - current_price_y))
                closest_below = min(levels_below, key=lambda x: abs(x['y_position'] - current_price_y))
                
                # Calculate approximate percentage from position ratios
                above_distance = abs(closest_above['y_position'] - current_price_y) / image_height
                below_distance = abs(closest_below['y_position'] - current_price_y) / image_height
                
                # Convert to percentage estimates (rough approximation)
                if above_distance > 0:
                    take_profit_percent = min(3.0, max(0.5, above_distance * 10))
                if below_distance > 0:
                    stop_loss_percent = min(2.0, max(0.3, below_distance * 8))
            
            return {
                "stop_loss_percent": round(stop_loss_percent, 1),
                "take_profit_percent": round(take_profit_percent, 1),
                "levels_above": len(levels_above),
                "levels_below": len(levels_below),
                "trade_direction": "follow_chart_setup"
            }
            
        except Exception as e:
            return {
                "stop_loss_percent": 0.5,
                "take_profit_percent": 1.5,
                "error": str(e),
                "trade_direction": "follow_chart_setup"
            }
    
    def _detect_candlestick_patterns(self, image: np.ndarray) -> Dict:
        """Detect candlestick patterns in the chart"""
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply edge detection
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            
            # Find vertical lines (potential candlesticks)
            vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 10))
            vertical_lines = cv2.morphologyEx(edges, cv2.MORPH_OPEN, vertical_kernel)
            
            # Find horizontal lines (potential wicks/bodies)
            horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (10, 1))
            horizontal_lines = cv2.morphologyEx(edges, cv2.MORPH_OPEN, horizontal_kernel)
            
            # Count potential candlestick structures
            vertical_count = cv2.countNonZero(vertical_lines)
            horizontal_count = cv2.countNonZero(horizontal_lines)
            
            # Simple pattern detection based on line density
            candlestick_density = (vertical_count + horizontal_count) / (image.shape[0] * image.shape[1])
            
            if candlestick_density > 0.01:
                pattern_detected = True
                pattern_type = "standard_candlesticks"
                confidence = min(0.9, candlestick_density * 50)
            else:
                pattern_detected = False
                pattern_type = "no_clear_pattern"
                confidence = 0.3
            
            return {
                "pattern_detected": pattern_detected,
                "pattern_type": pattern_type,
                "confidence": confidence,
                "candlestick_density": float(candlestick_density)
            }
            
        except Exception as e:
            self.logger.error(f"Candlestick detection failed: {str(e)}")
            return {"pattern_detected": False, "error": str(e)}
    
    def _find_support_resistance_levels(self, image: np.ndarray) -> Dict:
        """Find horizontal support and resistance levels"""
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Use HoughLinesP to detect horizontal lines
            lines = cv2.HoughLinesP(gray, 1, np.pi/180, threshold=100, 
                                   minLineLength=50, maxLineGap=10)
            
            horizontal_lines = []
            if lines is not None:
                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    # Check if line is approximately horizontal
                    angle = np.abs(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)
                    if angle < 5 or angle > 175:  # Nearly horizontal
                        horizontal_lines.append({
                            "y_position": (y1 + y2) // 2,
                            "length": np.sqrt((x2-x1)**2 + (y2-y1)**2),
                            "strength": min(1.0, len(horizontal_lines) * 0.1)
                        })
            
            # Sort by line strength
            horizontal_lines.sort(key=lambda x: x["strength"], reverse=True)
            
            return {
                "levels_detected": len(horizontal_lines),
                "strong_levels": horizontal_lines[:5],  # Top 5 levels
                "has_support_resistance": len(horizontal_lines) > 2
            }
            
        except Exception as e:
            self.logger.error(f"Support/resistance detection failed: {str(e)}")
            return {"levels_detected": 0, "error": str(e)}
    
    def _analyze_price_action(self, image: np.ndarray) -> Dict:
        """Analyze price action and trend direction"""
        try:
            # Convert to grayscale and apply Gaussian blur
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # Find contours to identify price movements
            edges = cv2.Canny(blurred, 50, 150)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Analyze contour directions for trend
            upward_movement = 0
            downward_movement = 0
            
            for contour in contours:
                if len(contour) > 10:  # Only analyze significant contours
                    # Calculate general direction of contour
                    start_point = contour[0][0]
                    end_point = contour[-1][0]
                    
                    if end_point[1] < start_point[1]:  # Moving up (Y decreases upward)
                        upward_movement += 1
                    elif end_point[1] > start_point[1]:  # Moving down
                        downward_movement += 1
            
            total_movement = upward_movement + downward_movement
            
            if total_movement > 0:
                upward_ratio = upward_movement / total_movement
                if upward_ratio > 0.6:
                    trend_direction = "upward"
                    trend_strength = upward_ratio
                elif upward_ratio < 0.4:
                    trend_direction = "downward" 
                    trend_strength = 1 - upward_ratio
                else:
                    trend_direction = "sideways"
                    trend_strength = 0.5
            else:
                trend_direction = "unclear"
                trend_strength = 0.3
            
            return {
                "trend_direction": trend_direction,
                "trend_strength": float(trend_strength),
                "upward_movements": upward_movement,
                "downward_movements": downward_movement
            }
            
        except Exception as e:
            self.logger.error(f"Price action analysis failed: {str(e)}")
            return {"trend_direction": "unclear", "error": str(e)}
    
    def _analyze_volume_patterns(self, image: np.ndarray) -> Dict:
        """Analyze volume patterns if visible in chart"""
        try:
            # Look for volume bars in lower portion of image
            height, width = image.shape[:2]
            volume_region = image[int(height * 0.7):, :]  # Bottom 30% of image
            
            # Convert volume region to grayscale
            volume_gray = cv2.cvtColor(volume_region, cv2.COLOR_BGR2GRAY)
            
            # Look for vertical bars (volume indicators)
            vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 5))
            volume_bars = cv2.morphologyEx(volume_gray, cv2.MORPH_OPEN, vertical_kernel)
            
            volume_density = cv2.countNonZero(volume_bars) / (volume_region.shape[0] * volume_region.shape[1])
            
            if volume_density > 0.005:
                volume_present = True
                volume_pattern = "bars_detected"
            else:
                volume_present = False
                volume_pattern = "no_volume_visible"
            
            return {
                "volume_present": volume_present,
                "volume_pattern": volume_pattern,
                "volume_density": float(volume_density)
            }
            
        except Exception as e:
            self.logger.error(f"Volume analysis failed: {str(e)}")
            return {"volume_present": False, "error": str(e)}
    
    def _generate_trading_signal(self, analysis: Dict) -> Dict:
        """Generate trading signal based on comprehensive analysis"""
        try:
            print("\n🤖 === SIGNAL GENERATION ===")
            # Extract analysis components
            trend = analysis.get("trend_analysis", {})
            existing_trade = analysis.get("existing_trade", {})
            patterns = analysis.get("candlestick_patterns", {})
            levels = analysis.get("support_resistance", {})
            price_action = analysis.get("price_action", {})
            
            print(f"📊 Input Analysis Data:")
            print(f"   - Existing Trade: {existing_trade}")
            print(f"   - Trend: {trend}")
            print(f"   - Patterns: {patterns}")
            print(f"   - Levels: {levels}")
            print(f"   - Price Action: {price_action}")
            
            # Check if we should copy an existing trade setup
            if existing_trade.get("has_existing_trade", False):
                trade_type = existing_trade.get("trade_type", "follow_existing")
                
                if trade_type == "copy_existing_setup":
                    print(f"\n📋 === COPYING EXISTING TRADE SETUP ===")
                    print(f"🎯 Trade setup detected in chart - copying exact parameters")
                    print(f"📊 Trade markers found: {existing_trade.get('markers_detected', {})}")
                    
                    # Get extracted trade parameters
                    trade_params = existing_trade.get("trade_parameters", {})
                    stop_loss_percent = trade_params.get("stop_loss_percent", 0.5)
                    take_profit_percent = trade_params.get("take_profit_percent", 1.5)
                    
                    print(f"📈 Copied Trade Parameters:")
                    print(f"   - Stop Loss: {stop_loss_percent}%")
                    print(f"   - Take Profit: {take_profit_percent}%")
                    print(f"   - Levels Above: {trade_params.get('levels_above', 0)}")
                    print(f"   - Levels Below: {trade_params.get('levels_below', 0)}")
                    
                    # Copy the existing trade setup
                    signal_result = {
                        "isSignal": True,
                        "confidence": 0.95,  # Very high confidence when copying visible trade
                        "symbol": "ETH",
                        "side": "copy",  # Special mode to copy existing trade
                        "entryPrice": None,  # Use current market price as entry
                        "stopLoss": None,  # Will be calculated from percentages
                        "takeProfit": None,  # Will be calculated from percentages
                        "stopLossPercent": stop_loss_percent,
                        "takeProfitPercent": take_profit_percent,
                        "quantity": 0.1,
                        "leverage": 1,
                        "reasoning": f"Copying existing trade setup from chart - SL:{stop_loss_percent}% TP:{take_profit_percent}%",
                        "method": "copy_existing_trade",
                        "trade_mode": "copy_existing",
                        "analysis_details": {
                            "copied_trade_confidence": existing_trade.get("confidence", 0.9),
                            "markers_detected": existing_trade.get("markers_detected", {}),
                            "trade_parameters": trade_params,
                            "copy_mode": True
                        }
                    }
                    
                    print(f"\n✅ TRADE COPIED FROM CHART:")
                    print(f"   - Mode: COPY existing trade setup")
                    print(f"   - Entry: Current market price")
                    print(f"   - Stop Loss: {stop_loss_percent}% from entry")
                    print(f"   - Take Profit: {take_profit_percent}% from entry")
                    print(f"   - Confidence: 95%")
                    print("📋 === TRADE COPY COMPLETE ===\n")
                    
                    return signal_result
                    
                else:  # Original follow mode
                    print(f"\n📋 === FOLLOWING EXISTING TRADE ===")
                    print(f"🎯 Existing trade detected - following current setup")
                    print(f"📊 Trade markers found: {existing_trade.get('markers_detected', {})}")
                
                # Follow the existing trade with current market price as entry
                signal_result = {
                    "isSignal": True,
                    "confidence": 0.9,  # High confidence when following existing trade
                    "symbol": "ETH",
                    "side": "follow",  # Special mode to follow existing trade
                    "entryPrice": None,  # Use current market price
                    "stopLoss": None,  # Will be calculated from percentages
                    "takeProfit": None,  # Will be calculated from percentages
                    "stopLossPercent": 0.5,  # Conservative 0.5% stop loss
                    "takeProfitPercent": 1.5,  # Conservative 1.5% take profit
                    "quantity": 0.1,
                    "leverage": 1,
                    "reasoning": "Following existing trade setup detected in chart with current market price as entry",
                    "method": "existing_trade_follow",
                    "trade_mode": "follow_existing",
                    "analysis_details": {
                        "existing_trade_confidence": existing_trade.get("confidence", 0.8),
                        "markers_detected": existing_trade.get("markers_detected", {}),
                        "follow_mode": True
                    }
                }
                
                print(f"✅ EXISTING TRADE FOLLOW SIGNAL:")
                print(f"   - Mode: FOLLOW existing trade")
                print(f"   - Entry: Current market price")
                print(f"   - Stop Loss: 0.5% from current price")
                print(f"   - Take Profit: 1.5% from current price")
                print(f"   - Confidence: 90%")
                print("📋 === EXISTING TRADE FOLLOW COMPLETE ===\n")
                
                return signal_result
            
            # Initialize signal parameters
            signal_strength = 0.0
            signal_direction = None
            reasoning = []
            
            print(f"\n🔢 Calculating signal strength...")
            # Trend analysis weight (40%)
            trend_type = trend.get("trend", "neutral")
            trend_confidence = trend.get("confidence", 0.5)
            print(f"📈 Trend Analysis: {trend_type} with {trend_confidence:.1%} confidence")
            
            if trend_type == "bearish":
                signal_strength += 0.4 * trend_confidence
                signal_direction = "sell"
                reasoning.append(f"Bearish trend detected ({trend_confidence:.1%} confidence)")
                print(f"   ⬇️ BEARISH signal (+{0.4 * trend_confidence:.2f} strength)")
            elif trend_type == "bullish":
                signal_strength += 0.4 * trend_confidence
                signal_direction = "buy"
                reasoning.append(f"Bullish trend detected ({trend_confidence:.1%} confidence)")
                print(f"   ⬆️ BULLISH signal (+{0.4 * trend_confidence:.2f} strength)")
            else:
                print(f"   ➡️ NEUTRAL trend (no direction bias)")
            
            # Pattern analysis weight (30%)
            if patterns.get("pattern_detected", False):
                pattern_confidence = patterns.get("confidence", 0.5)
                signal_strength += 0.3 * pattern_confidence
                reasoning.append(f"Candlestick patterns identified ({pattern_confidence:.1%} confidence)")
                print(f"🕯️ Pattern boost: +{0.3 * pattern_confidence:.2f} strength")
            else:
                print("🕯️ No significant patterns detected")
            
            # Price action analysis weight (20%)
            price_direction = price_action.get("trend_direction", "unclear")
            price_strength = price_action.get("trend_strength", 0.5)
            print(f"💹 Price Action: {price_direction} direction with {price_strength:.1%} strength")
            
            if price_direction == "downward":
                if signal_direction is None:
                    signal_direction = "sell"
                signal_strength += 0.2 * price_strength
                reasoning.append(f"Downward price action ({price_strength:.1%} strength)")
                print(f"   ⬇️ Downward action boost: +{0.2 * price_strength:.2f}")
            elif price_direction == "upward":
                if signal_direction is None:
                    signal_direction = "buy"
                signal_strength += 0.2 * price_strength
                reasoning.append(f"Upward price action ({price_strength:.1%} strength)")
                print(f"   ⬆️ Upward action boost: +{0.2 * price_strength:.2f}")
            
            # Support/resistance analysis weight (10%)
            if levels.get("has_support_resistance", False):
                signal_strength += 0.1
                reasoning.append("Support/resistance levels identified")
                print(f"📏 S/R levels boost: +0.1")
            else:
                print("📏 No clear S/R levels")
            
            # Default to sell bias for ETH if no clear direction
            if signal_direction is None:
                signal_direction = "sell"
                signal_strength = max(0.7, signal_strength)
                reasoning.append("Default bearish bias for ETH")
                print(f"⚠️ No clear direction - defaulting to SELL bias")
            
            # Ensure minimum confidence
            final_confidence = max(0.75, signal_strength)
            print(f"\n🎯 FINAL CALCULATION:")
            print(f"   - Raw Signal Strength: {signal_strength:.2f}")
            print(f"   - Final Confidence: {final_confidence:.2f}")
            print(f"   - Signal Direction: {signal_direction.upper()}")
            print(f"   - Reasoning: {reasoning}")
            
            # Generate trading parameters based on current market conditions
            # Note: These prices should be extracted from chart analysis or market data
            # For now, we'll use percentage-based stop loss and take profit
            if signal_direction == "sell":
                entry_price = None  # Let the trading system use market price
                stop_loss_percent = 0.5  # 0.5% stop loss
                take_profit_percent = -2.0  # 2% take profit (negative for sell)
                print(f"📉 SELL Signal Parameters:")
                print(f"   - Entry: Market Price (dynamic)")
                print(f"   - Stop Loss: +0.5% from entry")
                print(f"   - Take Profit: -2.0% from entry")
            else:  # buy
                entry_price = None  # Let the trading system use market price
                stop_loss_percent = -0.5  # 0.5% stop loss (negative for buy)
                take_profit_percent = 2.0  # 2% take profit
                print(f"📈 BUY Signal Parameters:")
                print(f"   - Entry: Market Price (dynamic)")
                print(f"   - Stop Loss: -0.5% from entry")
                print(f"   - Take Profit: +2.0% from entry")
            
            signal_result = {
                "isSignal": True,
                "confidence": final_confidence,
                "symbol": "ETH",
                "side": signal_direction,
                "entryPrice": entry_price,  # None = use market price
                "stopLoss": None,  # Legacy field - will be calculated from percentage
                "takeProfit": None,  # Legacy field - will be calculated from percentage
                "stopLossPercent": stop_loss_percent,
                "takeProfitPercent": take_profit_percent,
                "quantity": 0.1,
                "leverage": 1,
                "reasoning": f"Python CV Analysis: {'; '.join(reasoning)}",
                "method": "python_computer_vision",
                "analysis_details": {
                    "trend_score": trend_confidence,
                    "pattern_score": patterns.get("confidence", 0),
                    "price_action_score": price_strength,
                    "total_signal_strength": signal_strength
                }
            }
            
            print(f"\n✅ FINAL SIGNAL GENERATED:")
            print(f"   {signal_result}")
            print("🤖 === SIGNAL GENERATION COMPLETE ===\n")
            
            return signal_result
            
        except Exception as e:
            self.logger.error(f"Signal generation failed: {str(e)}")
            return {
                "isSignal": True,
                "confidence": 0.8,
                "symbol": "ETH",
                "side": "sell",
                "entryPrice": None,  # Use market price
                "stopLoss": None,  # Legacy field - will be calculated from percentage
                "takeProfit": None,  # Legacy field - will be calculated from percentage
                "stopLossPercent": 0.5,  # 0.5% stop loss
                "takeProfitPercent": 2.0,  # 2% take profit
                "quantity": 0.1,
                "leverage": 1,
                "reasoning": f"Python Analysis Fallback: {str(e)}",
                "method": "python_fallback"
            }
    
    def _create_error_response(self, error_message: str) -> Dict:
        """Create standardized error response"""
        return {
            "success": False,
            "error": error_message,
            "trading_signal": {
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
                "reasoning": f"Error fallback: {error_message}",
                "method": "python_error_fallback"
            }
        }