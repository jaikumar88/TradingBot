const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

class DeltaExchangeService {
    constructor(config, databaseService = null) {
        this.config = config.deltaExchange;
        this.db = databaseService;
        this.baseUrl = this.config.baseUrl;
        this.apiKey = this.config.apiKey;
        this.apiSecret = this.config.apiSecret;
        // Check environment variable for paper trading, with config as fallback
        this.paperTrade = process.env.PAPER_TRADE === 'true' || this.config.paperTrade;
        this.testnet = this.config.testnet;
        
        // Products cache management
        this.productsCache = new Map();
        this.productsLastUpdated = null;
        this.productsCacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        
        // Paper trading data
        this.paperTrades = new Map();
        this.paperBalance = 10000; // Starting with $10,000 for paper trading
        this.paperPositions = new Map();

        if (this.paperTrade) {
            logger.info('Delta Exchange service initialized in PAPER TRADING mode');
        } else {
            logger.info(`Delta Exchange service initialized in LIVE mode (testnet: ${this.testnet})`);
        }

        // Initialize products cache
        this.initializeProductsCache();
    }

    // Products Cache Management
    async initializeProductsCache() {
        try {
            if (this.db) {
                // Load products from database
                const lastUpdated = await this.db.getProductsLastUpdated();
                if (lastUpdated && (Date.now() - lastUpdated.getTime()) < this.productsCacheExpiry) {
                    const products = await this.db.getAllProducts();
                    products.forEach(product => {
                        this.productsCache.set(product.symbol, product);
                    });
                    this.productsLastUpdated = lastUpdated;
                    logger.info(`✅ Loaded ${products.length} products from database cache`);
                    return;
                }
            }
            
            // Cache is expired or empty, refresh from API
            await this.refreshProductsCache();
        } catch (error) {
            logger.error('Error initializing products cache:', error);
        }
    }

    async refreshProductsCache() {
        try {
            logger.info('🔄 Refreshing products cache from Delta Exchange API...');
            
            // Fetch products from API
            const response = await axios.get(`${this.baseUrl}/v2/products`);
            
            if (response.data && response.data.success && response.data.result) {
                const products = response.data.result;
                
                // Clear existing cache
                this.productsCache.clear();
                
                // Update memory cache
                products.forEach(product => {
                    if (product.state === 'live') {
                        this.productsCache.set(product.symbol, {
                            productId: product.id,
                            symbol: product.symbol,
                            underlyingAsset: product.underlying_asset?.symbol,
                            quotingAsset: product.quoting_asset?.symbol,
                            settlementAsset: product.settlement_asset?.symbol,
                            contractType: product.contract_type,
                            contractValue: product.contract_value,
                            tickSize: product.tick_size,
                            minSizeBase: product.min_size_base,
                            maxSizeBase: product.max_size_base
                        });
                    }
                });
                
                // Save to database if available
                if (this.db) {
                    await this.db.saveProducts(products.filter(p => p.state === 'live'));
                }
                
                this.productsLastUpdated = new Date();
                logger.info(`✅ Refreshed ${this.productsCache.size} products in cache`);
                
            } else {
                throw new Error('Invalid response format from products API');
            }
        } catch (error) {
            logger.error('Error refreshing products cache:', error);
            throw error;
        }
    }

    async getProductBySymbol(symbol) {
        // Check if cache needs refresh
        if (!this.productsLastUpdated || 
            (Date.now() - this.productsLastUpdated.getTime()) > this.productsCacheExpiry) {
            await this.refreshProductsCache();
        }
        
        // First check memory cache
        if (this.productsCache.has(symbol)) {
            return this.productsCache.get(symbol);
        }
        
        // If not in memory but we have database, check there
        if (this.db) {
            const product = await this.db.getProductBySymbol(symbol);
            if (product) {
                // Add to memory cache for faster future access
                this.productsCache.set(symbol, product);
                return product;
            }
        }
        
        return null;
    }

