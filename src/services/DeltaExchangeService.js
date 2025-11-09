const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

class DeltaExchangeService {
    constructor(config) {
        this.config = config.deltaExchange;
        this.baseUrl = this.config.baseUrl;
        this.apiKey = this.config.apiKey;
        this.apiSecret = this.config.apiSecret;
        // Check environment variable for paper trading, with config as fallback
        this.paperTrade = process.env.PAPER_TRADE === 'true' || this.config.paperTrade;
        this.testnet = this.config.testnet;
        
        // Paper trading data
        this.paperTrades = new Map();
        this.paperBalance = 10000; // Starting with $10,000 for paper trading
        this.paperPositions = new Map();

        if (this.paperTrade) {
            logger.info('Delta Exchange service initialized in PAPER TRADING mode');
        } else {
            logger.info(`Delta Exchange service initialized in LIVE mode (testnet: ${this.testnet})`);
        }
    }

    // Generate signature for authenticated requests
    generateSignature(method, path, timestamp, body = '') {
        if (!this.apiSecret) return '';
        
        const message = method + timestamp + path + body;
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(message)
            .digest('hex');
    }

    // Make authenticated API request
    async makeRequest(method, endpoint, data = null) {
        if (this.paperTrade) {
            return this.handlePaperRequest(method, endpoint, data);
        }

        try {
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const path = endpoint;
            const body = data ? JSON.stringify(data) : '';
            const signature = this.generateSignature(method, path, timestamp, body);

            const headers = {
                'api-key': this.apiKey,
                'timestamp': timestamp,
                'signature': signature,
                'Content-Type': 'application/json'
            };

            const config = {
                method,
                url: `${this.baseUrl}${endpoint}`,
                headers
            };

            if (data) {
                config.data = data;
            }

            // Log the full request details
            logger.info(`🚀 DELTA EXCHANGE REQUEST:`);
            logger.info(`   Method: ${method}`);
            logger.info(`   URL: ${config.url}`);
            logger.info(`   Headers: ${JSON.stringify(headers, null, 2)}`);
            if (data) {
                logger.info(`   Request Data: ${JSON.stringify(data, null, 2)}`);
            }

            const response = await axios(config);
            
            // Log the response
            logger.info(`✅ DELTA EXCHANGE RESPONSE:`);
            logger.info(`   Status: ${response.status}`);
            logger.info(`   Response: ${JSON.stringify(response.data, null, 2)}`);
            
            return response.data;
        } catch (error) {
            logger.error('Delta Exchange API error:', error.response?.data || error.message);
            throw new Error(`Delta Exchange API error: ${error.response?.data?.error || error.message}`);
        }
    }

    // Handle paper trading requests
    async handlePaperRequest(method, endpoint, data) {
        logger.debug(`Paper trading request: ${method} ${endpoint}`, data);

        // Simulate API responses for paper trading
        if (endpoint === '/v2/orders' && method === 'POST') {
            return this.simulateOrderPlacement(data);
        } else if (endpoint === '/v2/orders' && method === 'GET') {
            return this.simulateGetOrders();
        } else if (endpoint === '/v2/positions' && method === 'GET') {
            return this.simulateGetPositions();
        } else if (endpoint.includes('/v2/orders/') && method === 'DELETE') {
            return this.simulateOrderCancellation(endpoint);
        } else if (endpoint === '/v2/wallet/balances' && method === 'GET') {
            return this.simulateGetBalance();
        }

        // Default response for other endpoints
        return { success: true, paper_trade: true };
    }

