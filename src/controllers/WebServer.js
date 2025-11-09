const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const logger = require('../utils/logger');

class WebServer {
    constructor(config, databaseService, deltaService, tradeManager, aiService) {
        this.config = config;
        this.db = databaseService;
        this.deltaService = deltaService;
        this.tradeManager = tradeManager;
        this.aiService = aiService;
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet());
        this.app.use(cors());
        
        // Body parsing middleware
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Static files
        this.app.use(express.static(path.join(__dirname, '../../public')));
        
        // Logging middleware
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path} - ${req.ip}`);
            next();
        });
    }

    setupRoutes() {
        // API Routes
        this.app.get('/api/trades', this.getTrades.bind(this));
        this.app.get('/api/trades/:id', this.getTrade.bind(this));
        this.app.post('/api/trades/:id/close', this.closeTrade.bind(this));
        this.app.get('/api/stats', this.getStats.bind(this));
        this.app.get('/api/balance', this.getBalance.bind(this));
        this.app.get('/api/positions', this.getPositions.bind(this));
        this.app.get('/api/orders', this.getOrders.bind(this));
        this.app.get('/api/health', this.getHealth.bind(this));
        this.app.get('/api/config', this.getConfig.bind(this));
        this.app.post('/api/config', this.updateConfig.bind(this));
        this.app.get('/api/ai/status', this.getAIStatus.bind(this));
        this.app.post('/api/ai/provider', this.switchAIProvider.bind(this));
        
        // Dashboard route
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../../public/index.html'));
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Route not found' });
        });

        // Error handler
        this.app.use((err, req, res, next) => {
            logger.error('Express error:', err);
            res.status(500).json({ 
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
            });
        });
    }

    async getTrades(req, res) {
        try {
            const { limit = 50, offset = 0, status } = req.query;
            
            let trades;
            if (status) {
                trades = await this.db.getTradesByStatus(status);
            } else {
                trades = await this.db.getAllTrades(parseInt(limit), parseInt(offset));
            }

            res.json({
                success: true,
                data: trades,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: trades.length
                }
            });
        } catch (error) {
            logger.error('Error fetching trades:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getTrade(req, res) {
        try {
            const { id } = req.params;
            
            const trade = await this.db.getTrade(parseInt(id));
            if (!trade) {
                return res.status(404).json({
                    success: false,
                    error: 'Trade not found'
                });
            }

            const history = await this.db.getTradeHistory(parseInt(id));

            res.json({
                success: true,
                data: {
                    trade,
                    history
                }
            });
        } catch (error) {
            logger.error('Error fetching trade:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async closeTrade(req, res) {
        try {
            const { id } = req.params;
            const { reason = 'manual' } = req.body;
            
            const closedTrade = await this.tradeManager.closeTrade(parseInt(id), reason);
            
            res.json({
                success: true,
                data: closedTrade,
                message: 'Trade closed successfully'
            });
        } catch (error) {
            logger.error('Error closing trade:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getStats(req, res) {
        try {
            const stats = await this.tradeManager.getTradePerformance();
            
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error fetching stats:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getBalance(req, res) {
        try {
            const balance = await this.deltaService.getBalance();
            
            res.json({
                success: true,
                data: balance
            });
        } catch (error) {
            logger.error('Error fetching balance:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getPositions(req, res) {
        try {
            const positions = await this.deltaService.getPositions();
            
            res.json({
                success: true,
                data: positions
            });
        } catch (error) {
            logger.error('Error fetching positions:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getOrders(req, res) {
        try {
            const orders = await this.deltaService.getOpenOrders();
            
            res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            logger.error('Error fetching orders:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getHealth(req, res) {
        try {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: {
                    database: 'connected',
                    deltaExchange: this.deltaService.paperTrade ? 'paper_trading' : 'live',
                    telegram: 'connected'
                },
                stats: await this.db.getTradingStats()
            };

            res.json({
                success: true,
                data: health
            });
        } catch (error) {
            logger.error('Health check failed:', error);
            res.status(500).json({
                success: false,
                error: 'Service unhealthy'
            });
        }
    }

    async getConfig(req, res) {
        try {
            const config = {
                useTestAI: process.env.USE_TEST_AI === 'true',
                isPaperTrading: process.env.PAPER_TRADING === 'true',
                aiProvider: process.env.AI_PROVIDER || 'ollama'
            };

            res.json({
                success: true,
                data: config
            });
        } catch (error) {
            logger.error('Error getting config:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get configuration'
            });
        }
    }

    async updateConfig(req, res) {
        try {
            const { useTestAI, isPaperTrading, aiProvider } = req.body;

            if (typeof useTestAI !== 'undefined') {
                process.env.USE_TEST_AI = useTestAI ? 'true' : 'false';
                logger.info(`AI mode changed to: ${useTestAI ? 'Test' : 'Live'}`);
            }

            if (typeof isPaperTrading !== 'undefined') {
                process.env.PAPER_TRADING = isPaperTrading ? 'true' : 'false';
                logger.info(`Trading mode changed to: ${isPaperTrading ? 'Paper' : 'Live'}`);
            }

            if (aiProvider && ['openai', 'ollama', 'test'].includes(aiProvider.toLowerCase())) {
                process.env.AI_PROVIDER = aiProvider.toLowerCase();
                logger.info(`AI provider changed to: ${aiProvider}`);
            }

            const config = {
                useTestAI: process.env.USE_TEST_AI === 'true',
                isPaperTrading: process.env.PAPER_TRADING === 'true',
                aiProvider: process.env.AI_PROVIDER || 'ollama'
            };

            res.json({
                success: true,
                data: config,
                message: 'Configuration updated successfully'
            });
        } catch (error) {
            logger.error('Error updating config:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update configuration'
            });
        }
    }

    async getAIStatus(req, res) {
        try {
            const status = await this.aiService.getHealthStatus();
            
            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            logger.error('Error getting AI status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get AI service status'
            });
        }
    }

    async switchAIProvider(req, res) {
        try {
            const { provider } = req.body;
            
            if (!provider) {
                return res.status(400).json({
                    success: false,
                    error: 'Provider is required'
                });
            }

            const result = await this.aiService.switchProvider(provider);
            
            res.json({
                success: true,
                data: result,
                message: `Switched to ${provider} provider`
            });
        } catch (error) {
            logger.error('Error switching AI provider:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    start() {
        const port = this.config.server.port;
        const host = this.config.server.host;

        this.server = this.app.listen(port, host, () => {
            logger.info(`Web server started on http://${host}:${port}`);
            logger.info(`Dashboard available at: http://${host}:${port}`);
        });

        return this.server;
    }

    stop() {
        if (this.server) {
            this.server.close(() => {
                logger.info('Web server stopped');
            });
        }
    }
}

module.exports = WebServer;