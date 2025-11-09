// Trade model for database operations
class Trade {
    constructor({
        id = null,
        symbol,
        side, // 'buy' or 'sell'
        quantity,
        entryPrice,
        stopLoss,
        takeProfit,
        status = 'pending', // 'pending', 'active', 'closed', 'cancelled'
        telegramMessage,
        aiAnalysis,
        openTime = new Date(),
        closeTime = null,
        pnl = 0,
        fees = 0,
        isPaperTrade = true
    }) {
        this.id = id;
        this.symbol = symbol;
        this.side = side;
        this.quantity = quantity;
        this.entryPrice = entryPrice;
        this.stopLoss = stopLoss;
        this.takeProfit = takeProfit;
        this.status = status;
        this.telegramMessage = telegramMessage;
        this.aiAnalysis = aiAnalysis;
        this.openTime = openTime;
        this.closeTime = closeTime;
        this.pnl = pnl;
        this.fees = fees;
        this.isPaperTrade = isPaperTrade;
    }

    toJSON() {
        return {
            id: this.id,
            symbol: this.symbol,
            side: this.side,
            quantity: this.quantity,
            entryPrice: this.entryPrice,
            stopLoss: this.stopLoss,
            takeProfit: this.takeProfit,
            status: this.status,
            telegramMessage: this.telegramMessage,
            aiAnalysis: this.aiAnalysis,
            openTime: this.openTime,
            closeTime: this.closeTime,
            pnl: this.pnl,
            fees: this.fees,
            isPaperTrade: this.isPaperTrade
        };
    }
}

module.exports = Trade;