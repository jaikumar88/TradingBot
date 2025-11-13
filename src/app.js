require('dotenv').config();

const Config = require('./models/Config');
const TelegramService = require('./services/TelegramService');
const AIService = require('./services/AIService');
const DeltaExchangeService = require('./services/DeltaExchangeService');
const DatabaseService = require('./services/DatabaseService');
const TradeManager = require('./services/TradeManager');
const WebServer = require('./controllers/WebServer');
const logger = require('./utils/logger');

class TradingBot {
    constructor() {
        this.config = null;
        this.telegramService = null;
        this.aiService = null;
        this.deltaService = null;
        this.databaseService = null;
        this.tradeManager = null;
        this.webServer = null;
        this.isShuttingDown = false;
    }

    async initialize() {
        try {
            logger.info('🚀 Initializing Trading Bot...');

            // Load and validate configuration
            this.config = new Config();
            this.config.validate();
            logger.info('✅ Configuration loaded and validated');

            // Initialize database
            this.databaseService = new DatabaseService(this.config.database.path);
            await this.databaseService.init();
            logger.info('✅ Database initialized');

            // Initialize Delta Exchange service with database for products caching
            this.deltaService = new DeltaExchangeService(this.config, this.databaseService);
            logger.info('✅ Delta Exchange service initialized');

            // Initialize AI service
            this.aiService = new AIService(this.config);
            logger.info('✅ AI service initialized');

            // Initialize Trade Manager
            this.tradeManager = new TradeManager(
                this.deltaService,
                this.databaseService,
                null // Will be set after Telegram service is created
            );
            
            // Set AI service in Trade Manager
            this.tradeManager.aiService = this.aiService;
            logger.info('✅ Trade Manager initialized');

            // Initialize Telegram service
            this.telegramService = new TelegramService(
                this.config,
                this.handleTelegramMessage.bind(this)
            );
            
            // Set Telegram service in Trade Manager
            this.tradeManager.telegram = this.telegramService;
            logger.info('✅ Telegram service initialized');

            // Initialize Web Server
            this.webServer = new WebServer(
                this.config,
                this.databaseService,
                this.deltaService,
                this.tradeManager,
                this.aiService
            );
            this.webServer.start();
            logger.info('✅ Web server initialized');

            // Setup graceful shutdown
            this.setupGracefulShutdown();

            logger.info('🎉 Trading Bot successfully initialized!');
            logger.info(`📊 Dashboard: http://${this.config.server.host}:${this.config.server.port}`);
            logger.info(`📈 Paper Trading: ${this.config.deltaExchange.paperTrade ? 'ENABLED' : 'DISABLED'}`);

        } catch (error) {
            logger.error('❌ Failed to initialize Trading Bot:', error);
            process.exit(1);
        }
    }

    async handleTelegramMessage(messageData) {
        try {
            logger.info(`📨 Processing message from ${messageData.chatTitle}: "${messageData.text.substring(0, 50)}..."`);

            // Analyze message with AI service
            const aiAnalysis = await this.aiService.analyzeMessage(messageData);
            
            // Save message to database
            await this.databaseService.saveMessage(messageData, aiAnalysis);

            // If it's a trading signal, process it
            if (aiAnalysis.isSignal && aiAnalysis.confidence > 0.5) {
                logger.info(`🎯 Trading signal detected with ${(aiAnalysis.confidence * 100).toFixed(1)}% confidence`);
                
                try {
                    const trade = await this.tradeManager.processTradeSignal(aiAnalysis, messageData);
                    
                    if (trade) {
                        logger.info(`✅ Trade created: ${trade.side} ${trade.quantity} ${trade.symbol} at $${trade.entryPrice}`);
                    }
                } catch (tradeError) {
                    logger.error('❌ Error processing trade signal:', tradeError);
                }
            } else {
                logger.debug(`ℹ️ Message analyzed but no valid signal found (confidence: ${(aiAnalysis.confidence * 100).toFixed(1)}%)`);
            }

        } catch (error) {
            logger.error('❌ Error handling Telegram message:', error);
        }
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;

            logger.info(`⚠️ Received ${signal}. Gracefully shutting down...`);

            try {
                // Stop trade monitoring
                if (this.tradeManager) {
                    this.tradeManager.stopTradeMonitoring();
                    logger.info('✅ Trade monitoring stopped');
                }

                // Stop web server
                if (this.webServer) {
                    this.webServer.stop();
                    logger.info('✅ Web server stopped');
                }

                // Close database connection
                if (this.databaseService) {
                    this.databaseService.close();
                    logger.info('✅ Database connection closed');
                }

                logger.info('✅ Graceful shutdown completed');
                process.exit(0);

            } catch (error) {
                logger.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('uncaughtException', (error) => {
            logger.error('❌ Uncaught Exception:', error);
            shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }

    async getStatus() {
        try {
            const stats = await this.tradeManager.getTradePerformance();
            const activeTrades = await this.databaseService.getActiveTrades();

            return {
                status: 'running',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                config: {
                    paperTrading: this.config.deltaExchange.paperTrade,
                    testnet: this.config.deltaExchange.testnet
                },
                stats,
                activeTrades: activeTrades.length,
                services: {
                    telegram: 'connected',
                    openai: 'connected',
                    database: 'connected',
                    deltaExchange: this.config.deltaExchange.paperTrade ? 'paper_trading' : 'connected',
                    webServer: 'running'
                }
            };
        } catch (error) {
            logger.error('Error getting status:', error);
            return {
                status: 'error',
                error: error.message
            };
        }
    }
}

// Create and start the bot
const bot = new TradingBot();

// Handle startup
(async () => {
    try {
        await bot.initialize();
    } catch (error) {
        logger.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
})();

// Export for testing
module.exports = TradingBot;