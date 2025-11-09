const axios = require('axios');
const logger = require('../utils/logger');

class PythonAnalysisService {
    constructor() {
        this.pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000';
        this.timeout = parseInt(process.env.PYTHON_BACKEND_TIMEOUT) || 15000; // 15 seconds
        this.enabled = process.env.ENABLE_PYTHON_BACKEND === 'true';
        
        logger.info(`🐍 Python Analysis Service initialized`);
        logger.info(`🔗 Backend URL: ${this.pythonBackendUrl}`);
        logger.info(`⚡ Timeout: ${this.timeout}ms`);
        logger.info(`📊 Enabled: ${this.enabled}`);
    }

    async analyzeChartImage(imageData, analysisType = 'comprehensive') {
        if (!this.enabled) {
            logger.debug('Python backend disabled, skipping analysis');
            return null;
        }

        try {
            logger.info(`🐍 Sending image to Python backend for ${analysisType} analysis...`);
            const startTime = Date.now();

            const response = await axios.post(
                `${this.pythonBackendUrl}/analyze-chart`,
                {
                    image: imageData,
                    analysis_type: analysisType,
                    timestamp: new Date().toISOString()
                },
                {
                    timeout: this.timeout,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const processingTime = Date.now() - startTime;
            logger.info(`✅ Python analysis completed in ${processingTime}ms`);

            const result = response.data;
            
            if (result.recommended_signal) {
                const signal = result.recommended_signal;
                
                // Handle null entry price (use market price)
                if (!signal.entryPrice || signal.entryPrice === null) {
                    logger.info('🎯 Python Signal: MARKET ORDER');
                    logger.info(`📊 ${signal.side.toUpperCase()} ${signal.symbol} at MARKET PRICE`);
                } else {
                    logger.info(`🎯 Python Signal: ${signal.side.toUpperCase()} ${signal.symbol} at $${signal.entryPrice}`);
                }
                
                logger.info(`📊 Confidence: ${(signal.confidence * 100).toFixed(1)}% | Method: ${signal.method}`);
                logger.info(`📝 Reasoning: ${signal.reasoning}`);
                
                return {
                    success: true,
                    signal: signal,
                    analysis: result,
                    processingTime: processingTime,
                    method: 'python_backend'
                };
            } else {
                logger.warn('Python backend did not provide trading signal');
                return {
                    success: false,
                    error: 'No trading signal generated',
                    analysis: result
                };
            }

        } catch (error) {
            logger.error(`❌ Python backend analysis failed: ${error.message}`);
            
            if (error.code === 'ECONNREFUSED') {
                logger.error('🚨 Python backend is not running! Start it with: python app.py');
            } else if (error.code === 'ECONNABORTED') {
                logger.error('⏱️ Python backend request timed out');
            }
            
            return {
                success: false,
                error: error.message,
                fallback: this.createFallbackSignal()
            };
        }
    }

    async extractTextFromImage(imageData) {
        if (!this.enabled) {
            return null;
        }

        try {
            logger.info('🔍 Sending image to Python OCR service...');
            
            const response = await axios.post(
                `${this.pythonBackendUrl}/extract-text`,
                {
                    image: imageData,
                    timestamp: new Date().toISOString()
                },
                {
                    timeout: this.timeout,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const result = response.data;
            
            if (result.success && result.extracted_text) {
                logger.info(`📝 Python OCR extracted: "${result.extracted_text.substring(0, 100)}..."`);
                
                // Check if OCR found trading signals
                if (result.trading_signals && result.trading_signals.found) {
                    logger.info('🎯 Python OCR found trading signals!');
                }
                
                return result;
            } else {
                logger.warn('Python OCR extraction failed or no text found');
                return result;
            }

        } catch (error) {
            logger.error(`❌ Python OCR failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                extracted_text: ""
            };
        }
    }

    async testConnection() {
        try {
            logger.info('🔗 Testing Python backend connection...');
            
            const response = await axios.get(`${this.pythonBackendUrl}/health`, {
                timeout: 5000
            });
            
            if (response.data && response.data.status === 'healthy') {
                logger.info('✅ Python backend is healthy and responsive');
                return { healthy: true, response: response.data };
            } else {
                logger.warn('⚠️ Python backend responded but not healthy');
                return { healthy: false, response: response.data };
            }
            
        } catch (error) {
            logger.error(`❌ Python backend health check failed: ${error.message}`);
            return { healthy: false, error: error.message };
        }
    }

    async getTestSignal(signalType = 'eth_short') {
        try {
            logger.info(`🧪 Requesting test signal: ${signalType}`);
            
            const response = await axios.post(
                `${this.pythonBackendUrl}/test-signal`,
                {
                    type: signalType,
                    timestamp: new Date().toISOString()
                },
                {
                    timeout: 5000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const result = response.data;
            logger.info(`✅ Test signal received: ${result.test_signal.side} ${result.test_signal.symbol}`);
            
            return {
                success: true,
                signal: result.test_signal,
                method: 'python_test'
            };

        } catch (error) {
            logger.error(`❌ Test signal request failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                fallback: this.createFallbackSignal()
            };
        }
    }

    createFallbackSignal() {
        return {
            isSignal: true,
            confidence: 0.75,
            symbol: 'ETH',
            side: 'sell',
            entryPrice: 3297,
            stopLoss: 3309,
            takeProfit: 3200,
            quantity: 0.1,
            leverage: 1,
            reasoning: 'Python Backend Fallback: Service unavailable, using default ETH SHORT',
            method: 'python_service_fallback'
        };
    }

    isEnabled() {
        return this.enabled;
    }

    getBackendUrl() {
        return this.pythonBackendUrl;
    }
}

module.exports = PythonAnalysisService;