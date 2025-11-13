const Trade = require('../models/Trade');
const logger = require('../utils/logger');

class TradeManager {
    constructor(deltaService, databaseService, telegramService) {
        this.deltaService = deltaService;
        this.db = databaseService;
        this.telegram = telegramService;
        this.activeTrades = new Map();
        this.monitoringInterval = null;
        
        this.init();
    }

    async init() {
        // Load active trades from database
        await this.loadActiveTrades();
        
        // Start monitoring trades
        this.startTradeMonitoring();
        
        logger.info('Trade Manager initialized');
    }

    async loadActiveTrades() {
        try {
            const activeTrades = await this.db.getActiveTrades();
            activeTrades.forEach(trade => {
                this.activeTrades.set(trade.id, trade);
            });
            
            logger.info(`Loaded ${activeTrades.length} active trades`);
        } catch (error) {
            logger.error('Error loading active trades:', error);
        }
    }

    async processTradeSignal(aiAnalysis, messageData) {
        try {
            if (!aiAnalysis.isSignal) {
                logger.debug('No trading signal detected');
                return null;
            }

            // Check if this is a direct text-based trade for immediate execution
            if (aiAnalysis.directExecution) {
                logger.info(`🚀 DIRECT TEXT TRADE: ${aiAnalysis.side} ${aiAnalysis.symbol} - IMMEDIATE EXECUTION`);
                logger.info(`📊 Entry: ${aiAnalysis.entryPrice}, SL: ${aiAnalysis.stopLoss}, TP: ${aiAnalysis.takeProfit}`);
                
                // Execute immediately with direct execution flow
                return await this.executeDirectTrade(aiAnalysis, messageData);
            }

            logger.info(`Processing trade signal: ${aiAnalysis.side} ${aiAnalysis.symbol}`);

            // Create trade object
            const trade = new Trade({
                symbol: aiAnalysis.symbol,
                side: aiAnalysis.side,
                quantity: aiAnalysis.quantity,
                entryPrice: aiAnalysis.entryPrice,
                stopLoss: aiAnalysis.stopLoss,
                takeProfit: aiAnalysis.takeProfit,
                telegramMessage: messageData,
                aiAnalysis: aiAnalysis,
                isPaperTrade: this.deltaService.paperTrade
            });

            // Validate trade
            const validation = this.validateTrade(trade);
            if (!validation.isValid) {
                logger.warn('Trade validation failed:', validation.errors);
                return null;
            }

            // Save trade to database
            const savedTrade = await this.db.saveTrade(trade);
            
            // Add trade history
            await this.db.addTradeHistory(savedTrade.id, 'created', {
                source: 'telegram_signal',
                analysis: aiAnalysis
            });

            // Execute trade
            const executedTrade = await this.executeTrade(savedTrade);
            
            // Add to active trades if execution was successful
            if (executedTrade && executedTrade.status === 'active') {
                this.activeTrades.set(executedTrade.id, executedTrade);
            }

            // Send notification
            if (messageData.chatId) {
                await this.telegram.sendTradeNotification(
                    messageData.chatId, 
                    executedTrade, 
                    'opened'
                );
            }

            return executedTrade;

        } catch (error) {
            logger.error('Error processing trade signal:', error);
            
            // Send error notification
            if (messageData.chatId) {
                await this.telegram.notifyError(
                    messageData.chatId, 
                    error, 
                    'Trade Execution'
                );
            }
            
            throw error;
        }
    }

