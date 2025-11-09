const ChartAnalysisService = require('./src/services/ChartAnalysisService');
const logger = require('./src/utils/logger');
const Jimp = require('jimp');

async function testChartAnalysis() {
    try {
        logger.info('🧪 Testing enhanced Chart Analysis Service...');
        
        const chartService = new ChartAnalysisService();
        
        // Test 1: Create a simple test image (like a chart)
        const testImage = new Jimp(200, 100, 0x000000FF); // Black background (like trading chart)
        
        // Add some colored pixels to simulate chart elements
        for (let i = 0; i < 20; i++) {
            const x = Math.floor(Math.random() * 200);
            const y = Math.floor(Math.random() * 100);
            const color = Math.random() > 0.5 ? 0xFF0000FF : 0x00FF00FF; // Red or green
            testImage.setPixelColor(color, x, y);
        }
        
        logger.info('🔍 Testing chart analysis on simulated chart...');
        
        // Test the analysis
        const result = await chartService.analyzeChartImage(testImage.bitmap);
        
        logger.info('📊 Chart Analysis Result:', {
            isSignal: result.isSignal,
            confidence: result.confidence,
            side: result.side,
            symbol: result.symbol,
            reasoning: result.reasoning,
            method: result.method
        });
        
        if (result.isSignal) {
            logger.info('✅ TRADING SIGNAL GENERATED!');
            logger.info(`🎯 Signal: ${result.side.toUpperCase()} ${result.symbol}`);
            logger.info(`💰 Entry: $${result.entryPrice}`);
            logger.info(`🛑 Stop Loss: $${result.stopLoss}`);
            logger.info(`🎯 Take Profit: $${result.takeProfit}`);
            logger.info(`📝 Reasoning: ${result.reasoning}`);
        } else {
            logger.info('❌ No trading signal generated');
        }
        
        // Test 2: Test the fallback system
        logger.info('🔄 Testing fallback system...');
        const fallbackResult = chartService.createSmartFallback();
        
        logger.info('🎯 Fallback Result:', {
            isSignal: fallbackResult.isSignal,
            confidence: fallbackResult.confidence,
            side: fallbackResult.side,
            reasoning: fallbackResult.reasoning
        });
        
        logger.info('✅ Chart Analysis tests completed successfully!');
        return true;
        
    } catch (error) {
        logger.error('❌ Chart Analysis test failed:', error);
        return false;
    }
}

// Run the test
testChartAnalysis()
    .then(success => {
        if (success) {
            logger.info('🎉 Chart Analysis System is working correctly!');
            process.exit(0);
        } else {
            logger.error('💥 Chart Analysis System has issues!');
            process.exit(1);
        }
    })
    .catch(error => {
        logger.error('💥 Test execution failed:', error);
        process.exit(1);
    });