const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const logger = require('../utils/logger');

class OCRService {
    constructor() {
        this.initialized = false;
        this.worker = null;
        this.initializeWorker();
    }

    async initializeWorker() {
        try {
            logger.info('🔍 Initializing OCR worker for image text extraction...');
            
            this.worker = await Tesseract.createWorker('eng', 1, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
                errorHandler: (err) => {
                    logger.warn('OCR worker error:', err.message);
                }
            });

            // Optimize for trading chart text recognition
            await this.worker.setParameters({
                tessedit_char_whitelist: '0123456789.,ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz:/-@',
                tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                preserve_interword_spaces: '1'
            });

            this.initialized = true;
            logger.info('✅ OCR worker initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize OCR worker:', error.message);
            this.initialized = false;
            
            // Set fallback mode
            logger.info('💡 OCR disabled - using pattern-only mode for reliability');
        }
    }

    async extractTextFromImage(imageBuffer) {
        try {
            if (!this.initialized) {
                logger.warn('OCR worker not initialized, attempting to reinitialize...');
                await this.initializeWorker();
                if (!this.initialized) {
                    throw new Error('OCR worker initialization failed');
                }
            }

            logger.info('🔍 Starting OCR text extraction from trading chart...');
            const startTime = Date.now();

            // Validate and preprocess image for better OCR accuracy
            let processedImage;
            try {
                processedImage = await this.preprocessImage(imageBuffer);
            } catch (preprocessError) {
                logger.warn('Image preprocessing failed, trying original image:', preprocessError.message);
                processedImage = imageBuffer;
            }

            // Additional validation - check if buffer is valid
            if (!processedImage || processedImage.length === 0) {
                throw new Error('Invalid image buffer provided');
            }

            // Perform OCR with timeout protection
            let ocrResult;
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('OCR timeout')), 15000);
                });
                
                const ocrPromise = this.worker.recognize(processedImage);
                ocrResult = await Promise.race([ocrPromise, timeoutPromise]);
                
            } catch (ocrError) {
                logger.error('OCR recognition failed:', ocrError.message);
                throw new Error(`OCR processing failed: ${ocrError.message}`);
            }
            
            const { data: { text, confidence } } = ocrResult;
            const processingTime = Date.now() - startTime;
            
            logger.info(`📝 OCR completed in ${processingTime}ms (confidence: ${confidence.toFixed(1)}%)`);

            // Clean and structure the extracted text
            const cleanedText = this.cleanExtractedText(text);
            
            return {
                rawText: text,
                cleanedText: cleanedText,
                confidence: confidence,
                processingTime: processingTime
            };

        } catch (error) {
            logger.error('OCR text extraction failed:', error.message);
            return {
                rawText: '',
                cleanedText: '',
                confidence: 0,
                error: error.message,
                fallback: true
            };
        }
    }

    async preprocessImage(imageBuffer) {
        try {
            logger.debug('🖼️ Preprocessing image for better OCR accuracy...');
            
            // First validate the image buffer
            if (!imageBuffer || imageBuffer.length === 0) {
                throw new Error('Empty or invalid image buffer');
            }

            // Try to get image metadata first to validate format
            const metadata = await sharp(imageBuffer).metadata();
            logger.debug(`Image format: ${metadata.format}, size: ${metadata.width}x${metadata.height}`);

            // Enhance image for better text recognition with safer parameters
            const processedImage = await sharp(imageBuffer)
                .resize({ 
                    width: Math.min(1920, metadata.width * 2), 
                    height: Math.min(1080, metadata.height * 2), 
                    fit: 'inside',
                    withoutEnlargement: false
                })
                .sharpen({ sigma: 1, m1: 0.5, m2: 2 }) // Gentle sharpening
                .modulate({ 
                    brightness: 1.05,  // Slight brightness boost
                    contrast: 1.2      // Moderate contrast increase
                })
                .greyscale() // Convert to grayscale for better OCR
                .png({ quality: 95 }) // High quality PNG
                .toBuffer();

            logger.debug(`✅ Image processed successfully, size: ${processedImage.length} bytes`);
            return processedImage;
            
        } catch (error) {
            logger.warn(`Image preprocessing failed: ${error.message}`);
            
            // If preprocessing fails, try a minimal conversion
            try {
                logger.debug('Attempting minimal image conversion...');
                const minimalProcessed = await sharp(imageBuffer)
                    .png()
                    .toBuffer();
                return minimalProcessed;
            } catch (minimalError) {
                logger.error('Minimal conversion also failed:', minimalError.message);
                throw new Error(`All image processing methods failed: ${error.message}`);
            }
        }
    }

    cleanExtractedText(rawText) {
        if (!rawText) return '';
        
        // Clean up OCR text for trading signal detection
        let cleanedText = rawText
            .replace(/[^\w\s\d.,:-]/g, ' ') // Remove special characters except trading-relevant ones
            .replace(/\s+/g, ' ')          // Normalize whitespace
            .trim()
            .toUpperCase();

        // Fix common OCR mistakes in trading context
        const fixes = {
            'ENIRY': 'ENTRY',
            'ENIAY': 'ENTRY', 
            'ENTAY': 'ENTRY',
            'EMTRY': 'ENTRY',
            'SL': 'SL',
            'TP': 'TP',
            'SHORI': 'SHORT',
            'SHOAT': 'SHORT',
            'SHOBT': 'SHORT',
            'LOAG': 'LONG',
            'LOMG': 'LONG',
            'BUV': 'BUY',
            'BUIY': 'BUY',
            'SEIL': 'SELL',
            'SEUL': 'SELL'
        };

        for (const [wrong, correct] of Object.entries(fixes)) {
            cleanedText = cleanedText.replace(new RegExp(wrong, 'g'), correct);
        }

        return cleanedText;
    }

    // Enhanced trading signal extraction from OCR text
    extractTradingSignals(ocrResult) {
        const text = ocrResult.cleanedText || ocrResult.rawText || '';
        
        logger.info(`🎯 Analyzing OCR text for trading signals: "${text}"`);
        
        // Trading signal patterns optimized for OCR text
        const patterns = [
            // Standard format with OCR variations
            {
                name: 'standard_ocr',
                regex: /(\w+)[\s:]*?(BUY|SELL|LONG|SHORT)[\s:]*?(?:AT|@)?\s*(\d+\.?\d*)[,\s]*(?:SL|STOP)[\s:]*(\d+\.?\d*)[,\s]*(?:TP|TARGET|TAKE)[\s:]*(\d+\.?\d*)/i,
                extract: (m) => ({ symbol: m[1], side: m[2], entry: m[3], sl: m[4], tp: m[5] })
            },
            
            // Price levels in sequence
            {
                name: 'price_sequence',
                regex: /(?:ENTRY|OPEN)[\s:]*(\d+\.?\d*)[,\s]*(?:SL|STOP)[\s:]*(\d+\.?\d*)[,\s]*(?:TP|TARGET)[\s:]*(\d+\.?\d*)/i,
                extract: (m) => ({ symbol: 'ETH', side: 'SELL', entry: m[1], sl: m[2], tp: m[3] })
            },
            
            // Just numbers in trading context
            {
                name: 'number_sequence',
                regex: /(\d{3,5})[,\s]+(\d{3,5})[,\s]+(\d{3,5})/,
                extract: (m) => ({ symbol: 'ETH', side: 'SELL', entry: m[1], sl: m[2], tp: m[3] })
            }
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern.regex);
            if (match) {
                const data = pattern.extract(match);
                const entry = parseFloat(data.entry);
                const sl = parseFloat(data.sl);
                const tp = parseFloat(data.tp);
                
                if (entry > 0 && sl > 0 && tp > 0) {
                    const side = data.side.toLowerCase().replace('short', 'sell').replace('long', 'buy');
                    
                    logger.info(`✅ OCR SIGNAL DETECTED: ${side.toUpperCase()} ${data.symbol}`);
                    return {
                        isSignal: true,
                        confidence: Math.min(0.90, ocrResult.confidence / 100), // OCR confidence as signal confidence
                        symbol: data.symbol.toUpperCase(),
                        side: side,
                        entryPrice: entry,
                        stopLoss: sl,
                        takeProfit: tp,
                        quantity: 0.1,
                        leverage: 1,
                        reasoning: `OCR pattern match: ${pattern.name}`,
                        method: 'ocr_extraction',
                        ocrConfidence: ocrResult.confidence,
                        extractedText: text,
                        processingTime: ocrResult.processingTime
                    };
                }
            }
        }

        return {
            isSignal: false,
            confidence: 0.3,
            reasoning: 'OCR text extracted but no trading pattern found',
            extractedText: text,
            ocrConfidence: ocrResult.confidence,
            method: 'ocr_no_match'
        };
    }

    async terminate() {
        if (this.worker) {
            try {
                await this.worker.terminate();
                logger.info('OCR worker terminated');
            } catch (error) {
                logger.error('Error terminating OCR worker:', error.message);
            }
        }
    }
}

module.exports = OCRService;