    validateTrade(trade) {
        const errors = [];

        // Check required fields
        if (!trade.symbol) errors.push('Symbol is required');
        if (!trade.side) errors.push('Side is required');
        if (!trade.quantity || trade.quantity <= 0) errors.push('Valid quantity is required');
        if (!trade.entryPrice || trade.entryPrice <= 0) errors.push('Valid entry price is required');

        // Check price logic
        if (trade.side === 'buy') {
            if (trade.stopLoss && trade.stopLoss >= trade.entryPrice) {
                errors.push('Stop loss should be below entry price for buy orders');
            }
            if (trade.takeProfit && trade.takeProfit <= trade.entryPrice) {
                errors.push('Take profit should be above entry price for buy orders');
            }
        } else if (trade.side === 'sell') {
            if (trade.stopLoss && trade.stopLoss <= trade.entryPrice) {
                errors.push('Stop loss should be above entry price for sell orders');
            }
            if (trade.takeProfit && trade.takeProfit >= trade.entryPrice) {
                errors.push('Take profit should be below entry price for sell orders');
            }
        }

        // Check risk/reward ratio
        if (trade.stopLoss && trade.takeProfit) {
            const risk = Math.abs(trade.entryPrice - trade.stopLoss);
            const reward = Math.abs(trade.takeProfit - trade.entryPrice);
            const riskRewardRatio = reward / risk;
            
            if (riskRewardRatio < 0.5) {
                errors.push('Risk/reward ratio too low (minimum 0.5:1)');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    async executeTrade(trade) {
        try {
            // Special handling for "follow" and "copy" modes - existing trade tracking
            if (trade.side === 'follow' || trade.side === 'copy') {
                const mode = trade.side === 'copy' ? 'Copying' : 'Following';
                logger.info(`📋 ${mode} existing trade setup for ${trade.symbol} at current market price`);
                return await this.executeFollowTrade(trade);
            }
            
            logger.info(`Executing trade: ${trade.side} ${trade.quantity} ${trade.symbol} at ${trade.entryPrice}`);

            // Validate ticker exists before executing trade
            const tickerValidation = await this.deltaService.validateTicker(trade.symbol);
            
            if (!tickerValidation.valid) {
                const errorMsg = `Trade rejected: Symbol ${trade.symbol} not found on Delta Exchange - ${tickerValidation.error}`;
                logger.error(errorMsg);
                
                await this.db.updateTrade(trade.id, { 
                    status: 'failed',
                    failReason: `Invalid symbol: ${trade.symbol}`
                });
                
                throw new Error(errorMsg);
            }

            // Use the validated symbol from the ticker check
            const normalizedSymbol = tickerValidation.symbol;
            const marketPrice = tickerValidation.price;
            const productId = tickerValidation.productId;
            
            logger.info(`✅ Ticker validated: ${normalizedSymbol} - Current price: $${marketPrice} - Product ID: ${productId}`);

            // If no entry price provided, use best bid price as fallback
            if (!trade.entryPrice || trade.entryPrice <= 0) {
                logger.info('🔄 No entry price provided, getting best bid price from order book...');
                
                try {
                    const orderBook = await this.deltaService.getOrderBook(normalizedSymbol);
                    const bestBidPrice = orderBook.bestBid;
                    
                    if (bestBidPrice && bestBidPrice > 0) {
                        trade.entryPrice = bestBidPrice;
                        logger.info(`✅ Using best bid price as entry price: $${bestBidPrice}`);
                        
                        // Update trade in database with the best bid price
                        await this.db.updateTrade(trade.id, { entryPrice: bestBidPrice });
                    } else {
                        const errorMsg = `🚫 Trade rejected: No valid best bid price available in order book`;
                        logger.error(errorMsg);
                        
                        await this.db.updateTrade(trade.id, { 
                            status: 'failed',
                            failReason: 'No valid best bid price available'
                        });
                        
                        throw new Error(errorMsg);
                    }
                } catch (orderBookError) {
                    const errorMsg = `🚫 Trade rejected: Failed to get order book data - ${orderBookError.message}`;
                    logger.error(errorMsg);
                    
                    await this.db.updateTrade(trade.id, { 
                        status: 'failed',
                        failReason: 'Failed to get order book data'
                    });
                    
                    throw new Error(errorMsg);
                }
            }

            // Validate entry price after potential fallback assignment
            if (!trade.entryPrice || trade.entryPrice <= 0) {
                const errorMsg = `🚫 Trade rejected: Invalid entry price after fallback: $${trade.entryPrice}`;
                logger.error(errorMsg);
                
                await this.db.updateTrade(trade.id, { 
                    status: 'failed',
                    failReason: 'Invalid entry price'
                });
                
                logger.info('🚫 Trade rejected - No API calls made to Delta Exchange');
                throw new Error(errorMsg);
            }

            // Check for price slippage (1% tolerance for all trades)
            const priceDifference = Math.abs(marketPrice - trade.entryPrice) / trade.entryPrice * 100;
            
            if (priceDifference > 1) {
                const errorMsg = `🚫 Trade rejected: Price slippage too high! Entry price: $${trade.entryPrice}, Current price: $${marketPrice.toFixed(2)} (${priceDifference.toFixed(2)}% difference)`;
                logger.error(errorMsg);
                
                await this.db.updateTrade(trade.id, { 
                    status: 'failed',
                    failReason: `Price slippage exceeded 1%: ${priceDifference.toFixed(2)}% difference`
                });
                
                // Add trade history for rejection
                await this.db.addTradeHistory(trade.id, 'rejected_slippage', {
                    entryPrice: trade.entryPrice,
                    marketPrice: marketPrice,
                    slippagePercent: priceDifference.toFixed(2)
                });
                
                logger.info('🚫 Trade rejected - No API calls made to Delta Exchange');
                throw new Error(errorMsg);
            }
            
            logger.info(`✅ Price slippage check passed: ${priceDifference.toFixed(2)}% (within 1% tolerance)`);

            // Handle percentage-based stop loss and take profit
            if (trade.aiAnalysis && trade.aiAnalysis.stopLossPercent !== undefined) {
                const stopLossPercent = trade.aiAnalysis.stopLossPercent;
                trade.stopLoss = trade.entryPrice * (1 + stopLossPercent / 100);
                logger.info(`📊 Calculated stop loss from ${stopLossPercent}%: $${trade.stopLoss.toFixed(2)}`);
                await this.db.updateTrade(trade.id, { stopLoss: trade.stopLoss });
            }

            if (trade.aiAnalysis && trade.aiAnalysis.takeProfitPercent !== undefined) {
                const takeProfitPercent = trade.aiAnalysis.takeProfitPercent;
                trade.takeProfit = trade.entryPrice * (1 + takeProfitPercent / 100);
                logger.info(`📊 Calculated take profit from ${takeProfitPercent}%: $${trade.takeProfit.toFixed(2)}`);
                await this.db.updateTrade(trade.id, { takeProfit: trade.takeProfit });
            }

            // Place entry order with bracket (stop loss and take profit in one request)
            const entryOrder = await this.deltaService.placeMarketOrder(
                normalizedSymbol,
                trade.side,
                trade.quantity,
                productId,
                trade.stopLoss,    // Stop loss price
                trade.takeProfit  // Take profit price
            );

            // Update trade with order details
            const updates = {
                status: 'active',
                deltaOrderId: entryOrder.id,
                entryPrice: marketPrice, // Use actual market price
                symbol: normalizedSymbol // Update symbol to normalized version
            };

            await this.db.updateTrade(trade.id, updates);
            await this.db.addTradeHistory(trade.id, 'bracket_order_placed', {
                orderId: entryOrder.id,
                marketPrice: marketPrice,
                stopLoss: trade.stopLoss,
                takeProfit: trade.takeProfit
            });

            logger.info(`✅ Bracket order placed successfully: ${entryOrder.id}`);
            logger.info(`🎯 Delta Exchange will handle SL: $${trade.stopLoss} and TP: $${trade.takeProfit}`);

            // Get updated trade
            const updatedTrade = await this.db.getTrade(trade.id);
            logger.info(`Trade executed successfully: ${trade.id}`);

            return updatedTrade;

        } catch (error) {
            logger.error('Error executing trade:', error);
            
            // Mark trade as failed
            await this.db.updateTrade(trade.id, { status: 'failed' });
            await this.db.addTradeHistory(trade.id, 'execution_failed', {
                error: error.message
            });

            throw error;
        }
    }

    async executeDirectTrade(aiAnalysis, messageData) {
        try {
            logger.info(`🚀 DIRECT TRADE EXECUTION: ${aiAnalysis.side} ${aiAnalysis.symbol}`);

            // Create trade object for direct execution
            const trade = new Trade({
                symbol: aiAnalysis.symbol,
                side: aiAnalysis.side,
                quantity: aiAnalysis.quantity,
                entryPrice: aiAnalysis.entryPrice,
                stopLoss: aiAnalysis.stopLoss,
                takeProfit: aiAnalysis.takeProfit,
                telegramMessage: messageData,
                aiAnalysis: aiAnalysis,
                isPaperTrade: this.deltaService.paperTrade,
                directExecution: true
            });

            // Save trade to database first
            const savedTrade = await this.db.saveTrade(trade);
            
            // Add trade history
            await this.db.addTradeHistory(savedTrade.id, 'created', {
                source: 'direct_text_signal',
                analysis: aiAnalysis
            });

            // Validate ticker exists before executing trade
            const tickerValidation = await this.deltaService.validateTicker(savedTrade.symbol);
            
            if (!tickerValidation.valid) {
                const errorMsg = `Trade rejected: Symbol ${savedTrade.symbol} not found on Delta Exchange - ${tickerValidation.error}`;
                logger.error(errorMsg);
                
                await this.db.updateTrade(savedTrade.id, { 
                    status: 'failed',
                    failReason: `Invalid symbol: ${savedTrade.symbol}`
                });
                
                throw new Error(errorMsg);
            }

            // Use the validated symbol and product ID
            const normalizedSymbol = tickerValidation.symbol;
            const marketPrice = tickerValidation.price;
            const productId = tickerValidation.productId;
            
            logger.info(`✅ Ticker validated: ${normalizedSymbol} - Current price: $${marketPrice} - Product ID: ${productId}`);
            logger.info(`📊 Signal prices - Entry: $${savedTrade.entryPrice}, SL: $${savedTrade.stopLoss}, TP: $${savedTrade.takeProfit}`);

            // Validate entry price before proceeding
            if (!savedTrade.entryPrice || savedTrade.entryPrice <= 0) {
                const errorMsg = `🚫 Trade rejected: Invalid entry price: $${savedTrade.entryPrice}`;
                logger.error(errorMsg);
                
                await this.db.updateTrade(savedTrade.id, { 
                    status: 'failed',
                    failReason: 'Invalid entry price'
                });
                
                logger.info('🚫 Trade rejected - No API calls made to Delta Exchange');
                throw new Error(errorMsg);
            }

            // Check for price slippage (1% tolerance)
            const priceDifference = Math.abs(marketPrice - savedTrade.entryPrice) / savedTrade.entryPrice * 100;
            
            if (priceDifference > 1) {
                const errorMsg = `🚫 Trade rejected: Price slippage too high! Entry price: $${savedTrade.entryPrice}, Current price: $${marketPrice.toFixed(2)} (${priceDifference.toFixed(2)}% difference)`;
                logger.error(errorMsg);
                
                await this.db.updateTrade(savedTrade.id, { 
                    status: 'failed',
                    failReason: `Price slippage exceeded 1%: ${priceDifference.toFixed(2)}% difference`
                });
                
                // Add trade history for rejection
                await this.db.addTradeHistory(savedTrade.id, 'rejected_slippage', {
                    entryPrice: savedTrade.entryPrice,
                    marketPrice: marketPrice,
                    slippagePercent: priceDifference.toFixed(2)
                });
                
                logger.info('🚫 Trade rejected - No API calls made to Delta Exchange');
                throw new Error(errorMsg);
            }
            
            logger.info(`✅ Price slippage check passed: ${priceDifference.toFixed(2)}% (within 1% tolerance)`);

            // Place entry order with bracket (stop loss and take profit in one request)
            const entryOrder = await this.deltaService.placeMarketOrder(
                normalizedSymbol,
                savedTrade.side,
                savedTrade.quantity,
                productId,
                savedTrade.stopLoss,    // Stop loss price
                savedTrade.takeProfit  // Take profit price
            );

            // Update trade with order details
            const updates = {
                status: 'active',
                deltaOrderId: entryOrder.id,
                actualEntryPrice: marketPrice, // Use actual market price
                symbol: normalizedSymbol // Update symbol to normalized version
            };

            await this.db.updateTrade(savedTrade.id, updates);
            await this.db.addTradeHistory(savedTrade.id, 'bracket_order_placed', {
                orderId: entryOrder.id,
                marketPrice: marketPrice,
                signalPrice: savedTrade.entryPrice,
                stopLoss: savedTrade.stopLoss,
                takeProfit: savedTrade.takeProfit
            });

            logger.info(`✅ Bracket order placed successfully: ${entryOrder.id}`);
            logger.info(`🎯 Delta Exchange will handle SL: $${savedTrade.stopLoss} and TP: $${savedTrade.takeProfit}`);

            // Get updated trade and add to active trades
            const executedTrade = await this.db.getTrade(savedTrade.id);
            this.activeTrades.set(executedTrade.id, executedTrade);

            logger.info(`🎉 DIRECT TRADE EXECUTED SUCCESSFULLY!`);
            logger.info(`📊 Trade ID: ${executedTrade.id}`);
            logger.info(`💹 ${savedTrade.side.toUpperCase()} ${savedTrade.symbol} at $${marketPrice}`);

            // Send notification if chat ID is available
            if (messageData.chatId) {
                await this.telegram.sendTradeNotification(
                    messageData.chatId, 
                    executedTrade, 
                    'opened'
                );
            }

            return executedTrade;

        } catch (error) {
            logger.error('❌ Error executing direct trade:', error.message);
            
            // Send error notification
            if (messageData.chatId) {
                await this.telegram.notifyError(
                    messageData.chatId, 
                    error, 
                    'Direct Trade Execution'
                );
            }
            
            throw error;
        }
    }

    async closeTrade(tradeId, reason = 'manual', exitPrice = null) {
        try {
            const trade = this.activeTrades.get(tradeId) || await this.db.getTrade(tradeId);
            if (!trade) {
                throw new Error(`Trade not found: ${tradeId}`);
            }

            logger.info(`Closing trade: ${tradeId} (${reason})`);

            // Cancel any open orders first
            if (trade.stopLossOrderId) {
                try {
                    await this.deltaService.cancelOrder(trade.stopLossOrderId);
                    logger.info(`Cancelled stop loss order: ${trade.stopLossOrderId}`);
                } catch (error) {
                    logger.warn('Error cancelling stop loss order:', error);
                }
            }

            if (trade.takeProfitOrderId) {
                try {
                    await this.deltaService.cancelOrder(trade.takeProfitOrderId);
                    logger.info(`Cancelled take profit order: ${trade.takeProfitOrderId}`);
                } catch (error) {
                    logger.warn('Error cancelling take profit order:', error);
                }
            }

            // Actually close the position on Delta Exchange (if not paper trading)
            let closeOrderResult = null;
            if (!this.deltaService.paperTrade) {
                try {
                    // Place opposite market order to close position
                    const closeSide = trade.side === 'buy' ? 'sell' : 'buy';
                    closeOrderResult = await this.deltaService.placeMarketOrder(
                        trade.symbol,
                        closeSide,
                        trade.quantity,
                        trade.productId
                    );
                    logger.info(`Placed closing order for trade ${tradeId}: ${closeOrderResult.id}`);
                } catch (error) {
                    logger.error(`Error placing closing order for trade ${tradeId}:`, error);
                    throw new Error(`Failed to close position on exchange: ${error.message}`);
                }
            }

            // Get exit price
            if (!exitPrice) {
                exitPrice = await this.deltaService.getMarketPrice(trade.symbol);
            }

            // Calculate P&L
            const pnl = this.calculatePnL(trade, exitPrice);

            // Update trade in database
            const updates = {
                status: 'closed',
                closeTime: new Date().toISOString(),
                pnl: pnl,
                exitPrice: exitPrice,
                closeOrderId: closeOrderResult ? closeOrderResult.id : null
            };

            await this.db.updateTrade(trade.id, updates);
            await this.db.addTradeHistory(trade.id, 'closed', {
                reason: reason,
                exitPrice: exitPrice,
                pnl: pnl,
                closeOrderId: closeOrderResult ? closeOrderResult.id : null
            });

            // Update paper trading balance
            if (this.deltaService.paperTrade) {
                this.deltaService.updatePaperBalance(pnl);
            }

            // Remove from active trades
            this.activeTrades.delete(tradeId);

            // Get updated trade
            const closedTrade = await this.db.getTrade(trade.id);

            logger.info(`Trade closed: ${tradeId}, P&L: $${pnl.toFixed(2)}`);

            return closedTrade;

        } catch (error) {
            logger.error('Error closing trade:', error);
            throw error;
        }
    }

    calculatePnL(trade, exitPrice) {
        const entryValue = trade.entryPrice * trade.quantity;
        const exitValue = exitPrice * trade.quantity;
        
        if (trade.side === 'buy') {
            return exitValue - entryValue;
        } else {
            return entryValue - exitValue;
        }
    }

    startTradeMonitoring() {
        // Monitor trades every 30 seconds
        this.monitoringInterval = setInterval(async () => {
            await this.monitorTrades();
        }, 30000);

        logger.info('Trade monitoring started');
    }

    async monitorTrades() {
        try {
            for (const [tradeId, trade] of this.activeTrades) {
                await this.checkTradeStatus(trade);
            }
        } catch (error) {
            logger.error('Error monitoring trades:', error);
        }
    }

    async checkTradeStatus(trade) {
        try {
            // Get current market price
            const currentPrice = await this.deltaService.getMarketPrice(trade.symbol);
            
            // Check if stop loss or take profit should be triggered
            let shouldClose = false;
            let closeReason = '';

            if (trade.side === 'buy') {
                if (trade.stopLoss && currentPrice <= trade.stopLoss) {
                    shouldClose = true;
                    closeReason = 'stop_loss';
                } else if (trade.takeProfit && currentPrice >= trade.takeProfit) {
                    shouldClose = true;
                    closeReason = 'take_profit';
                }
            } else if (trade.side === 'sell') {
                if (trade.stopLoss && currentPrice >= trade.stopLoss) {
                    shouldClose = true;
                    closeReason = 'stop_loss';
                } else if (trade.takeProfit && currentPrice <= trade.takeProfit) {
                    shouldClose = true;
                    closeReason = 'take_profit';
                }
            }

            if (shouldClose) {
                logger.info(`Trade ${trade.id} triggered ${closeReason} at price ${currentPrice}`);
                await this.closeTrade(trade.id, closeReason, currentPrice);
            }

        } catch (error) {
            logger.error(`Error checking trade status for ${trade.id}:`, error);
        }
    }

    async getTradePerformance() {
        try {
            const stats = await this.db.getTradingStats();
            const paperStats = this.deltaService.getPaperTradingStats();
            
            return {
                ...stats,
                paperTrading: paperStats
            };
        } catch (error) {
            logger.error('Error getting trade performance:', error);
            throw error;
        }
    }

    stopTradeMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            logger.info('Trade monitoring stopped');
        }
    }

    async executeFollowTrade(trade) {
        try {
            logger.info(`📋 === EXECUTING FOLLOW TRADE ===`);
            logger.info(`🎯 Following existing trade setup for ${trade.symbol}`);
            
            // Get current market price as the entry point
            const marketPrice = await this.deltaService.getMarketPrice(trade.symbol);
            logger.info(`💰 Current market price for ${trade.symbol}: $${marketPrice}`);
            
            // Calculate stop loss and take profit from percentages
            let actualStopLoss, actualTakeProfit;
            
            // Since it's "follow" mode, we assume it's a neutral tracking position
            // We'll use small, conservative percentages for monitoring
            const stopLossPercent = trade.stopLossPercent || 0.5; // 0.5% default
            const takeProfitPercent = Math.abs(trade.takeProfitPercent || 1.5); // 1.5% default
            
            actualStopLoss = marketPrice * (1 - stopLossPercent / 100);
            actualTakeProfit = marketPrice * (1 + takeProfitPercent / 100);
            
            logger.info(`📊 Follow Trade Parameters:`);
            logger.info(`   - Entry Price: $${marketPrice} (current market)`);
            logger.info(`   - Stop Loss: $${actualStopLoss.toFixed(2)} (${stopLossPercent}% below)`);
            logger.info(`   - Take Profit: $${actualTakeProfit.toFixed(2)} (${takeProfitPercent}% above)`);
            
            // Update trade with actual values
            trade.entryPrice = marketPrice;
            trade.stopLoss = actualStopLoss;
            trade.takeProfit = actualTakeProfit;
            trade.side = 'buy'; // Convert follow to buy for tracking purposes
            trade.status = 'filled';
            trade.tradeMode = 'follow_existing';
            
            // Create paper trade order for tracking
            const orderId = `follow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Place the tracking order
            const orderResult = await this.deltaService.placeOrder({
                symbol: trade.symbol,
                side: 'buy',
                quantity: trade.quantity,
                orderType: 'market',
                paper: true // Always paper trade for follow mode
            });
            
            if (orderResult) {
                logger.info(`📋 Follow tracking order placed: ${orderResult.id}`);
                trade.orderId = orderResult.id;
                
                // Update trade in database
                await this.db.updateTrade(trade.id, {
                    orderId: orderResult.id,
                    entryPrice: marketPrice,
                    stopLoss: actualStopLoss,
                    takeProfit: actualTakeProfit,
                    status: 'filled',
                    side: 'buy',
                    tradeMode: 'follow_existing'
                });
                
                // Add to monitoring
                this.activeTrades.set(trade.id, trade);
                
                // Log trade execution
                await this.db.addTradeHistory(trade.id, 'follow_executed', {
                    entryPrice: marketPrice,
                    stopLoss: actualStopLoss,
                    takeProfit: actualTakeProfit,
                    orderId: orderResult.id,
                    mode: 'follow_existing'
                });
                
                logger.info(`✅ Follow trade setup complete: tracking ${trade.symbol} from $${marketPrice}`);
                
                return {
                    success: true,
                    trade: trade,
                    orderId: orderResult.id,
                    mode: 'follow_existing',
                    message: `Following existing trade setup for ${trade.symbol} at $${marketPrice}`
                };
            } else {
                throw new Error('Failed to place follow tracking order');
            }
            
        } catch (error) {
            logger.error('Error executing follow trade:', error);
            
            // Mark trade as failed
            await this.db.updateTrade(trade.id, { 
                status: 'failed',
                failReason: `Follow trade execution failed: ${error.message}`
            });
            
            throw error;
        }
    }

    // Validate trade input parameters
    validateTradeInputs({ symbol, side, quantity, type }) {
        try {
            // Validate symbol
            if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
                return { valid: false, error: 'Symbol is required and must be a non-empty string' };
            }

            // Validate side
            const validSides = ['buy', 'sell', 'long', 'short'];
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

            if (parsedQuantity > 1000) {
                return { valid: false, error: 'Quantity is too large (max: 1000)' };
            }

            if (parsedQuantity < 0.001) {
                return { valid: false, error: 'Quantity is too small (min: 0.001)' };
            }

            // Validate type
            const validTypes = ['market', 'limit'];
            if (type && !validTypes.includes(type.toLowerCase())) {
                return { valid: false, error: `Order type must be one of: ${validTypes.join(', ')}` };
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: `Validation error: ${error.message}` };
        }
    }

    // Create manual trade for quick trade functionality
    async createManualTrade({ symbol, side, quantity, type = 'market', source = 'manual' }) {
        try {
            logger.info(`Creating manual trade: ${side} ${quantity} ${symbol} (${type})`);

            // Step 1: Validate input parameters
            const validation = this.validateTradeInputs({ symbol, side, quantity, type });
            if (!validation.valid) {
                throw new Error(`Trade validation failed: ${validation.error}`);
            }

            // Step 2: Validate ticker and get product information
            const tickerValidation = await this.deltaService.validateTicker(symbol);
            
            if (!tickerValidation.valid) {
                throw new Error(`Invalid symbol: ${symbol} - ${tickerValidation.error}`);
            }

            const normalizedSymbol = tickerValidation.symbol;
            const marketPrice = tickerValidation.price;
            const productId = tickerValidation.productId;
            
            // Step 3: Validate product ID exists
            if (!productId || productId === null || productId === undefined) {
                throw new Error(`Product ID not found for symbol ${normalizedSymbol}. Cannot place order without product_id.`);
            }
            
            logger.info(`✅ Symbol validated: ${normalizedSymbol} - Price: $${marketPrice} - Product ID: ${productId}`);

            // Get best bid price from order book for entry price
            let entryPrice;
            try {
                const orderBook = await this.deltaService.getOrderBook(normalizedSymbol);
                const bestBidPrice = orderBook.bestBid;
                
                if (bestBidPrice && bestBidPrice > 0) {
                    entryPrice = bestBidPrice;
                    logger.info(`✅ Using best bid price as entry price: $${bestBidPrice}`);
                } else {
                    // Fallback to market price if no best bid available
                    entryPrice = marketPrice;
                    logger.warn(`⚠️ No best bid available, using market price: $${marketPrice}`);
                }
            } catch (orderBookError) {
                // Fallback to market price if order book fails
                entryPrice = marketPrice;
                logger.warn(`⚠️ Order book failed, using market price: $${marketPrice} - ${orderBookError.message}`);
            }

            // Create trade data
            const tradeData = {
                symbol: normalizedSymbol,
                side: side.toLowerCase(),
                quantity: parseFloat(quantity),
                entryPrice: entryPrice,
                stopLoss: null,
                takeProfit: null,
                source: source,
                message: `Manual ${side} trade for ${normalizedSymbol}`,
                confidence: 1.0,
                reason: `Quick trade: ${side} ${quantity} ${normalizedSymbol}`,
                openTime: new Date(),
                isPaperTrade: false,
                telegramMessage: null,
                aiAnalysis: null
            };

            // For quick trades, execute immediately
            if (type === 'market') {
                // Place market order directly
                const entryOrder = await this.deltaService.placeMarketOrder(
                    normalizedSymbol,
                    side.toLowerCase(),
                    parseFloat(quantity),
                    productId,
                    null, // No stop loss for quick trades
                    null  // No take profit for quick trades
                );

                // Save trade to database
                const savedTrade = await this.db.saveTrade({
                    ...tradeData,
                    status: 'active',
                    deltaOrderId: entryOrder.id
                });

                // Add to active trades
                this.activeTrades.set(savedTrade.id, savedTrade);

                // Add trade history
                await this.db.addTradeHistory(savedTrade.id, 'quick_trade_placed', {
                    orderId: entryOrder.id,
                    marketPrice: marketPrice,
                    source: source
                });

                logger.info(`✅ Quick trade executed: ${side} ${quantity} ${normalizedSymbol} @ $${marketPrice}`);

                return {
                    id: savedTrade.id,
                    orderId: entryOrder.id,
                    symbol: normalizedSymbol,
                    side: side.toLowerCase(),
                    quantity: parseFloat(quantity),
                    price: marketPrice,
                    status: 'active'
                };
            } else {
                throw new Error('Only market orders are supported for quick trades');
            }

        } catch (error) {
            logger.error('Error creating manual trade:', error);
            throw error;
        }
    }
}

module.exports = TradeManager;