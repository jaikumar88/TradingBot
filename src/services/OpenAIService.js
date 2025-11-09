const OpenAI = require('openai');
const logger = require('../utils/logger');

class OpenAIService {
    constructor(config) {
        this.config = config.openai;
        // Check if we have a real OpenAI API key (starts with sk- and is long enough)
        const hasRealApiKey = this.config.apiKey && 
                             this.config.apiKey.startsWith('sk-') && 
                             this.config.apiKey.length > 20 &&
                             !this.config.apiKey.includes('test_');
        
        this.isTestMode = !hasRealApiKey;
        
        if (this.isTestMode) {
            logger.info('🧪 OpenAI service running in TEST MODE');
            logger.warn('💡 Add a valid OPENAI_API_KEY to .env file for real AI analysis');
            this.client = null;
        } else {
            logger.info('🧠 OpenAI service connecting with real API...');
            this.client = new OpenAI({
                apiKey: this.config.apiKey
            });
        }
        
        this.systemPrompt = this.buildSystemPrompt();
    }

    buildSystemPrompt() {
        return `You are an expert cryptocurrency trading analyst. Your task is to analyze Telegram messages and extract trading signals with precise entry points, stop losses, and take profit levels.

IMPORTANT RULES:
1. Only respond with valid JSON format
2. If no clear trading signal is found, return {"isSignal": false}
3. Always include risk management (stop loss and take profit)
4. Use conservative estimates if exact values aren't provided
5. Supported symbols: BTC, ETH, ADA, SOL, DOT, LINK, UNI, AAVE (add more as needed)

Response format for valid signals:
{
    "isSignal": true,
    "confidence": 0.85,
    "symbol": "BTCUSDT",
    "side": "buy",
    "entryPrice": 45000,
    "stopLoss": 43500,
    "takeProfit": 48000,
    "quantity": 0.1,
    "leverage": 1,
    "reasoning": "Strong bullish signal with clear resistance break...",
    "riskReward": 1.67,
    "timeframe": "4h"
}

Guidelines for extraction:
- Entry price: Look for "buy at", "entry", "current price", or market indicators
- Stop loss: Look for "sl", "stop loss", "invalidation level", support levels
- Take profit: Look for "tp", "target", "resistance", "sell at"
- If stop loss not mentioned, use 3-5% below entry for long, above for short
- If take profit not mentioned, use 2:1 risk/reward ratio
- Confidence based on clarity and completeness of signal
- Quantity should be reasonable (0.01-1.0 for BTC, adjust for other coins)`;
    }

    async analyzeMessage(messageData) {
        try {
            logger.info(`Analyzing message from ${messageData.chatTitle}: "${messageData.text.substring(0, 100)}..."`);

            // Check if we should use test mode
            if (this.isTestMode || process.env.USE_TEST_AI === 'true') {
                return this.getMockAnalysis(messageData);
            }

            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [
                    { role: 'system', content: this.systemPrompt },
                    { 
                        role: 'user', 
                        content: `Analyze this message for trading signals:

Message: "${messageData.text}"
Source: ${messageData.chatTitle} (${messageData.chatType})
Time: ${messageData.date.toISOString()}

Extract trading signal if present.` 
                    }
                ],
                max_tokens: this.config.maxTokens,
                temperature: 0.3 // Lower temperature for more consistent analysis
            });

            const content = response.choices[0].message.content.trim();
            logger.debug('OpenAI response:', content);

            // Try to parse JSON response
            let analysis;
            try {
                analysis = JSON.parse(content);
            } catch (parseError) {
                logger.warn('Failed to parse OpenAI response as JSON:', content);
                return {
                    isSignal: false,
                    error: 'Invalid response format from AI',
                    rawResponse: content
                };
            }

            // Validate the analysis
            if (analysis.isSignal) {
                const validation = this.validateSignal(analysis);
                if (!validation.isValid) {
                    logger.warn('Invalid signal detected:', validation.errors);
                    return {
                        isSignal: false,
                        error: `Invalid signal: ${validation.errors.join(', ')}`,
                        rawAnalysis: analysis
                    };
                }
            }

            // Add metadata
            analysis.analyzedAt = new Date();
            analysis.sourceMessage = {
                id: messageData.id,
                chatId: messageData.chatId,
                chatTitle: messageData.chatTitle,
                text: messageData.text
            };

            logger.info(`Analysis complete. Signal detected: ${analysis.isSignal}`);
            if (analysis.isSignal) {
                logger.info(`Signal: ${analysis.side} ${analysis.symbol} at ${analysis.entryPrice}`);
            }

