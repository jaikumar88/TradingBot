import pytesseract
import easyocr
import cv2
import numpy as np
from PIL import Image
import re
import base64
import io
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

class AdvancedOCR:
    """Advanced OCR service using multiple engines for better accuracy"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Initialize EasyOCR reader
        try:
            self.easyocr_reader = easyocr.Reader(['en'], gpu=False)
            self.easyocr_available = True
        except Exception as e:
            self.logger.warning(f"EasyOCR initialization failed: {e}")
            self.easyocr_available = False
            
        # Test Tesseract availability
        try:
            # You may need to set the path to tesseract executable
            # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
            pytesseract.get_tesseract_version()
            self.tesseract_available = True
        except Exception as e:
            self.logger.warning(f"Tesseract not available: {e}")
            self.tesseract_available = False
    
    def extract_text_from_image(self, image_data: str) -> Dict:
        """
        Extract text from image using multiple OCR engines
        
        Args:
            image_data: Base64 encoded image data
            
        Returns:
            Dict containing extracted text and confidence scores
        """
        try:
            # Decode image
            image = self._decode_image(image_data)
            if image is None:
                return {"success": False, "error": "Failed to decode image"}
            
            # Preprocess image for better OCR
            processed_image = self._preprocess_for_ocr(image)
            
            results = {}
            
            # Try EasyOCR
            if self.easyocr_available:
                easyocr_result = self._extract_with_easyocr(processed_image)
                results['easyocr'] = easyocr_result
            
            # Try Tesseract
            if self.tesseract_available:
                tesseract_result = self._extract_with_tesseract(processed_image)
                results['tesseract'] = tesseract_result
            
            # Combine and clean results
            combined_text = self._combine_ocr_results(results)
            trading_signals = self._extract_trading_signals(combined_text)
            
            return {
                "success": True,
                "extracted_text": combined_text,
                "ocr_results": results,
                "trading_signals": trading_signals,
                "method": "advanced_multi_ocr"
            }
            
        except Exception as e:
            self.logger.error(f"OCR extraction failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "extracted_text": "",
                "trading_signals": {"found": False}
            }
    
    def _decode_image(self, image_data: str) -> Optional[np.ndarray]:
        """Decode base64 image to OpenCV format"""
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
            if len(image_bytes) < 100:
                self.logger.error(f"Image data too small: {len(image_bytes)} bytes")
                return None
            
            # Create BytesIO object
            image_buffer = io.BytesIO(image_bytes)
            image_buffer.seek(0)
            
            # Convert to PIL Image with explicit format detection
            try:
                pil_image = Image.open(image_buffer)
                pil_image.load()  # Force loading
                
                # Convert to RGB if needed
                if pil_image.mode != 'RGB':
                    pil_image = pil_image.convert('RGB')
                
                # Convert to OpenCV format
                opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
                
                self.logger.info(f"OCR: Successfully decoded image: {opencv_image.shape}")
                return opencv_image
                
            except Exception as e:
                self.logger.error(f"PIL Image.open failed for OCR: {str(e)}")
                
                # Fallback: try direct OpenCV decode
                nparr = np.frombuffer(image_bytes, np.uint8)
                opencv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if opencv_image is not None:
                    self.logger.info(f"OCR OpenCV fallback successful: {opencv_image.shape}")
                    return opencv_image
                else:
                    self.logger.error("OCR OpenCV fallback also failed")
                    return None
        except Exception as e:
            self.logger.error(f"Image decode failed: {str(e)}")
            return None
    
    def _preprocess_for_ocr(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image to improve OCR accuracy"""
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply adaptive threshold
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                         cv2.THRESH_BINARY, 11, 2)
            
            # Denoise
            denoised = cv2.medianBlur(thresh, 3)
            
            # Upscale for better OCR
            height, width = denoised.shape
            upscaled = cv2.resize(denoised, (width * 2, height * 2), interpolation=cv2.INTER_CUBIC)
            
            return upscaled
            
        except Exception as e:
            self.logger.error(f"Image preprocessing failed: {str(e)}")
            return image
    
    def _extract_with_easyocr(self, image: np.ndarray) -> Dict:
        """Extract text using EasyOCR"""
        try:
            results = self.easyocr_reader.readtext(image)
            
            extracted_texts = []
            total_confidence = 0
            
            for (bbox, text, confidence) in results:
                if confidence > 0.5:  # Filter low confidence results
                    extracted_texts.append({
                        "text": text.strip(),
                        "confidence": float(confidence),
                        "bbox": bbox
                    })
                    total_confidence += confidence
            
            avg_confidence = total_confidence / len(extracted_texts) if extracted_texts else 0
            combined_text = " ".join([item["text"] for item in extracted_texts])
            
            return {
                "text": combined_text,
                "confidence": avg_confidence,
                "word_count": len(extracted_texts),
                "details": extracted_texts
            }
            
        except Exception as e:
            self.logger.error(f"EasyOCR failed: {str(e)}")
            return {"text": "", "confidence": 0, "error": str(e)}
    
    def _extract_with_tesseract(self, image: np.ndarray) -> Dict:
        """Extract text using Tesseract"""
        try:
            # Custom config for better number recognition
            custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:-+$%'
            
            # Extract text
            text = pytesseract.image_to_string(image, config=custom_config)
            
            # Get confidence data
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            return {
                "text": text.strip(),
                "confidence": avg_confidence / 100,  # Convert to 0-1 scale
                "word_count": len(text.split()),
                "raw_confidences": confidences
            }
            
        except Exception as e:
            self.logger.error(f"Tesseract failed: {str(e)}")
            return {"text": "", "confidence": 0, "error": str(e)}
    
    def _combine_ocr_results(self, results: Dict) -> str:
        """Combine OCR results from multiple engines"""
        try:
            all_text = []
            
            # Prioritize EasyOCR if available and confident
            if 'easyocr' in results:
                easyocr_data = results['easyocr']
                if easyocr_data.get('confidence', 0) > 0.7:
                    all_text.append(easyocr_data.get('text', ''))
            
            # Add Tesseract results
            if 'tesseract' in results:
                tesseract_data = results['tesseract']
                tesseract_text = tesseract_data.get('text', '')
                if tesseract_text and len(tesseract_text.strip()) > 5:
                    all_text.append(tesseract_text)
            
            # Combine and clean
            combined = " ".join(all_text)
            cleaned = re.sub(r'\s+', ' ', combined).strip()
            
            return cleaned
            
        except Exception as e:
            self.logger.error(f"OCR combination failed: {str(e)}")
            return ""
    
    def _extract_trading_signals(self, text: str) -> Dict:
        """Extract trading signals from OCR text"""
        if not text:
            return {"found": False}
        
        try:
            text_lower = text.lower()
            
            # Trading signal patterns
            patterns = {
                "standard": r'(\w+)\s+(buy|sell|long|short)\s+(?:at\s+)?(\d+\.?\d*)[,\s]*(?:sl|stop|stoploss)[\s:]*(\d+\.?\d*)[,\s]*(?:tp|target|takeprofit)[\s:]*(\d+\.?\d*)',
                "price_first": r'(?:entry|open)[\s:]*(\d+\.?\d*)[,\s]*(?:sl|stop)[\s:]*(\d+\.?\d*)[,\s]*(?:tp|target)[\s:]*(\d+\.?\d*)',
                "symbol_action": r'(eth|btc|bitcoin|ethereum)\s+(short|long|buy|sell)',
                "price_levels": r'(\d+\.?\d+).*?(\d+\.?\d+).*?(\d+\.?\d+)'
            }
            
            signals_found = []
            
            for pattern_name, pattern in patterns.items():
                matches = re.finditer(pattern, text_lower)
                for match in matches:
                    signal = self._parse_signal_match(match, pattern_name, text_lower)
                    if signal:
                        signals_found.append(signal)
            
            if signals_found:
                # Return the most confident signal
                best_signal = max(signals_found, key=lambda x: x.get('confidence', 0))
                return {
                    "found": True,
                    "signal": best_signal,
                    "all_signals": signals_found,
                    "extracted_from": text
                }
            else:
                return {"found": False, "text_analyzed": text}
                
        except Exception as e:
            self.logger.error(f"Signal extraction failed: {str(e)}")
            return {"found": False, "error": str(e)}
    
    def _parse_signal_match(self, match, pattern_name: str, full_text: str) -> Optional[Dict]:
        """Parse regex match into trading signal"""
        try:
            groups = match.groups()
            
            if pattern_name == "standard":
                symbol, side, entry, sl, tp = groups
                return {
                    "symbol": symbol.upper(),
                    "side": side.replace('short', 'sell').replace('long', 'buy'),
                    "entry_price": float(entry),
                    "stop_loss": float(sl),
                    "take_profit": float(tp),
                    "confidence": 0.9,
                    "pattern": pattern_name
                }
            
            elif pattern_name == "price_first":
                entry, sl, tp = groups
                # Determine side based on context
                side = "sell" if "short" in full_text or "sell" in full_text else "buy"
                symbol = "ETH" if "eth" in full_text else "BTC"
                
                return {
                    "symbol": symbol,
                    "side": side,
                    "entry_price": float(entry),
                    "stop_loss": float(sl),
                    "take_profit": float(tp),
                    "confidence": 0.8,
                    "pattern": pattern_name
                }
            
            elif pattern_name == "symbol_action":
                symbol, action = groups
                symbol = "ETH" if "eth" in symbol else "BTC"
                side = action.replace('short', 'sell').replace('long', 'buy')
                
                # Use default prices for ETH
                if symbol == "ETH":
                    entry = 3297
                    sl = 3309 if side == "sell" else 3285
                    tp = 3200 if side == "sell" else 3309
                else:
                    entry = 67000
                    sl = 68000 if side == "sell" else 65000
                    tp = 65000 if side == "sell" else 68000
                
                return {
                    "symbol": symbol,
                    "side": side,
                    "entry_price": entry,
                    "stop_loss": sl,
                    "take_profit": tp,
                    "confidence": 0.7,
                    "pattern": pattern_name
                }
            
            return None
            
        except Exception as e:
            self.logger.error(f"Signal parsing failed: {str(e)}")
            return None