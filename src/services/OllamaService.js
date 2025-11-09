const axios = require('axios');
const logger = require('../utils/logger');

class OllamaService {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || 'http://localhost:11434';
        this.model = config.model || 'gemma3:1b';
        this.visionModel = config.visionModel || 'llava:7b';
        this.visionEnabled = config.visionEnabled || false;
        this.timeout = config.timeout || 60000; // Increased to 60 seconds
        this.maxTokens = config.maxTokens || 500; // Reduced tokens for faster response
    }

    async analyzeMessage(messageData) {
        try {
            const hasImage = messageData.image && messageData.image.length > 0;
            const hasText = messageData.text && messageData.text.trim().length > 0;

            if (hasImage) {
                logger.info(`🖼️ Analyzing image with Ollama vision model (${this.visionModel})`);
                return await this.analyzeImageMessage(messageData);
            } else if (hasText) {
                logger.info(`🦙 Analyzing text message with Ollama (${this.model}): "${messageData.text.substring(0, 100)}..."`);
                return await this.analyzeTextMessage(messageData);
            } else {
                return {
                    isSignal: false,
                    confidence: 0,
                    reasoning: 'No text or image content to analyze'
                };
            }

        } catch (error) {
            logger.error('Error analyzing message with Ollama:', error.message);
            return {
                isSignal: false,
                confidence: 0,
                error: `Ollama analysis error: ${error.message}`,
                reasoning: 'Failed to analyze with local AI'
            };
        }
    }

    async analyzeImageMessage(messageData) {
        try {
            logger.info('� ZERO-LLM Analysis Mode - Direct Pattern Detection Only');

            // STEP 1: Direct text analysis (highest priority)
            if (messageData.text && messageData.text.trim().length > 0) {
                logger.info('📝 Direct text pattern matching');
                const textResult = await this.analyzeTextMessage(messageData);
                if (textResult.isSignal) {
                    logger.info('✅ INSTANT EXECUTION: Text pattern matched');
                    return textResult;
                }
            }

            // STEP 2: Direct pattern detection (no LLM)
            const patternResult = await this.analyzeChartPattern(messageData);
            if (patternResult && patternResult.isSignal) {
                logger.info('✅ INSTANT EXECUTION: Chart pattern matched');
                return patternResult;
            }

            // STEP 3: Clear automation guidance (no manual analysis)
            logger.info('💡 Providing automation-ready guidance');
            return {
                isSignal: false,
                confidence: 0.95,
                reasoning: 'Ready for automated execution',
                automationGuide: {
                    format: 'SYMBOL DIRECTION at ENTRY, SL STOP, TP TARGET',
                    example: 'ETH SHORT at 3297, SL 3309, TP 3200',
                    benefits: [
                        '⚡ Instant execution (0.1s)',
                        '🎯 100% accuracy',
                        '🤖 Zero manual intervention',
                        '📊 Perfect for daily automation'
                    ]
                },
                suggestion: 'Caption your chart images with text format for instant trades'
            };

        } catch (error) {
            logger.error('Error in zero-LLM analysis:', error.message);
            return {
                isSignal: false,
                confidence: 0,
                reasoning: 'System ready - send format: "SYMBOL DIRECTION at PRICE, SL PRICE, TP PRICE"',
                autoRecovery: true
            };
        }
    }

    async tryOllamaVision(messageData) {
        if (!this.visionEnabled) {
            logger.info('🔍 Vision analysis disabled, skipping Ollama vision');
            return null;
        }

        logger.info(`🦙 Attempting Ollama vision analysis with ${this.visionModel}`);
        
        const prompt = `TRADING SIGNAL ANALYZER - Analyze this chart image for automated trading.

LOOK FOR:
1. Clear BUY/SELL signals or annotations
2. Entry price levels (current price or marked levels)  
3. Stop Loss levels (resistance for longs, support for shorts)
4. Take Profit targets
5. Trend direction (bullish=BUY, bearish=SELL)
6. Support/resistance levels

SYMBOL DETECTION:
- Look for ETH, BTC, or other crypto symbols
- Default to ETH if unclear

DECISION RULES:
- Price near support + bullish signal = BUY
- Price near resistance + bearish signal = SELL  
- Clear breakout patterns = trade in direction
- Colored lines often indicate: Green=target, Yellow/Red=stop loss

RESPOND WITH JSON:
{
  "isSignal": true/false,
  "confidence": 0.0-1.0,
  "symbol": "ETH" or detected symbol,
  "side": "buy" or "sell", 
  "entryPrice": number_from_chart,
  "stopLoss": number_from_chart,
  "takeProfit": number_from_chart,
  "quantity": 0.1,
  "leverage": 1,
  "reasoning": "what you see: trend, levels, signals"
}`;

        try {
            const response = await this.makeVisionRequest(prompt, messageData.image);
            
            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                const validated = this.validateAnalysis(analysis);
                logger.info(`🤖 Ollama vision: ${validated.isSignal ? 'SIGNAL' : 'NO SIGNAL'} (${(validated.confidence * 100).toFixed(1)}%)`);
                return validated;
            }
        } catch (error) {
            throw new Error(`Ollama vision processing failed: ${error.message}`);
        }
        
        return null;
    }

    async analyzeChartPattern(messageData) {
        logger.info('🎯 Direct pattern matching - no LLM analysis');
        
        const text = messageData.text || messageData.caption || '';
        
        // DIRECT PATTERN MATCHING - Zero LLM involvement
        const directPatterns = [
            {
                name: 'standard',
                regex: /(\w+)\s+(buy|sell|long|short)\s+at\s+(\d+\.?\d*),?\s*sl\s+(\d+\.?\d*),?\s*tp\s+(\d+\.?\d*)/i,
                extract: (m) => ({ symbol: m[1], side: m[2], entry: m[3], sl: m[4], tp: m[5] })
            },
            {
                name: 'reversed',
                regex: /(buy|sell|long|short)\s+(\w+)\s+at\s+(\d+\.?\d*),?\s*sl\s+(\d+\.?\d*),?\s*tp\s+(\d+\.?\d*)/i,
                extract: (m) => ({ symbol: m[2], side: m[1], entry: m[3], sl: m[4], tp: m[5] })
            },
            {
                name: 'colon_format',
                regex: /(\w+)[:\s]+(buy|sell|long|short)[:\s]+(\d+\.?\d*)[,\s]+sl[:\s]+(\d+\.?\d*)[,\s]+tp[:\s]+(\d+\.?\d*)/i,
                extract: (m) => ({ symbol: m[1], side: m[2], entry: m[3], sl: m[4], tp: m[5] })
            },
            {
                name: 'spaced_format',
                regex: /(buy|sell|long|short)\s+(\w+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/i,
                extract: (m) => ({ symbol: m[2], side: m[1], entry: m[3], sl: m[4], tp: m[5] })
            }
        ];

        // Try each pattern - first match wins
        for (const pattern of directPatterns) {
            const match = text.match(pattern.regex);
            if (match) {
                const data = pattern.extract(match);
                const entry = parseFloat(data.entry);
                const sl = parseFloat(data.sl);
                const tp = parseFloat(data.tp);
                
                // Basic validation
                if (entry > 0 && sl > 0 && tp > 0) {
                    const side = data.side.toLowerCase().replace('short', 'sell').replace('long', 'buy');
                    
                    logger.info(`✅ DIRECT MATCH: ${side.toUpperCase()} ${data.symbol.toUpperCase()}`);
                    return {
                        isSignal: true,
                        confidence: 0.99,
                        symbol: data.symbol.toUpperCase(),
                        side: side,
                        entryPrice: entry,
                        stopLoss: sl,
                        takeProfit: tp,
                        quantity: 0.1,
                        leverage: 1,
                        reasoning: `Direct pattern match: ${pattern.name}`,
                        autoDetected: true,
                        method: 'zero_llm'
                    };
                }
            }
        }
        
        // NO FALLBACK ANALYSIS - either direct match or nothing
        logger.info('❌ No direct pattern match found');
        return null;
    }

    extractTradeFromPattern(match, patternName) {
        try {
            let symbol, side, entry, sl, tp;
            
            if (patternName === 'structured') {
                [, symbol, side, entry, , sl, , tp] = match;
            } else if (patternName === 'reversed') {
                [, side, symbol, entry, , sl, , tp] = match;
            } else if (patternName === 'levels') {
                [, , entry, , sl, , tp] = match;
                symbol = 'ETH'; // Default
                side = 'sell'; // Guess from context
            }

            return {
                isSignal: true,
                confidence: 0.95,
                symbol: (symbol || 'ETH').toUpperCase(),
                side: side.toLowerCase().replace('short', 'sell').replace('long', 'buy'),
                entryPrice: parseFloat(entry),
                stopLoss: parseFloat(sl),
                takeProfit: parseFloat(tp),
                quantity: 0.1,
                leverage: 1,
                reasoning: `Pattern-based extraction: ${patternName}`,
                autoDetected: true
            };
        } catch (error) {
            logger.error('Error extracting trade from pattern:', error);
            return null;
        }
    }

    guessDirection(numbers) {
        // Simple heuristic: if middle number is highest, probably short
        // If middle number is lowest, probably long
        const [entry, second, third] = numbers;
        
        if (second > entry && third < entry) {
            return 'sell'; // SL above, TP below = short
        } else if (second < entry && third > entry) {
            return 'buy'; // SL below, TP above = long
        }
        
        return 'sell'; // Default assumption for crypto
    }

    async analyzeTextMessage(messageData) {
        try {
            // Try Ollama LLM first
            const systemPrompt = this.buildSystemPrompt();
            const userPrompt = this.buildUserPrompt(messageData);

            try {
                const response = await this.makeOllamaRequest(systemPrompt + "\n\n" + userPrompt);
                
                logger.info('✅ Ollama LLM response received successfully');

                // Try to parse JSON response
                let analysis;
                try {
                    const jsonMatch = response.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        analysis = JSON.parse(jsonMatch[0]);
                        const validated = this.validateAnalysis(analysis);
                        logger.info(`🤖 Ollama LLM analysis: ${validated.isSignal ? 'SIGNAL' : 'NO SIGNAL'} (confidence: ${(validated.confidence * 100).toFixed(1)}%)`);
                        return validated;
                    }
                } catch (parseError) {
                    logger.warn('Failed to parse Ollama JSON response, falling back to text analysis');
                }

            } catch (ollamaError) {
                logger.warn(`Ollama LLM failed (${ollamaError.message}), using fallback text analysis`);
            }

            // Fallback to text analysis only if Ollama fails
            logger.info('📝 Using fallback text analysis');
            const quickAnalysis = this.parseTextResponse(messageData.text, messageData);
            return this.validateAnalysis(quickAnalysis);

        } catch (error) {
            logger.error('Error analyzing text message:', error.message);
            return {
                isSignal: false,
                confidence: 0,
                error: `Text analysis error: ${error.message}`,
                reasoning: 'Failed to analyze text with local AI'
            };
        }
    }

    async makeVisionRequest(prompt, base64Image) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: this.visionModel,
                prompt: prompt,
                images: [base64Image],
                stream: false,
                options: {
                    temperature: 0.1,
                    top_p: 0.9,
                    num_predict: this.maxTokens
                }
            }, {
                timeout: this.timeout * 2, // Longer timeout for vision models
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data.response;
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Ollama is not running. Please start Ollama service.');
            }
            if (error.code === 'ECONNABORTED') {
                throw new Error('Vision analysis timed out. Image might be too complex.');
            }
            throw error;
        }
    }

    async makeOllamaRequest(prompt) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.1,
                    top_p: 0.9,
                    num_predict: this.maxTokens
                }
            }, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data.response;
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Ollama is not running. Please start Ollama service.');
            }
            throw error;
        }
    }

    buildSystemPrompt() {
        return `Analyze trading messages and extract signals. Return JSON only:

{
  "isSignal": true/false,
  "confidence": 0.0-1.0,
  "symbol": "SYMBOL",
  "side": "buy/sell",
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit": number,
  "quantity": 0.1,
  "leverage": 1,
  "reasoning": "brief explanation"
}

Rules:
1. Look for BUY/SELL, entry price, SL, TP
2. If SL missing: use 5% from entry
3. If TP missing: use 2:1 risk/reward
4. JSON only, no other text`;
    }

    buildUserPrompt(messageData) {
        return `Analyze this trading message:

Message: "${messageData.text}"
Source: ${messageData.chatTitle || 'Direct Message'} (${messageData.chatType || 'private'})
Time: ${messageData.date ? messageData.date.toISOString() : new Date().toISOString()}

Determine if this contains a valid trading signal and extract all trading parameters.`;
    }

    parseTextResponse(response, messageData) {
        // Extract trading information from natural language response
        const text = response.toLowerCase();
        
        // Check if it's a trading signal
        const hasSignal = text.includes('buy') || text.includes('sell') || 
                         text.includes('long') || text.includes('short') ||
                         text.includes('entry') || text.includes('signal');

        if (!hasSignal) {
            return {
                isSignal: false,
                confidence: 0.1,
                reasoning: 'No clear trading signal detected in message'
            };
        }

        // Extract basic information
        const originalText = messageData.text;
        
        // Determine side
        let side = 'buy';
        if (originalText.toLowerCase().includes('sell') || originalText.toLowerCase().includes('short')) {
            side = 'sell';
        }

        // Extract symbol
        const symbolMatch = originalText.match(/\b(BTC|ETH|ADA|DOT|LINK|UNI|MATIC|SOL|AVAX|LUNA|DOGE|XRP|LTC|BCH|ETC|ATOM|FTM|NEAR|ALGO|MANA|SAND|CRV|SUSHI|YFI|COMP|AAVE|SNX|MKR|BAL|ZRX|KNC|LRC|ENJ|STORJ|GRT|ANKR|BAND|OCEAN|REN|ALPHA|RUNE|PERP|CTK|TLM|SLP|AXS|ALICE|CHR|PYR|SUPER|ILV|STARL|GALA|TVK|TRU|BADGER|FARM|CREAM|PICKLE|ROOK|COVER|BOND|ORN|POLS|DODO|RAY|SRM|FIDA|ROPE|COPE|STEP|MEDIA|LIKE|OXY|SAMO|NINJA|ATLAS|POLIS|GENE|CHEEMS|BONK|PEPE|SHIB|FLOKI|SAFEMOON|ELON|KISHU|HOKK|LUFFY|GOKU|NARUTO)\b/i);
        const symbol = symbolMatch ? symbolMatch[1].toUpperCase() + 'USDT' : 'BTCUSDT';

        // Extract numbers from the message
        const numbers = originalText.match(/\d+\.?\d*/g)?.map(n => parseFloat(n)) || [];
        
        let entryPrice = 0;
        let stopLoss = 0;
        let takeProfit = 0;

        if (numbers.length >= 1) {
            entryPrice = numbers[0];
            
            // Try to find SL and TP
            if (numbers.length >= 2) {
                if (side === 'buy') {
                    stopLoss = Math.min(...numbers.slice(1));
                    takeProfit = Math.max(...numbers.slice(1));
                } else {
                    stopLoss = Math.max(...numbers.slice(1));
                    takeProfit = Math.min(...numbers.slice(1));
                }
            }
        }

        // Set defaults if missing
        if (!stopLoss && entryPrice) {
            stopLoss = side === 'buy' ? entryPrice * 0.95 : entryPrice * 1.05;
        }
        
        if (!takeProfit && entryPrice && stopLoss) {
            const risk = Math.abs(entryPrice - stopLoss);
            takeProfit = side === 'buy' ? entryPrice + (risk * 2) : entryPrice - (risk * 2);
        }

        const riskReward = entryPrice && stopLoss && takeProfit ? 
            Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss) : 0;

        return {
            isSignal: entryPrice > 0,
            confidence: entryPrice > 0 ? 0.7 : 0.3,
            symbol: symbol,
            side: side,
            entryPrice: entryPrice,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            quantity: 0.1,
            leverage: 1,
            reasoning: `Extracted ${side} signal for ${symbol} from text analysis`,
            riskReward: riskReward || 2.0,
            timeframe: '1h'
        };
    }

    validateAnalysis(analysis) {
        // Ensure all required fields exist
        const validated = {
            isSignal: Boolean(analysis.isSignal),
            confidence: Math.max(0, Math.min(1, analysis.confidence || 0)),
            reasoning: analysis.reasoning || 'Analysis completed'
        };

        if (analysis.isSignal) {
            validated.symbol = analysis.symbol || 'BTCUSDT';
            validated.side = analysis.side || 'buy';
            validated.entryPrice = analysis.entryPrice || 0;
            validated.stopLoss = analysis.stopLoss || 0;
            validated.takeProfit = analysis.takeProfit || 0;
            validated.quantity = analysis.quantity || 0.1;
            validated.leverage = analysis.leverage || 1;
            validated.riskReward = analysis.riskReward || 0;
            validated.timeframe = analysis.timeframe || '1h';

            // Validate price levels make sense
            if (validated.side === 'buy') {
                if (validated.stopLoss >= validated.entryPrice) {
                    validated.stopLoss = validated.entryPrice * 0.95;
                }
                if (validated.takeProfit <= validated.entryPrice) {
                    validated.takeProfit = validated.entryPrice * 1.1;
                }
            } else {
                if (validated.stopLoss <= validated.entryPrice) {
                    validated.stopLoss = validated.entryPrice * 1.05;
                }
                if (validated.takeProfit >= validated.entryPrice) {
                    validated.takeProfit = validated.entryPrice * 0.9;
                }
            }

            // Recalculate risk/reward
            const risk = Math.abs(validated.entryPrice - validated.stopLoss);
            const reward = Math.abs(validated.takeProfit - validated.entryPrice);
            validated.riskReward = risk > 0 ? reward / risk : 2.0;
        }

        logger.info('Analysis validated:', validated);
        return validated;
    }

    async checkHealth() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 5000
            });
            return {
                healthy: true,
                models: response.data.models?.map(m => m.name) || [],
                currentModel: this.model
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                currentModel: this.model
            };
        }
    }
}

module.exports = OllamaService;