            return analysis;

        } catch (error) {
            logger.error('Error analyzing message with OpenAI:', error);
            return {
                isSignal: false,
                error: error.message,
                analyzedAt: new Date()
            };
        }
    }

    validateSignal(signal) {
        const errors = [];

        // Required fields
        const required = ['symbol', 'side', 'entryPrice', 'stopLoss', 'takeProfit', 'quantity'];
        required.forEach(field => {
            if (!signal[field]) {
                errors.push(`Missing ${field}`);
            }
        });

        // Validate side
        if (signal.side && !['buy', 'sell'].includes(signal.side.toLowerCase())) {
            errors.push('Side must be "buy" or "sell"');
        }

        // Validate prices
        if (signal.entryPrice && signal.entryPrice <= 0) {
            errors.push('Entry price must be positive');
        }

        if (signal.stopLoss && signal.stopLoss <= 0) {
            errors.push('Stop loss must be positive');
        }

        if (signal.takeProfit && signal.takeProfit <= 0) {
            errors.push('Take profit must be positive');
        }

        // Validate price logic for buy orders
        if (signal.side === 'buy' && signal.entryPrice && signal.stopLoss && signal.takeProfit) {
            if (signal.stopLoss >= signal.entryPrice) {
                errors.push('Stop loss should be below entry price for buy orders');
            }
            if (signal.takeProfit <= signal.entryPrice) {
                errors.push('Take profit should be above entry price for buy orders');
            }
        }

        // Validate price logic for sell orders
        if (signal.side === 'sell' && signal.entryPrice && signal.stopLoss && signal.takeProfit) {
            if (signal.stopLoss <= signal.entryPrice) {
                errors.push('Stop loss should be above entry price for sell orders');
            }
            if (signal.takeProfit >= signal.entryPrice) {
                errors.push('Take profit should be below entry price for sell orders');
            }
        }

        // Validate quantity
        if (signal.quantity && signal.quantity <= 0) {
            errors.push('Quantity must be positive');
        }

        // Validate confidence
        if (signal.confidence && (signal.confidence < 0 || signal.confidence > 1)) {
            errors.push('Confidence must be between 0 and 1');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    async generateTradeReasoning(trade, marketData = null) {
        try {
            const prompt = `Provide a brief analysis for this trade:

Symbol: ${trade.symbol}
Side: ${trade.side}
Entry: $${trade.entryPrice}
Stop Loss: $${trade.stopLoss}
Take Profit: $${trade.takeProfit}
Risk/Reward: ${this.calculateRiskReward(trade)}

${marketData ? `Market Data: ${JSON.stringify(marketData)}` : ''}

Provide a 2-3 sentence technical analysis explaining the trade setup.`;

            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                max_tokens: 200,
                temperature: 0.7
            });

            return response.choices[0].message.content.trim();
        } catch (error) {
            logger.error('Error generating trade reasoning:', error);
            return 'Analysis generated from automated signal detection.';
        }
    }

    calculateRiskReward(trade) {
        const risk = Math.abs(trade.entryPrice - trade.stopLoss);
        const reward = Math.abs(trade.takeProfit - trade.entryPrice);
        return reward / risk;
    }

    getMockAnalysis(messageData) {
        logger.info('🧪 Generating mock AI analysis for testing');
        
        const text = messageData.text.toLowerCase();
        
        // Check for trading keywords
        const isTradingMessage = text.includes('buy') || text.includes('sell') || 
                                text.includes('long') || text.includes('short') ||
                                text.includes('entry') || text.includes('btc') ||
                                text.includes('eth') || text.includes('target') ||
                                text.includes('stop');
        
        if (!isTradingMessage) {
            return {
                isSignal: false,
                confidence: 0.1,
                reasoning: 'No trading keywords detected in test mode',
                analyzedAt: new Date(),
                sourceMessage: {
                    id: messageData.id,
                    chatId: messageData.chatId,
                    chatTitle: messageData.chatTitle,
                    text: messageData.text
                }
            };
        }

        // Extract basic trading info for mock analysis
        let symbol = 'BTCUSDT'; // Default
        let side = 'buy';
        let entryPrice = 45000;
        let stopLoss = 43000;
        let takeProfit = 48000;

        // Simple keyword detection - check specific symbols first (order matters!)
        const lowerText = text.toLowerCase();
        if (lowerText.includes('btc') || lowerText.includes('bitcoin')) {
            symbol = 'BTCUSDT';
        } else if (lowerText.includes('eth') || lowerText.includes('ethereum')) {
            symbol = 'ETHUSDT';
        } else if (lowerText.includes('ada') || lowerText.includes('cardano')) {
            symbol = 'ADAUSDT';
        } else if (lowerText.includes('sol') || lowerText.includes('solana')) {
            symbol = 'SOLUSDT';
        }
        
        if (text.includes('sell') || text.includes('short')) {
            side = 'sell';
            // For sell orders: entry < takeProfit < stopLoss
            entryPrice = 3000;
            takeProfit = 2700; // Lower than entry (profit on sell)
            stopLoss = 3300;   // Higher than entry (stop loss on sell)
        } else {
            side = 'buy';
            // For buy orders: stopLoss < entry < takeProfit
            entryPrice = 45000;
            stopLoss = 43000;   // Lower than entry
            takeProfit = 48000; // Higher than entry
        }
        
        // Try to extract numbers from message
        const numbers = text.match(/\d+(?:\.\d+)?/g);
        if (numbers && numbers.length >= 3 && side === 'buy') {
            entryPrice = parseFloat(numbers[0]);
            stopLoss = parseFloat(numbers[1]);
            takeProfit = parseFloat(numbers[2]);
        }

        return {
            isSignal: true,
            confidence: 0.85,
            symbol: symbol,
            side: side,
            entryPrice: entryPrice,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            quantity: symbol.includes('BTC') ? 0.1 : symbol.includes('ETH') ? 1 : 10,
            leverage: 1,
            reasoning: `Mock analysis detected ${side} signal for ${symbol} in test mode`,
            riskReward: Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss),
            timeframe: '4h',
            analyzedAt: new Date(),
            sourceMessage: {
                id: messageData.id,
                chatId: messageData.chatId,
                chatTitle: messageData.chatTitle,
                text: messageData.text
            }
        };
    }
}

module.exports = OpenAIService;