    // Get all available symbols from cache
    getAvailableSymbols() {
        return Array.from(this.productsCache.keys()).sort();
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

    // Get available symbols for trading
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
            
            // First check products cache for product ID
            const product = await this.getProductBySymbol(normalizedSymbol);
            
            if (product) {
                // Use public API endpoint for current price (no auth required)
                const response = await axios.get(`${this.baseUrl}/v2/tickers/${normalizedSymbol}`);
                
                if (response.data && response.data.result && response.data.success) {
                    const result = response.data.result;
                    const price = parseFloat(result.close);
                    
                    logger.info(`Ticker ${normalizedSymbol} is valid - Current price: $${price}, Product ID: ${product.productId}`);
                    return {
                        valid: true,
                        symbol: normalizedSymbol,
                        price: price,
                        productId: product.productId,
                        product: product
                    };
                } else {
                    throw new Error(`Failed to get current price for ${normalizedSymbol}`);
                }
            } else {
                // Product not found in cache
                logger.warn(`Product ${normalizedSymbol} not found in cache, attempting refresh...`);
                
                // Try refreshing cache once
                await this.refreshProductsCache();
                const refreshedProduct = await this.getProductBySymbol(normalizedSymbol);
                
                if (refreshedProduct) {
                    return this.validateTicker(symbol); // Recursive call with fresh cache
                } else {
                    throw new Error(`Symbol ${normalizedSymbol} not found on Delta Exchange`);
                }
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

    // Get full ticker data for a symbol
    async getTicker(symbol) {
        try {
            const normalizedSymbol = this.normalizeSymbol(symbol);
            logger.info(`Getting ticker data for ${normalizedSymbol}`);
            
            // Use public API endpoint for ticker data (no auth required)
            const response = await axios.get(`${this.baseUrl}/v2/tickers/${normalizedSymbol}`);
            
            if (response.data && response.data.result && response.data.success) {
                const ticker = response.data.result;
                
                // Return the full ticker data
                return {
                    symbol: normalizedSymbol,
                    mark_price: parseFloat(ticker.mark_price),
                    close: parseFloat(ticker.close),
                    high: parseFloat(ticker.high),
                    low: parseFloat(ticker.low),
                    open: parseFloat(ticker.open),
                    volume: parseFloat(ticker.volume),
                    change_24h: parseFloat(ticker.change_24h),
                    turnover: parseFloat(ticker.turnover),
                    timestamp: ticker.timestamp
                };
            } else {
                throw new Error(`Invalid ticker response for ${normalizedSymbol}`);
            }
        } catch (error) {
            logger.error(`Error getting ticker data for ${symbol}:`, error.message);
            throw new Error(`Unable to get ticker data for ${symbol}: ${error.message}`);
        }
    }

    // Get full ticker data for a symbol
    async getTicker(symbol) {
        try {
            const normalizedSymbol = this.normalizeSymbol(symbol);
            logger.info(`Getting ticker data for: ${normalizedSymbol}`);
            
            // Use public API endpoint for ticker data (no auth required)
            const response = await axios.get(`${this.baseUrl}/v2/tickers/${normalizedSymbol}`);
            
            if (response.data && response.data.result && response.data.success) {
                return response.data.result;
            } else {
                throw new Error(`Invalid response format for ${normalizedSymbol}`);
            }
        } catch (error) {
            logger.error(`Error getting ticker for ${symbol}:`, error.message);
            throw new Error(`Unable to get ticker data for ${symbol}: ${error.message}`);
        }
    }

    // Get lightweight price data for quick trades (only best bid/ask)
    async getQuickTradePrice(symbol) {
        try {
            const normalizedSymbol = this.normalizeSymbol(symbol);
            logger.info(`Getting quick trade price for: ${normalizedSymbol}`);
            
            // Use public API endpoint for ticker data (no auth required)
            const response = await axios.get(`${this.baseUrl}/v2/tickers/${normalizedSymbol}`);
            
            if (response.data && response.data.result && response.data.success) {
                const ticker = response.data.result;
                
                // Extract only essential price data for quick trades
                return {
                    symbol: normalizedSymbol,
                    bestBid: parseFloat(ticker.quotes?.best_bid || 0),
                    bestAsk: parseFloat(ticker.quotes?.best_ask || 0),
                    markPrice: parseFloat(ticker.mark_price || 0),
                    lastPrice: parseFloat(ticker.close || 0),
                    spread: ticker.quotes?.best_ask && ticker.quotes?.best_bid ? 
                        (parseFloat(ticker.quotes.best_ask) - parseFloat(ticker.quotes.best_bid)) : 0
                };
            } else {
                throw new Error(`Invalid response format for ${normalizedSymbol}`);
            }
        } catch (error) {
            logger.error(`Error getting quick trade price for ${symbol}:`, error.message);
            throw new Error(`Unable to get quick trade price for ${symbol}: ${error.message}`);
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

    // Validate order input parameters
    validateOrderInputs(symbol, side, quantity, productId, stopLoss = null, takeProfit = null) {
        try {
            // Validate symbol
            if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
                return { valid: false, error: 'Symbol is required and must be a non-empty string' };
            }

            // Validate side
            const validSides = ['buy', 'sell'];
            if (!side || !validSides.includes(side.toLowerCase())) {
                return { valid: false, error: `Side must be one of: ${validSides.join(', ')}` };
            }

            // Validate quantity
            if (!quantity || quantity === null || quantity === undefined) {
                return { valid: false, error: 'Quantity is required' };
            }

            const parsedQuantity = parseFloat(quantity);
            if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
                return { valid: false, error: 'Quantity must be a positive number greater than 0' };
            }

            // Validate product ID
            if (!productId || productId === null || productId === undefined) {
                return { valid: false, error: 'Product ID is required and cannot be null' };
            }

            const parsedProductId = parseInt(productId);
            if (isNaN(parsedProductId) || parsedProductId <= 0) {
                return { valid: false, error: 'Product ID must be a valid positive integer' };
            }

            // Validate stop loss if provided
            if (stopLoss !== null && stopLoss !== undefined) {
                const parsedStopLoss = parseFloat(stopLoss);
                if (isNaN(parsedStopLoss) || parsedStopLoss <= 0) {
                    return { valid: false, error: 'Stop loss must be a positive number if provided' };
                }
            }

            // Validate take profit if provided
            if (takeProfit !== null && takeProfit !== undefined) {
                const parsedTakeProfit = parseFloat(takeProfit);
                if (isNaN(parsedTakeProfit) || parsedTakeProfit <= 0) {
                    return { valid: false, error: 'Take profit must be a positive number if provided' };
                }
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: `Input validation error: ${error.message}` };
        }
    }

    // Validate order data before sending to API
    validateOrderData(orderData) {
        try {
            // Check required fields
            if (!orderData.product_id) {
                return { valid: false, error: 'product_id is required in order data' };
            }

            if (!orderData.side || !['buy', 'sell'].includes(orderData.side)) {
                return { valid: false, error: 'side must be "buy" or "sell"' };
            }

            // Validate size - can be integer or numeric string
            if (orderData.size === undefined || orderData.size === null) {
                return { valid: false, error: 'size is required' };
            }
            
            const sizeValue = typeof orderData.size === 'number' ? orderData.size : parseFloat(orderData.size);
            if (isNaN(sizeValue) || sizeValue <= 0) {
                return { valid: false, error: 'size must be a positive number' };
            }

            if (!orderData.order_type || !['limit_order', 'market_order'].includes(orderData.order_type)) {
                return { valid: false, error: 'order_type must be "limit_order" or "market_order"' };
            }

            if (orderData.order_type === 'limit_order' && (!orderData.limit_price || isNaN(parseFloat(orderData.limit_price)) || parseFloat(orderData.limit_price) <= 0)) {
                return { valid: false, error: 'limit_price is required and must be positive for limit orders' };
            }

            // Validate bracket order parameters if provided
            if (orderData.bracket_stop_loss_price && (isNaN(parseFloat(orderData.bracket_stop_loss_price)) || parseFloat(orderData.bracket_stop_loss_price) <= 0)) {
                return { valid: false, error: 'bracket_stop_loss_price must be a positive number if provided' };
            }

            if (orderData.bracket_take_profit_price && (isNaN(parseFloat(orderData.bracket_take_profit_price)) || parseFloat(orderData.bracket_take_profit_price) <= 0)) {
                return { valid: false, error: 'bracket_take_profit_price must be a positive number if provided' };
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: `Order data validation error: ${error.message}` };
        }
    }

    // Place a limit order at best bid/ask price with bracket (SL/TP)
    async placeMarketOrder(symbol, side, quantity, productId, stopLoss = null, takeProfit = null) {
        try {
            // Step 1: Validate all input parameters
            const validation = this.validateOrderInputs(symbol, side, quantity, productId, stopLoss, takeProfit);
            if (!validation.valid) {
                throw new Error(`Order validation failed: ${validation.error}`);
            }

            // Get order book to determine best entry price
            const orderBook = await this.getOrderBook(symbol);
            
            // Choose entry price based on side
            let entryPrice;
            if (side === 'buy') {
                entryPrice = orderBook.bestAsk; // Buy at best ask (immediate fill)
            } else {
                entryPrice = orderBook.bestBid; // Sell at best bid (immediate fill)
            }
            
            if (!entryPrice || entryPrice <= 0) {
                throw new Error(`No valid ${side === 'buy' ? 'ask' : 'bid'} price available in order book`);
            }

            // Step 2: Convert quantity to appropriate size format for Delta Exchange
            // Get product info to determine correct size conversion
            const product = await this.getProductBySymbol(symbol);
            
            let orderSize;
            if (product && product.minSizeBase) {
                // Use the raw quantity as size - most crypto products expect decimal quantities
                orderSize = parseFloat(quantity);
                
                // Ensure size meets minimum requirements
                const minSize = parseFloat(product.minSizeBase) || 0.001;
                if (orderSize < minSize) {
                    throw new Error(`Order size ${orderSize} is below minimum size ${minSize} for ${symbol}`);
                }
                
                // Ensure size meets maximum requirements if specified
                if (product.maxSizeBase && orderSize > parseFloat(product.maxSizeBase)) {
                    throw new Error(`Order size ${orderSize} exceeds maximum size ${product.maxSizeBase} for ${symbol}`);
                }
            } else {
                // Fallback: use raw quantity without massive multiplication
                orderSize = parseFloat(quantity);
            }
            
            logger.info(`Order size conversion: ${quantity} -> ${orderSize} for ${symbol}`);
            
            // Step 2: Validate order data before sending
            const orderData = {
                product_id: parseInt(productId),
                side: side,
                size: orderSize,
                order_type: 'limit_order',
                limit_price: entryPrice.toString()
            };

            // Add bracket order parameters if provided and valid
            if (stopLoss && stopLoss > 0) {
                orderData.bracket_stop_loss_price = stopLoss.toString();
            }
            
            if (takeProfit && takeProfit > 0) {
                orderData.bracket_take_profit_price = takeProfit.toString();
            }

            // Step 3: Final validation of order data
            const orderValidation = this.validateOrderData(orderData);
            if (!orderValidation.valid) {
                throw new Error(`Order data validation failed: ${orderValidation.error}`);
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
                throw new Error(`Failed to place limit order: ${response.error || 'Unknown API error'}`);
            }
        } catch (error) {
            logger.error('Error placing limit order:', error);
            throw error;
        }
    }

    // Place a limit order
    async placeLimitOrder(symbol, side, quantity, price, productId) {
        try {
            // Step 1: Validate input parameters
            const validation = this.validateOrderInputs(symbol, side, quantity, productId);
            if (!validation.valid) {
                throw new Error(`Limit order validation failed: ${validation.error}`);
            }

            // Validate price
            if (!price || price === null || price === undefined) {
                throw new Error('Price is required for limit orders');
            }

            const parsedPrice = parseFloat(price);
            if (isNaN(parsedPrice) || parsedPrice <= 0) {
                throw new Error('Price must be a positive number greater than 0');
            }

            // Step 2: Convert quantity to appropriate size format for Delta Exchange
            const product = await this.getProductBySymbol(symbol);
            
            let orderSize;
            if (product && product.minSizeBase) {
                // Use the raw quantity as size - most crypto products expect decimal quantities
                orderSize = parseFloat(quantity);
                
                // Ensure size meets minimum requirements
                const minSize = parseFloat(product.minSizeBase) || 0.001;
                if (orderSize < minSize) {
                    throw new Error(`Order size ${orderSize} is below minimum size ${minSize} for ${symbol}`);
                }
                
                // Ensure size meets maximum requirements if specified
                if (product.maxSizeBase && orderSize > parseFloat(product.maxSizeBase)) {
                    throw new Error(`Order size ${orderSize} exceeds maximum size ${product.maxSizeBase} for ${symbol}`);
                }
            } else {
                // Fallback: use raw quantity without massive multiplication
                orderSize = parseFloat(quantity);
            }

            // Step 2: Create and validate order data
            const orderData = {
                product_id: parseInt(productId),
                side: side,
                size: orderSize,
                order_type: 'limit_order',
                limit_price: parsedPrice.toString()
            };

            const orderValidation = this.validateOrderData(orderData);
            if (!orderValidation.valid) {
                throw new Error(`Order data validation failed: ${orderValidation.error}`);
            }

            logger.info(`Placing ${side} limit order: ${quantity} ${symbol} at $${parsedPrice} (product_id: ${productId})`);
            
            const response = await this.makeRequest('POST', '/v2/orders', orderData);
            
            if (response.success) {
                logger.info(`Limit order placed successfully: ${response.result.id}`);
                return response.result;
            } else {
                throw new Error(`Failed to place limit order: ${response.error || 'Unknown API error'}`);
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
    async getPositions(symbol = null) {
        try {
            let endpoint = '/v2/positions';
            const params = {};
            
            if (symbol) {
                // If a specific symbol is requested, get the product_id
                const product = await this.getProductBySymbol(symbol);
                if (product && product.productId) {
                    params.product_id = product.productId;
                }
            } else {
                // For all positions, only check symbols that have active trades
                // This prevents unnecessary API calls for closed positions
                logger.info('Position API requires product_id, fetching for active trades only...');
                return await this.getPositionsForActiveTrades();
            }
            
            // Build URL with query parameters if needed
            if (Object.keys(params).length > 0) {
                const queryString = new URLSearchParams(params).toString();
                endpoint = `${endpoint}?${queryString}`;
            }
            
            const response = await this.makeRequest('GET', endpoint);
            return response.result || [];
        } catch (error) {
            logger.error('Error fetching positions:', error);
            throw error;
        }
    }

    // Helper method to get positions for symbols with active trades only
    async getPositionsForActiveTrades() {
        if (!this.db) {
            logger.warn('Database service not available, cannot get active trades');
            return [];
        }

        try {
            // Get all active trades from database
            const activeTrades = await this.db.getActiveTrades();
            
            if (activeTrades.length === 0) {
                logger.info('No active trades found, returning empty positions');
                return [];
            }

            // Extract unique symbols from active trades
            const activeSymbols = [...new Set(activeTrades.map(trade => trade.symbol))];
            logger.info(`Fetching positions for active symbols: ${activeSymbols.join(', ')}`);

            const allPositions = [];
            
            for (const symbol of activeSymbols) {
                try {
                    const product = await this.getProductBySymbol(symbol);
                    if (product && product.productId) {
                        const endpoint = `/v2/positions?product_id=${product.productId}`;
                        const response = await this.makeRequest('GET', endpoint);
                        if (response.result && response.result.entry_price !== null && response.result.size !== 0) {
                            // Only include positions that actually have an open position
                            // Add the symbol to the position data since Delta API doesn't include it
                            const positionWithSymbol = {
                                ...response.result,
                                symbol: symbol
                            };
                            allPositions.push(positionWithSymbol);
                            logger.info(`Found position for ${symbol}: size=${response.result.size}, entry_price=${response.result.entry_price}`);
                        } else {
                            logger.debug(`No open position for ${symbol} despite active trade`);
                        }
                    }
                } catch (error) {
                    logger.debug(`Error fetching position for ${symbol}:`, error.message);
                    // Continue with other symbols
                }
            }
            
            logger.info(`Found ${allPositions.length} open positions out of ${activeSymbols.length} active symbols`);
            return allPositions;
        } catch (error) {
            logger.error('Error fetching positions for active trades:', error);
            return [];
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

    // Close position by placing opposite market order
    async closePosition(symbol, positionSize) {
        try {
            logger.info(`Attempting to close position for ${symbol}, current size: ${positionSize}`);
            
            // Determine the side to close the position
            const side = positionSize > 0 ? 'sell' : 'buy';
            const quantity = Math.abs(positionSize);
            
            logger.info(`Placing ${side} market order for ${quantity} ${symbol} to close position`);
            
            // Place a market order in the opposite direction to close the position
            const result = await this.placeQuickOrder({
                symbol: symbol,
                side: side,
                type: 'market',
                quantity: quantity
            });
            
            logger.info(`Close position order result:`, result);
            return result;
            
        } catch (error) {
            logger.error(`Error closing position for ${symbol}:`, error);
            throw error;
        }
    }

    // Ultra-fast order placement with minimal validation and API calls
    async placeQuickOrder({ symbol, side, type = 'market', quantity, price = null }) {
        const startTime = Date.now();
        
        try {
            logger.info(`🚀 QUICK ORDER: ${side} ${quantity} ${symbol} (${type})`);
            
            // Step 1: Get product info from cache (no API call)
            const product = await this.getProductBySymbol(symbol);
            if (!product || !product.productId) {
                throw new Error(`Product not found for symbol: ${symbol}`);
            }
            
            // Step 2: Minimal validation
            const orderSize = parseFloat(quantity);
            if (isNaN(orderSize) || orderSize <= 0) {
                throw new Error('Invalid quantity');
            }
            
            // Step 3: Build order data quickly
            const orderData = {
                product_id: parseInt(product.productId),
                side: side,
                size: orderSize,
                order_type: type === 'market' ? 'market_order' : 'limit_order'
            };
            
            // Add price only for limit orders
            if (type === 'limit' && price) {
                orderData.limit_price = parseFloat(price).toString();
            } else if (type === 'market') {
                // For market orders, use a competitive limit price for faster fills
                try {
                    const ticker = await this.getTicker(symbol);
                    const marketPrice = side === 'buy' ? ticker.best_ask_price : ticker.best_bid_price;
                    if (marketPrice) {
                        // Use limit order at market price for better control
                        orderData.order_type = 'limit_order';
                        orderData.limit_price = parseFloat(marketPrice).toString();
                    }
                } catch (priceError) {
                    logger.warn(`Could not get market price, using pure market order: ${priceError.message}`);
                }
            }
            
            // Step 4: Send order directly (skip heavy validation)
            logger.info(`Quick order data:`, orderData);
            
            const response = await this.makeRequest('POST', '/v2/orders', orderData);
            
            if (response.success) {
                logger.info(`✅ QUICK ORDER PLACED: ${response.result.id} in ${Date.now() - startTime}ms`);
                return response.result;
            } else {
                throw new Error(`Order failed: ${response.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            logger.error('❌ QUICK ORDER FAILED:', error.message);
            throw error;
        }
    }
}

module.exports = DeltaExchangeService;