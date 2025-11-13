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
        // Security middleware with CSP configured for dashboard functionality
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrcAttr: ["'unsafe-inline'"],  // This allows inline event handlers
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"]
                }
            }
        }));
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
        this.app.delete('/api/trades/:id', this.deleteTrade.bind(this));
        this.app.post('/api/trades', this.createManualTrade.bind(this));
        this.app.put('/api/trades/:id', this.updateTrade.bind(this));
        this.app.get('/api/symbols', this.getAvailableSymbols.bind(this));
        this.app.get('/api/ticker/:symbol', this.getTicker.bind(this));
        this.app.get('/api/quick-price/:symbol', this.getQuickTradePrice.bind(this));
        this.app.get('/api/stats', this.getStats.bind(this));
        this.app.get('/api/balance', this.getBalance.bind(this));
        this.app.get('/api/positions', this.getPositions.bind(this));
        this.app.get('/api/exchange-positions', this.getExchangePositions.bind(this));
        this.app.get('/api/orders', this.getOrders.bind(this));
        this.app.get('/api/health', this.getHealth.bind(this));
        this.app.get('/api/config', this.getConfig.bind(this));
        this.app.post('/api/config', this.updateConfig.bind(this));
        this.app.get('/api/ai/status', this.getAIStatus.bind(this));
        this.app.post('/api/ai/provider', this.switchAIProvider.bind(this));
        
        // Risk Management Routes
        this.app.get('/api/risk-settings', this.getRiskSettings.bind(this));
        this.app.post('/api/risk-settings', this.saveRiskSettings.bind(this));
        this.app.delete('/api/risk-settings/:symbol', this.deleteSymbolRiskSettings.bind(this));
        
        // Quick Trade Routes
        this.app.post('/api/quick-trade', this.executeQuickTrade.bind(this));
        this.app.post('/api/close-position', this.closePositionQuick.bind(this));
        this.app.post('/api/reverse-trade', this.reversePosition.bind(this));
        
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
            const { limit = 50, offset = 0, status, platform } = req.query;
            
            let trades;
            if (status) {
                trades = await this.db.getTradesByStatus(status);
            } else {
                trades = await this.db.getAllTrades(parseInt(limit), parseInt(offset));
            }

            // Filter by platform if specified
            const currentPlatform = platform || process.env.TRADING_PLATFORM || 'delta-india';
            if (currentPlatform !== 'all') {
                trades = trades.filter(trade => {
                    // If trade doesn't have a platform field, assume it's from the default platform
                    const tradePlatform = trade.platform || 'delta-india';
                    return tradePlatform === currentPlatform;
                });
            }

            // Calculate real-time P&L for open trades
            for (const trade of trades) {
                if (trade.status === 'open' && trade.entryPrice && trade.symbol) {
                    try {
                        // Get current market price
                        const ticker = await this.deltaService.getTicker(trade.symbol);
                        const currentPrice = ticker.mark_price || ticker.close;
                        
                        // Calculate unrealized P&L
                        const priceDiff = trade.side === 'buy' 
                            ? currentPrice - trade.entryPrice 
                            : trade.entryPrice - currentPrice;
                        
                        trade.unrealizedPnL = priceDiff * trade.quantity;
                        trade.currentPrice = currentPrice;
                        trade.pnlPercentage = ((priceDiff / trade.entryPrice) * 100).toFixed(2);
                        
                        logger.debug(`Real-time P&L for trade ${trade.id}: ${trade.unrealizedPnL} (${trade.pnlPercentage}%)`);
                    } catch (priceError) {
                        logger.warn(`Failed to get current price for ${trade.symbol}:`, priceError.message);
                        trade.unrealizedPnL = 0;
                        trade.currentPrice = trade.entryPrice;
                        trade.pnlPercentage = '0.00';
                    }
                } else {
                    // For closed trades, use existing realized P&L
                    trade.unrealizedPnL = trade.realizedPnL || 0;
                }
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

    async deleteTrade(req, res) {
        try {
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Trade ID is required'
                });
            }

            // Check if trade exists first
            const trade = await this.db.getTrade(parseInt(id));
            if (!trade) {
                return res.status(404).json({
                    success: false,
                    error: 'Trade not found'
                });
            }

            // Don't allow deletion of active trades for safety
            if (trade.status === 'open' || trade.status === 'active') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete active trades. Please close the trade first.'
                });
            }

            // Delete the trade from database
            await this.db.deleteTrade(parseInt(id));
            
            res.json({
                success: true,
                message: `Trade #${id} deleted successfully`
            });
        } catch (error) {
            logger.error('Error deleting trade:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async createManualTrade(req, res) {
        try {
            const {
                symbol,
                side,
                entry_price,
                stop_loss,
                take_profit,
                quantity,
                reason = 'manual_entry'
            } = req.body;

            // Validate required fields
            if (!symbol || !side || !entry_price || !quantity) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: symbol, side, entry_price, quantity'
                });
            }

            // Create trade data object
            const tradeData = {
                symbol: symbol.toUpperCase(),
                side: side.toLowerCase(),
                entry_price: parseFloat(entry_price),
                stop_loss: stop_loss ? parseFloat(stop_loss) : null,
                take_profit: take_profit ? parseFloat(take_profit) : null,
                quantity: parseFloat(quantity),
                source: 'manual',
                message: `Manual ${side} trade for ${symbol}`,
                confidence: 1.0,
                reason
            };

            // Execute the trade
            const trade = await this.tradeManager.executeTrade(tradeData);
            
            res.json({
                success: true,
                data: trade,
                message: 'Manual trade created successfully'
            });
        } catch (error) {
            logger.error('Error creating manual trade:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async updateTrade(req, res) {
        try {
            const { id } = req.params;
            const { stop_loss, take_profit } = req.body;
            
            const tradeId = parseInt(id);
            const updates = {};
            
            if (stop_loss !== undefined) {
                updates.stop_loss = parseFloat(stop_loss);
            }
            
            if (take_profit !== undefined) {
                updates.take_profit = parseFloat(take_profit);
            }

            // Update trade in database
            const trade = await this.db.updateTrade(tradeId, updates);
            
            res.json({
                success: true,
                data: trade,
                message: 'Trade updated successfully'
            });
        } catch (error) {
            logger.error('Error updating trade:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getAvailableSymbols(req, res) {
        try {
            // Get symbols from Delta Exchange
            const symbols = await this.deltaService.getAvailableSymbols();
            
            res.json({
                success: true,
                data: symbols,
                message: 'Symbols retrieved successfully'
            });
        } catch (error) {
            logger.error('Error getting symbols:', error);
            // Fallback to common symbols if API fails
            const fallbackSymbols = [
                'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'XRPUSDT',
                'DOTUSDT', 'LINKUSDT', 'LTCUSDT', 'BCHUSDT', 'XLMUSDT',
                'EOSUSDT', 'TRXUSDT', 'ETCUSDT', 'DASHUSDT', 'ZECUSDT'
            ];
            
            res.json({
                success: true,
                data: fallbackSymbols,
                message: 'Fallback symbols provided'
            });
        }
    }

    async getTicker(req, res) {
        try {
            const { symbol } = req.params;
            
            if (!symbol) {
                return res.status(400).json({
                    success: false,
                    error: 'Symbol parameter is required'
                });
            }

            // Get ticker data from Delta Exchange API
            const ticker = await this.deltaService.getTicker(symbol);
            
            res.json({
                success: true,
                ticker: ticker,
                message: 'Ticker data retrieved successfully'
            });
        } catch (error) {
            logger.error(`Error getting ticker for ${req.params.symbol}:`, error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve ticker data'
            });
        }
    }

    async getQuickTradePrice(req, res) {
        try {
            const { symbol } = req.params;
            
            if (!symbol) {
                return res.status(400).json({
                    success: false,
                    error: 'Symbol parameter is required'
                });
            }

            // Get lightweight price data for quick trades (only best bid/ask)
            const priceData = await this.deltaService.getQuickTradePrice(symbol);
            
            res.json({
                success: true,
                price: priceData,
                message: 'Quick trade price data retrieved successfully'
            });
        } catch (error) {
            logger.error(`Error getting quick trade price for ${req.params.symbol}:`, error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve quick trade price data'
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

    async getExchangePositions(req, res) {
        try {
            const { platform } = req.query;
            const currentPlatform = platform || process.env.TRADING_PLATFORM || 'delta-india';
            
            // Only Delta India is currently supported for real exchange data
            if (currentPlatform !== 'delta-india') {
                return res.json({
                    success: true,
                    supported: false,
                    platform: currentPlatform,
                    message: 'Exchange not yet integrated',
                    positions: []
                });
            }

            // Fetch real positions from Delta Exchange
            const allPositions = await this.deltaService.getPositions();
            
            // Filter only positions with actual size and enhance with real-time data
            const activePositions = [];
            
            for (const position of allPositions) {
                const absoluteSize = Math.abs(position.size || 0);
                
                // Only include positions with significant size
                if (absoluteSize > 0.00001) {
                    // Get current market price for real-time P&L calculation
                    try {
                        const ticker = await this.deltaService.getTicker(position.symbol);
                        const currentPrice = ticker.mark_price || ticker.close || ticker.last_price;
                        
                        // Calculate real-time unrealized P&L
                        const entryPrice = position.entry_price || 0;
                        let unrealizedPnl = 0;
                        let roePercentage = 0;
                        
                        if (entryPrice > 0 && currentPrice > 0) {
                            const positionValue = absoluteSize * entryPrice;
                            const currentValue = absoluteSize * currentPrice;
                            
                            if (position.size > 0) {
                                // Long position
                                unrealizedPnl = currentValue - positionValue;
                            } else {
                                // Short position  
                                unrealizedPnl = positionValue - currentValue;
                            }
                            
                            roePercentage = (unrealizedPnl / positionValue) * 100;
                        }
                        
                        // Enhanced position object
                        activePositions.push({
                            symbol: position.symbol,
                            size: position.size,
                            side: position.size > 0 ? 'long' : 'short',
                            entry_price: entryPrice,
                            mark_price: currentPrice,
                            current_price: currentPrice,
                            unrealized_pnl: unrealizedPnl,
                            roe_percentage: roePercentage,
                            position_value: absoluteSize * entryPrice,
                            last_updated: new Date().toISOString()
                        });
                        
                    } catch (priceError) {
                        logger.warn(`Failed to get current price for ${position.symbol}:`, priceError.message);
                        
                        // Add position without real-time price data
                        activePositions.push({
                            symbol: position.symbol,
                            size: position.size,
                            side: position.size > 0 ? 'long' : 'short',
                            entry_price: position.entry_price || 0,
                            mark_price: position.mark_price || position.entry_price || 0,
                            current_price: position.mark_price || position.entry_price || 0,
                            unrealized_pnl: position.unrealized_pnl || 0,
                            roe_percentage: 0,
                            position_value: Math.abs(position.size) * (position.entry_price || 0),
                            last_updated: new Date().toISOString(),
                            price_error: true
                        });
                    }
                }
            }
            
            res.json({
                success: true,
                supported: true,
                platform: currentPlatform,
                positions: activePositions,
                total_positions: activePositions.length,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            logger.error('Error fetching exchange positions:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                platform: req.query.platform || 'delta-india'
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
                aiProvider: process.env.AI_PROVIDER || 'ollama',
                tradingPlatform: process.env.TRADING_PLATFORM || 'delta-india'
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
            const { useTestAI, isPaperTrading, aiProvider, tradingPlatform, paperTrade } = req.body;

            if (typeof useTestAI !== 'undefined') {
                process.env.USE_TEST_AI = useTestAI ? 'true' : 'false';
                logger.info(`AI mode changed to: ${useTestAI ? 'Test' : 'Live'}`);
            }

            if (typeof isPaperTrading !== 'undefined') {
                process.env.PAPER_TRADING = isPaperTrading ? 'true' : 'false';
                logger.info(`Trading mode changed to: ${isPaperTrading ? 'Paper' : 'Live'}`);
            }

            if (typeof paperTrade !== 'undefined') {
                process.env.PAPER_TRADING = paperTrade ? 'true' : 'false';
                logger.info(`Paper trading mode changed to: ${paperTrade ? 'Paper' : 'Live'}`);
            }

            if (tradingPlatform && ['paper', 'delta-india', 'delta-us', 'coinbase', 'binance'].includes(tradingPlatform)) {
                process.env.TRADING_PLATFORM = tradingPlatform;
                logger.info(`Trading platform changed to: ${tradingPlatform}`);

                // Update DeltaExchangeService paper trading mode
                if (this.deltaService) {
                    this.deltaService.paperTrade = tradingPlatform === 'paper';
                }
            }

            if (aiProvider && ['openai', 'ollama', 'test'].includes(aiProvider.toLowerCase())) {
                process.env.AI_PROVIDER = aiProvider.toLowerCase();
                logger.info(`AI provider changed to: ${aiProvider}`);
            }

            const config = {
                useTestAI: process.env.USE_TEST_AI === 'true',
                isPaperTrading: process.env.PAPER_TRADING === 'true',
                aiProvider: process.env.AI_PROVIDER || 'ollama',
                tradingPlatform: process.env.TRADING_PLATFORM || 'delta-india'
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

    // Risk Management endpoints
    async getRiskSettings(req, res) {
        try {
            // Get risk settings from database or config
            const riskSettings = {
                global: {
                    maxRiskPerTrade: this.config.risk?.maxRiskPerTrade || 2,
                    maxPositions: this.config.risk?.maxPositions || 5,
                    dailyLossLimit: this.config.risk?.dailyLossLimit || 5,
                    autoStopLoss: this.config.risk?.autoStopLoss || true
                },
                symbols: this.config.risk?.symbols || {}
            };

            res.json({
                success: true,
                settings: riskSettings
            });
        } catch (error) {
            logger.error('Error getting risk settings:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get risk settings'
            });
        }
    }

    async saveRiskSettings(req, res) {
        try {
            const { global, symbols } = req.body;

            // Validate input
            if (!global || typeof global !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Global risk settings are required'
                });
            }

            // Save to config (in a real implementation, this would update the config file)
            if (!this.config.risk) {
                this.config.risk = {};
            }

            this.config.risk = {
                ...this.config.risk,
                maxRiskPerTrade: parseFloat(global.maxRiskPerTrade) || 2,
                maxPositions: parseInt(global.maxPositions) || 5,
                dailyLossLimit: parseFloat(global.dailyLossLimit) || 5,
                autoStopLoss: Boolean(global.autoStopLoss),
                symbols: symbols || {}
            };

            logger.info('Risk settings updated:', {
                global: this.config.risk,
                symbolCount: Object.keys(symbols || {}).length
            });

            res.json({
                success: true,
                message: 'Risk settings saved successfully'
            });

        } catch (error) {
            logger.error('Error saving risk settings:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to save risk settings'
            });
        }
    }

    async deleteSymbolRiskSettings(req, res) {
        try {
            const { symbol } = req.params;

            if (!symbol) {
                return res.status(400).json({
                    success: false,
                    error: 'Symbol is required'
                });
            }

            if (!this.config.risk || !this.config.risk.symbols) {
                return res.status(404).json({
                    success: false,
                    error: 'Symbol risk settings not found'
                });
            }

            delete this.config.risk.symbols[symbol];

            logger.info(`Risk settings removed for symbol: ${symbol}`);

            res.json({
                success: true,
                message: `Risk settings removed for ${symbol}`
            });

        } catch (error) {
            logger.error('Error deleting symbol risk settings:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete symbol risk settings'
            });
        }
    }

    // Quick Trade endpoints
    async executeQuickTrade(req, res) {
        const startTime = Date.now();
        
        try {
            const { symbol, side, quantity, type = 'market' } = req.body;

            // Step 1: Minimal validation for speed
            if (!symbol || !side || !quantity) {
                return res.status(400).json({
                    success: false,
                    error: 'Symbol, side, and quantity are required'
                });
            }

            const parsedQuantity = parseFloat(quantity);
            if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid quantity'
                });
            }

            // Convert long/short to buy/sell quickly
            let orderSide = side.toLowerCase();
            if (orderSide === 'long') orderSide = 'buy';
            if (orderSide === 'short') orderSide = 'sell';

            if (!['buy', 'sell'].includes(orderSide)) {
                return res.status(400).json({
                    success: false,
                    error: 'Side must be buy, sell, long, or short'
                });
            }

            // Check service availability
            if (!this.deltaService) {
                return res.status(500).json({
                    success: false,
                    error: 'Trading service unavailable'
                });
            }

            logger.info(`⚡ QUICK TRADE: ${orderSide} ${parsedQuantity} ${symbol.toUpperCase()}`);

            // Step 2: Use fast order placement (skip heavy trade manager)
            const order = await this.deltaService.placeQuickOrder({
                symbol: symbol.toUpperCase(),
                side: orderSide,
                type: type.toLowerCase(),
                quantity: parsedQuantity
            });

            const executionTime = Date.now() - startTime;
            logger.info(`⚡ QUICK TRADE COMPLETED in ${executionTime}ms`);

            res.json({
                success: true,
                order: order,
                execution_time_ms: executionTime,
                message: `${orderSide.toUpperCase()} order placed in ${executionTime}ms`
            });

        } catch (error) {
            const executionTime = Date.now() - startTime;
            logger.error(`❌ QUICK TRADE FAILED in ${executionTime}ms:`, error.message);
            
            res.status(500).json({
                success: false,
                error: error.message,
                execution_time_ms: executionTime
            });
        }
    }

    // Fast close position endpoint
    async closePositionQuick(req, res) {
        const startTime = Date.now();
        
        try {
            const { symbol, size } = req.body;

            if (!symbol || !size) {
                return res.status(400).json({
                    success: false,
                    error: 'Symbol and size are required'
                });
            }

            const positionSize = parseFloat(size);
            if (isNaN(positionSize) || positionSize === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid position size'
                });
            }

            if (!this.deltaService) {
                return res.status(500).json({
                    success: false,
                    error: 'Trading service unavailable'
                });
            }

            logger.info(`⚡ QUICK CLOSE: ${positionSize} ${symbol.toUpperCase()}`);

            // Use fast close position method
            const order = await this.deltaService.closePosition(symbol.toUpperCase(), positionSize);

            const executionTime = Date.now() - startTime;
            logger.info(`⚡ POSITION CLOSED in ${executionTime}ms`);

            res.json({
                success: true,
                order: order,
                execution_time_ms: executionTime,
                message: `Position closed in ${executionTime}ms`
            });

        } catch (error) {
            const executionTime = Date.now() - startTime;
            logger.error(`❌ CLOSE POSITION FAILED in ${executionTime}ms:`, error.message);
            
            res.status(500).json({
                success: false,
                error: error.message,
                execution_time_ms: executionTime
            });
        }
    }

    async reversePosition(req, res) {
        try {
            const { symbol } = req.body;

            if (!symbol) {
                return res.status(400).json({
                    success: false,
                    error: 'Symbol is required'
                });
            }

            // Get current position
            const positions = await this.deltaService.getPositions();
            const position = positions.find(p => p.symbol === symbol);

            if (!position || Math.abs(position.size) < 0.001) {
                return res.status(400).json({
                    success: false,
                    error: 'No active position found for this symbol'
                });
            }

            // Calculate reverse quantity (double the position to reverse it)
            const reverseQuantity = Math.abs(position.size) * 2;
            const reverseSide = position.size > 0 ? 'sell' : 'buy';

            // Execute reverse trade
            const trade = await this.tradeManager.createManualTrade({
                symbol,
                side: reverseSide,
                quantity: reverseQuantity,
                type: 'market',
                source: 'reverse_trade'
            });

            logger.info(`Position reversed: ${reverseSide} ${reverseQuantity} ${symbol}`);

            res.json({
                success: true,
                trade: trade,
                message: `Position reversed successfully`,
                originalPosition: position.size,
                reverseQuantity: reverseQuantity
            });

        } catch (error) {
            logger.error('Error reversing position:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to reverse position'
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