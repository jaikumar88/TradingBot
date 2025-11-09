const logger = require('../utils/logger');

class AutoTradeService {
    constructor() {
        this.tradingPatterns = new Map();
        this.signalHistory = [];
    }

    // Analyze image metadata and patterns for consistent signal formats
    analyzeSignalPattern(messageData, analysisResult) {
        try {
            const pattern = {
                timestamp: new Date(),
                chatId: messageData.chatId,
                hasImage: !!messageData.image,
                hasText: !!(messageData.text && messageData.text.trim().length > 0),
                textLength: messageData.text ? messageData.text.length : 0,
                isSignal: analysisResult.isSignal,
                confidence: analysisResult.confidence,
                symbol: analysisResult.symbol,
                side: analysisResult.side
            };

            this.signalHistory.push(pattern);
            
            // Keep only last 100 signals for pattern learning
            if (this.signalHistory.length > 100) {
                this.signalHistory.shift();
            }

            logger.info(`📊 Signal pattern recorded: ${pattern.isSignal ? 'SIGNAL' : 'NO SIGNAL'} (confidence: ${(pattern.confidence * 100).toFixed(1)}%)`);

        } catch (error) {
            logger.error('Error recording signal pattern:', error);
        }
    }

    // Get suggestions for improving automation based on patterns
    getAutomationSuggestions() {
        const recentSignals = this.signalHistory.slice(-20);
        const successfulSignals = recentSignals.filter(s => s.isSignal && s.confidence > 0.7);
        const failedAnalysis = recentSignals.filter(s => !s.isSignal && s.hasImage);

        const suggestions = [];

        if (failedAnalysis.length > successfulSignals.length) {
            suggestions.push({
                type: 'format_improvement',
                message: 'Consider including text descriptions with chart images for better signal detection',
                example: 'ETH SHORT at 3297, SL 3309, TP 3200'
            });
        }

        if (successfulSignals.length > 0) {
            const avgConfidence = successfulSignals.reduce((sum, s) => sum + s.confidence, 0) / successfulSignals.length;
            
            if (avgConfidence < 0.8) {
                suggestions.push({
                    type: 'clarity_improvement',
                    message: 'Add more specific price levels in your signals for higher confidence analysis',
                    example: 'Include exact entry, stop loss, and take profit prices'
                });
            }
        }

        return suggestions;
    }

    // Enhanced signal processing for automation
    enhanceSignalForAutomation(messageData, baseAnalysis) {
        try {
            // Add automation-specific enhancements
            const enhanced = { ...baseAnalysis };

            // Auto-adjust for common patterns
            if (enhanced.isSignal) {
                // Validate price levels make sense
                if (enhanced.side === 'sell' || enhanced.side === 'short') {
                    // For shorts: SL should be above entry, TP below entry
                    if (enhanced.stopLoss < enhanced.entryPrice) {
                        logger.warn('⚠️ Adjusting short trade: SL should be above entry');
                        const temp = enhanced.stopLoss;
                        enhanced.stopLoss = enhanced.takeProfit;
                        enhanced.takeProfit = temp;
                    }
                } else if (enhanced.side === 'buy' || enhanced.side === 'long') {
                    // For longs: SL should be below entry, TP above entry  
                    if (enhanced.stopLoss > enhanced.entryPrice) {
                        logger.warn('⚠️ Adjusting long trade: SL should be below entry');
                        const temp = enhanced.stopLoss;
                        enhanced.stopLoss = enhanced.takeProfit;
                        enhanced.takeProfit = temp;
                    }
                }

                // Calculate risk/reward ratio
                const risk = Math.abs(enhanced.entryPrice - enhanced.stopLoss);
                const reward = Math.abs(enhanced.takeProfit - enhanced.entryPrice);
                enhanced.riskReward = risk > 0 ? (reward / risk) : 0;

                logger.info(`🎯 Auto-enhanced signal: ${enhanced.symbol} ${enhanced.side.toUpperCase()} R/R: ${enhanced.riskReward.toFixed(2)}`);
            }

            return enhanced;

        } catch (error) {
            logger.error('Error enhancing signal for automation:', error);
            return baseAnalysis;
        }
    }

    // Provide daily automation status
    getDailyAutomationStatus() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaySignals = this.signalHistory.filter(s => s.timestamp >= today);
        const successfulToday = todaySignals.filter(s => s.isSignal);

        return {
            date: today.toDateString(),
            totalSignals: todaySignals.length,
            successfulSignals: successfulToday.length,
            automationRate: todaySignals.length > 0 ? (successfulToday.length / todaySignals.length * 100) : 0,
            suggestions: this.getAutomationSuggestions()
        };
    }
}

module.exports = AutoTradeService;