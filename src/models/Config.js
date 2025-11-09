// Configuration model for application settings
class Config {
    constructor() {
        this.telegram = {
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            allowedChats: process.env.TELEGRAM_ALLOWED_CHATS ? 
                process.env.TELEGRAM_ALLOWED_CHATS.split(',') : [],
            webhookUrl: process.env.TELEGRAM_WEBHOOK_URL
        };

        this.openai = {
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000
        };

        this.ollama = {
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL || 'gemma3:1b',
            visionModel: process.env.OLLAMA_VISION_MODEL || 'llava:7b',
            visionEnabled: process.env.OLLAMA_VISION_ENABLED === 'true',
            maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS) || 1000,
            timeout: parseInt(process.env.OLLAMA_TIMEOUT) || 30000
        };

        this.ai = {
            provider: process.env.AI_PROVIDER || 'ollama', // 'openai', 'ollama', or 'test'
            useTestMode: process.env.USE_TEST_AI === 'true'
        };

        this.deltaExchange = {
            apiKey: process.env.DELTA_API_KEY,
            apiSecret: process.env.DELTA_API_SECRET,
            baseUrl: process.env.DELTA_BASE_URL || 'https://api.delta.exchange',
            testnet: process.env.DELTA_TESTNET === 'true',
            paperTrade: process.env.PAPER_TRADE !== 'false' // Default to paper trading unless explicitly set to 'false'
        };

        this.trading = {
            defaultRiskPercentage: parseFloat(process.env.DEFAULT_RISK_PERCENTAGE) || 2,
            maxPositions: parseInt(process.env.MAX_POSITIONS) || 5,
            defaultLeverage: parseInt(process.env.DEFAULT_LEVERAGE) || 1
        };

        this.database = {
            path: process.env.DB_PATH || './data/trading.db'
        };

        this.server = {
            port: parseInt(process.env.PORT) || 3000,
            host: process.env.HOST || 'localhost'
        };

        this.logging = {
            level: process.env.LOG_LEVEL || 'info',
            file: process.env.LOG_FILE || './data/app.log'
        };
    }

    validate() {
        // In development mode, allow test configuration
        if (process.env.NODE_ENV === 'development') {
            console.log('⚠️  Running in development mode - API validation relaxed');
            console.log('📋 To use real APIs, configure these in your .env file:');
            console.log('   - TELEGRAM_BOT_TOKEN (from @BotFather)');
            console.log('   - OPENAI_API_KEY (from platform.openai.com)');
            console.log('   - Set NODE_ENV=production when ready for live use');
            return true;
        }

        const required = [
            { key: 'telegram.botToken', value: this.telegram.botToken },
            { key: 'openai.apiKey', value: this.openai.apiKey }
        ];

        if (!this.deltaExchange.paperTrade) {
            required.push(
                { key: 'deltaExchange.apiKey', value: this.deltaExchange.apiKey },
                { key: 'deltaExchange.apiSecret', value: this.deltaExchange.apiSecret }
            );
        }

        const missing = required.filter(item => !item.value || item.value.includes('your_') || item.value.includes('test_'));
        
        if (missing.length > 0) {
            throw new Error(`Missing required configuration: ${missing.map(m => m.key).join(', ')}`);
        }

        return true;
    }
}

module.exports = Config;