    // Simulate order placement for paper trading
    simulateOrderPlacement(orderData) {
        const orderId = `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const order = {
            id: orderId,
            product_id: orderData.product_id,
            side: orderData.side,
            size: orderData.size,
            order_type: orderData.order_type,
            limit_price: orderData.limit_price,
            stop_price: orderData.stop_price,
            state: 'open',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        this.paperTrades.set(orderId, order);
        
        logger.info(`Paper trade order placed: ${orderId}`);
        
        return {
            success: true,
            result: order
        };
    }

    simulateGetOrders() {
        const orders = Array.from(this.paperTrades.values());
        return {
            success: true,
            result: orders
        };
    }

    simulateGetPositions() {
        const positions = Array.from(this.paperPositions.values());
        return {
            success: true,
            result: positions
        };
    }

    simulateOrderCancellation(endpoint) {
        const orderId = endpoint.split('/').pop();
        if (this.paperTrades.has(orderId)) {
            const order = this.paperTrades.get(orderId);
            order.state = 'cancelled';
            order.updated_at = new Date().toISOString();
            
            logger.info(`Paper trade order cancelled: ${orderId}`);
            
            return {
                success: true,
                result: order
            };
        }
        
        throw new Error('Order not found');
    }

    simulateGetBalance() {
        return {
            success: true,
            result: [
                {
                    asset_id: 1, // USDT
                    balance: this.paperBalance.toString(),
                    available_balance: this.paperBalance.toString()
                }
            ]
        };
    }

    // Get available products/symbols
    async getProducts() {
        try {
            const response = await this.makeRequest('GET', '/v2/products');
            return response.result || [];
        } catch (error) {
            logger.error('Error fetching products:', error);
            throw error;
        }
    }

    // Get current market price
    async getMarketPrice(symbol) {
        try {
            // Always get real market data, even in paper trading mode
            // Paper trading should simulate trades, not prices
            return await this.getRealMarketPrice(symbol);
        } catch (error) {
            logger.error(`Error fetching market price for ${symbol}:`, error);
            throw error;
        }
    }

    async getRealMarketPrice(symbol) {
        try {
            // Normalize symbol for Delta Exchange API
            let normalizedSymbol = this.normalizeSymbol(symbol);
            
            logger.info(`Getting real market price for ${symbol} (normalized: ${normalizedSymbol})`);
            
            // Use public API endpoint for ticker data (no auth required)
            // Correct endpoint format is /v2/tickers/{symbol}
            const response = await axios.get(`${this.baseUrl}/v2/tickers/${normalizedSymbol}`);
            
            if (response.data && response.data.result) {
                const price = parseFloat(response.data.result.close);
                logger.info(`Real market price for ${symbol}: $${price}`);
                return price;
            } else {
                throw new Error(`Invalid response format for ${normalizedSymbol}`);
            }
        } catch (error) {
            logger.error(`Error getting real price for ${symbol}:`, error.message);
            // Don't fall back to simulated prices - throw the error
            throw new Error(`Unable to get real market price for ${symbol}: ${error.message}`);
        }
    }

    normalizeSymbol(symbol) {
        // Convert common symbol formats to Delta Exchange format
        const symbolMap = {
            'BTC': 'BTCUSD',
            'BTCUSDT': 'BTCUSD',
            'ETH': 'ETHUSD',
            'ETHUSDT': 'ETHUSD',
            'ADA': 'ADAUSD',
            'ADAUSDT': 'ADAUSD',
            'SOL': 'SOLUSD',
            'SOLUSDT': 'SOLUSD',
            'DOT': 'DOTUSD',
            'DOTUSDT': 'DOTUSD',
            'AVAX': 'AVAXUSD',
            'AVAXUSDT': 'AVAXUSD',
            'MATIC': 'MATICUSD',
            'MATICUSDT': 'MATICUSD',
            'UNI': 'UNIUSD',
            'UNIUSDT': 'UNIUSD'
        };
        
        // If symbol is already in correct format, return as is
        if (symbol.includes('USD') && !symbol.includes('USDT')) {
            return symbol;
        }
        
        // Map to USD pair
        const mapped = symbolMap[symbol.toUpperCase()];
        if (mapped) {
            logger.info(`Mapped ${symbol} to ${mapped}`);
            return mapped;
        }
        
        // Default: add USD (not USDT)
        const normalizedBase = symbol.toUpperCase().replace('USDT', '');
        const defaultMapping = normalizedBase + 'USD';
        logger.info(`Default mapping ${symbol} to ${defaultMapping}`);
        return defaultMapping;
    }

    // Validate ticker exists by checking current price
    async validateTicker(symbol) {
        try {
            const normalizedSymbol = this.normalizeSymbol(symbol);
            logger.info(`Validating ticker: ${normalizedSymbol}`);
            
            // Use public API endpoint for ticker data (no auth required)
            const response = await axios.get(`${this.baseUrl}/v2/tickers/${normalizedSymbol}`);
            
            if (response.data && response.data.result && response.data.success) {
                const result = response.data.result;
                const price = parseFloat(result.close);
                const productId = result.product_id;
                
                logger.info(`Ticker ${normalizedSymbol} is valid - Current price: $${price}, Product ID: ${productId}`);
                return {
                    valid: true,
                    symbol: normalizedSymbol,
                    price: price,
                    productId: productId
                };
            } else {
                throw new Error(`Invalid response format for ${normalizedSymbol}`);
            }
        } catch (error) {
            logger.warn(`Ticker ${symbol} is invalid or not found: ${error.message}`);
            return {
                valid: false,
                symbol: symbol,
                error: error.message
            };
        }
    }

    // Get order book data to fetch best bid/ask prices
    async getOrderBook(symbol) {
        try {
            const response = await this.makeRequest('GET', `/v2/l2orderbook/${symbol}`);
            
            if (response.success && response.result) {
                const bestBid = response.result.buy && response.result.buy[0] ? parseFloat(response.result.buy[0].price) : null;
                const bestAsk = response.result.sell && response.result.sell[0] ? parseFloat(response.result.sell[0].price) : null;
                
                return {
                    symbol: symbol,
                    bestBid: bestBid,
                    bestAsk: bestAsk,
                    spread: bestAsk && bestBid ? (bestAsk - bestBid) : null
                };
            } else {
                throw new Error('Failed to get order book data');
            }
        } catch (error) {
            logger.error('Error fetching order book:', error);
            throw error;
        }
    }

    // Place a limit order at best bid/ask price with bracket (SL/TP)
    async placeMarketOrder(symbol, side, quantity, productId, stopLoss = null, takeProfit = null) {
        try {
            // Get order book to determine best entry price
            const orderBook = await this.getOrderBook(symbol);
            
            // Choose entry price based on side
            let entryPrice;
            if (side === 'buy') {
                entryPrice = orderBook.bestAsk; // Buy at best ask (immediate fill)
            } else {
                entryPrice = orderBook.bestBid; // Sell at best bid (immediate fill)
            }
            
            if (!entryPrice) {
                throw new Error(`No ${side === 'buy' ? 'ask' : 'bid'} price available in order book`);
            }

            const orderData = {
                product_id: parseInt(productId),
                side: side,
                size: quantity.toString(),
                order_type: 'limit_order',
                limit_price: entryPrice.toString()
            };

            // Add bracket order parameters if provided
            if (stopLoss) {
                orderData.bracket_stop_loss_price = stopLoss.toString();
            }
            
            if (takeProfit) {
                orderData.bracket_take_profit_price = takeProfit.toString();
            }

            logger.info(`Placing ${side} limit order at best ${side === 'buy' ? 'ask' : 'bid'}: ${quantity} ${symbol} @ $${entryPrice} (product_id: ${productId})`);
            if (stopLoss) logger.info(`  └── Stop Loss: $${stopLoss}`);
            if (takeProfit) logger.info(`  └── Take Profit: $${takeProfit}`);
            logger.info(`  └── Spread: $${orderBook.spread?.toFixed(2)} (Bid: $${orderBook.bestBid} | Ask: $${orderBook.bestAsk})`);
            
            const response = await this.makeRequest('POST', '/v2/orders', orderData);
            
            if (response.success) {
                logger.info(`Limit order with bracket placed successfully: ${response.result.id}`);
                return response.result;
            } else {
                throw new Error('Failed to place limit order');
            }
        } catch (error) {
            logger.error('Error placing limit order:', error);
            throw error;
        }
    }

    // Place a limit order
    async placeLimitOrder(symbol, side, quantity, price, productId) {
        try {
            const orderData = {
                product_id: parseInt(productId),
                side: side,
                size: quantity.toString(),
                order_type: 'limit_order',
                limit_price: price.toString()
            };

            logger.info(`Placing ${side} limit order: ${quantity} ${symbol} at $${price} (product_id: ${productId})`);
            
            const response = await this.makeRequest('POST', '/v2/orders', orderData);
            
            if (response.success) {
                logger.info(`Limit order placed successfully: ${response.result.id}`);
                return response.result;
            } else {
                throw new Error('Failed to place limit order');
            }
        } catch (error) {
            logger.error('Error placing limit order:', error);
            throw error;
        }
    }

    // Place a stop order (Note: Delta Exchange India only supports limit_order and market_order)
    // This method will be used for advanced stop order logic if needed
    async placeStopOrder(symbol, side, quantity, stopPrice, productId, limitPrice = null) {
        try {
            // Delta Exchange India doesn't support stop orders directly
            // We'll use TradeManager to monitor stop conditions and place market orders when triggered
            logger.warn(`Stop orders not supported by Delta Exchange India. Stop price ${stopPrice} will be monitored by TradeManager.`);
            
            return {
                id: `stop_monitor_${Date.now()}`,
                type: 'stop_monitor',
                symbol: symbol,
                side: side,
                quantity: quantity,
                stopPrice: stopPrice,
                limitPrice: limitPrice,
                productId: productId,
                message: 'Stop loss monitoring enabled'
            };
        } catch (error) {
            logger.error('Error setting up stop order monitoring:', error);
            throw error;
        }
    }

    // Cancel an order
    async cancelOrder(orderId) {
        try {
            logger.info(`Cancelling order: ${orderId}`);
            
            const response = await this.makeRequest('DELETE', `/v2/orders/${orderId}`);
            
            if (response.success) {
                logger.info(`Order cancelled successfully: ${orderId}`);
                return response.result;
            } else {
                throw new Error('Failed to cancel order');
            }
        } catch (error) {
            logger.error('Error cancelling order:', error);
            throw error;
        }
    }

    // Get account balance
    async getBalance() {
        try {
            const response = await this.makeRequest('GET', '/v2/wallet/balances');
            return response.result || [];
        } catch (error) {
            logger.error('Error fetching balance:', error);
            throw error;
        }
    }

    // Get open orders
    async getOpenOrders() {
        try {
            const response = await this.makeRequest('GET', '/v2/orders');
            return response.result || [];
        } catch (error) {
            logger.error('Error fetching open orders:', error);
            throw error;
        }
    }

    // Get positions
    async getPositions() {
        try {
            const response = await this.makeRequest('GET', '/v2/positions');
            return response.result || [];
        } catch (error) {
            logger.error('Error fetching positions:', error);
            throw error;
        }
    }

    // Update paper trade balance (for paper trading P&L tracking)
    updatePaperBalance(amount) {
        if (this.paperTrade) {
            this.paperBalance += amount;
            logger.info(`Paper balance updated: $${this.paperBalance.toFixed(2)}`);
        }
    }

    // Get paper trading statistics
    getPaperTradingStats() {
        if (!this.paperTrade) {
            return null;
        }

        const trades = Array.from(this.paperTrades.values());
        const totalTrades = trades.length;
        const openTrades = trades.filter(t => t.state === 'open').length;
        const closedTrades = trades.filter(t => t.state === 'filled').length;
        const cancelledTrades = trades.filter(t => t.state === 'cancelled').length;

        return {
            paperBalance: this.paperBalance,
            totalTrades,
            openTrades,
            closedTrades,
            cancelledTrades,
            startingBalance: 10000,
            totalPnl: this.paperBalance - 10000
        };
    }
}

module.exports = DeltaExchangeService;