const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const Trade = require('../models/Trade');

class DatabaseService {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
        this.init();
    }

    async init() {
        try {
            // Ensure database directory exists
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // Connect to database
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logger.error('Error opening database:', err);
                    throw err;
                } else {
                    logger.info(`Database connected: ${this.dbPath}`);
                }
            });

            // Create tables
            await this.createTables();
        } catch (error) {
            logger.error('Database initialization error:', error);
            throw error;
        }
    }

    createTables() {
        return new Promise((resolve, reject) => {
            const createTradesTable = `
                CREATE TABLE IF NOT EXISTS trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    side TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    entryPrice REAL NOT NULL,
                    stopLoss REAL,
                    takeProfit REAL,
                    status TEXT DEFAULT 'pending',
                    telegramMessage TEXT,
                    aiAnalysis TEXT,
                    openTime DATETIME DEFAULT CURRENT_TIMESTAMP,
                    closeTime DATETIME,
                    pnl REAL DEFAULT 0,
                    fees REAL DEFAULT 0,
                    isPaperTrade BOOLEAN DEFAULT 1,
                    deltaOrderId TEXT,
                    stopLossOrderId TEXT,
                    takeProfitOrderId TEXT,
                    failReason TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            const createMessagesTable = `
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegramMessageId INTEGER,
                    chatId TEXT NOT NULL,
                    chatTitle TEXT,
                    chatType TEXT,
                    messageText TEXT NOT NULL,
                    messageDate DATETIME,
                    fromUserId INTEGER,
                    fromUsername TEXT,
                    isProcessed BOOLEAN DEFAULT 0,
                    hasSignal BOOLEAN DEFAULT 0,
                    aiAnalysis TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            const createTradeHistoryTable = `
                CREATE TABLE IF NOT EXISTS trade_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tradeId INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (tradeId) REFERENCES trades (id)
                )
            `;

            this.db.serialize(() => {
                this.db.run(createTradesTable);
                this.db.run(createMessagesTable);
                this.db.run(createTradeHistoryTable, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        // Add migration for failReason column if it doesn't exist
                        this.db.run(`ALTER TABLE trades ADD COLUMN failReason TEXT`, (migrationErr) => {
                            // Ignore error if column already exists
                            if (migrationErr && !migrationErr.message.includes('duplicate column')) {
                                logger.warn('Failed to add failReason column:', migrationErr.message);
                            }
                        });
                        
                        // Add migration for actualEntryPrice column if it doesn't exist
                        this.db.run(`ALTER TABLE trades ADD COLUMN actualEntryPrice REAL`, (migrationErr) => {
                            // Ignore error if column already exists
                            if (migrationErr && !migrationErr.message.includes('duplicate column')) {
                                logger.warn('Failed to add actualEntryPrice column:', migrationErr.message);
                            }
                        });
                        
                        logger.info('Database tables created successfully');
                        resolve();
                    }
                });
            });
        });
    }

    // Trade operations
    async saveTrade(trade) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO trades (
                    symbol, side, quantity, entryPrice, stopLoss, takeProfit,
                    status, telegramMessage, aiAnalysis, openTime, isPaperTrade, failReason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                trade.symbol,
                trade.side,
                trade.quantity,
                trade.entryPrice,
                trade.stopLoss,
                trade.takeProfit,
                trade.status,
                JSON.stringify(trade.telegramMessage),
                JSON.stringify(trade.aiAnalysis),
                trade.openTime.toISOString(),
                trade.isPaperTrade ? 1 : 0,
                trade.failReason || null
            ];

            this.db.run(sql, values, function(err) {
                if (err) {
                    logger.error('Error saving trade:', err);
                    reject(err);
                } else {
                    trade.id = this.lastID;
                    logger.info(`Trade saved with ID: ${trade.id}`);
                    resolve(trade);
                }
            });
        });
    }

    async updateTrade(tradeId, updates) {
        return new Promise((resolve, reject) => {
            const setClause = Object.keys(updates)
                .map(key => `${key} = ?`)
                .join(', ');
            
            const sql = `UPDATE trades SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
            const values = [...Object.values(updates), tradeId];

            this.db.run(sql, values, function(err) {
                if (err) {
                    logger.error('Error updating trade:', err);
                    reject(err);
                } else {
                    logger.info(`Trade updated: ${tradeId}`);
                    resolve({ id: tradeId, changes: this.changes });
                }
            });
        });
    }

    async getTrade(tradeId) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM trades WHERE id = ?';
            
            this.db.get(sql, [tradeId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? this.rowToTrade(row) : null);
                }
            });
        });
    }

    async getAllTrades(limit = 100, offset = 0) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM trades ORDER BY openTime DESC LIMIT ? OFFSET ?';
            
            this.db.all(sql, [limit, offset], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const trades = rows.map(row => this.rowToTrade(row));
                    resolve(trades);
                }
            });
        });
    }

    async getActiveTrades() {
        return new Promise((resolve, reject) => {
            const sql = "SELECT * FROM trades WHERE status IN ('pending', 'active') ORDER BY openTime DESC";
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const trades = rows.map(row => this.rowToTrade(row));
                    resolve(trades);
                }
            });
        });
    }

    async getTradesByStatus(status) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM trades WHERE status = ? ORDER BY openTime DESC';
            
            this.db.all(sql, [status], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const trades = rows.map(row => this.rowToTrade(row));
                    resolve(trades);
                }
            });
        });
    }

    // Message operations
    async saveMessage(messageData, aiAnalysis = null) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO messages (
                    telegramMessageId, chatId, chatTitle, chatType, messageText,
                    messageDate, fromUserId, fromUsername, hasSignal, aiAnalysis
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                messageData.id,
                messageData.chatId,
                messageData.chatTitle,
                messageData.chatType,
                messageData.text,
                messageData.date.toISOString(),
                messageData.from?.id,
                messageData.from?.username,
                aiAnalysis?.isSignal ? 1 : 0,
                aiAnalysis ? JSON.stringify(aiAnalysis) : null
            ];

            this.db.run(sql, values, function(err) {
                if (err) {
                    logger.error('Error saving message:', err);
                    reject(err);
                } else {
                    logger.debug(`Message saved with ID: ${this.lastID}`);
                    resolve({ id: this.lastID, ...messageData });
                }
            });
        });
    }

    // Trade history operations
    async addTradeHistory(tradeId, action, details) {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT INTO trade_history (tradeId, action, details) VALUES (?, ?, ?)';
            
            this.db.run(sql, [tradeId, action, JSON.stringify(details)], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    async getTradeHistory(tradeId) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM trade_history WHERE tradeId = ? ORDER BY timestamp ASC';
            
            this.db.all(sql, [tradeId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        ...row,
                        details: JSON.parse(row.details || '{}')
                    })));
                }
            });
        });
    }

    // Statistics
    async getTradingStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as totalTrades,
                    COUNT(CASE WHEN status = 'closed' THEN 1 END) as closedTrades,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as activeTrades,
                    COUNT(CASE WHEN status = 'closed' AND pnl > 0 THEN 1 END) as winningTrades,
                    COUNT(CASE WHEN status = 'closed' AND pnl < 0 THEN 1 END) as losingTrades,
                    SUM(CASE WHEN status = 'closed' THEN pnl ELSE 0 END) as totalPnl,
                    AVG(CASE WHEN status = 'closed' THEN pnl ELSE 0 END) as avgPnl,
                    MAX(CASE WHEN status = 'closed' THEN pnl ELSE 0 END) as maxWin,
                    MIN(CASE WHEN status = 'closed' THEN pnl ELSE 0 END) as maxLoss
                FROM trades
            `;
            
            this.db.get(sql, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const stats = {
                        ...row,
                        winRate: row.closedTrades > 0 ? (row.winningTrades / row.closedTrades * 100).toFixed(2) : 0
                    };
                    resolve(stats);
                }
            });
        });
    }

    // Utility method to convert database row to Trade object
    rowToTrade(row) {
        return new Trade({
            id: row.id,
            symbol: row.symbol,
            side: row.side,
            quantity: row.quantity,
            entryPrice: row.entryPrice,
            stopLoss: row.stopLoss,
            takeProfit: row.takeProfit,
            status: row.status,
            telegramMessage: row.telegramMessage ? JSON.parse(row.telegramMessage) : null,
            aiAnalysis: row.aiAnalysis ? JSON.parse(row.aiAnalysis) : null,
            openTime: new Date(row.openTime),
            closeTime: row.closeTime ? new Date(row.closeTime) : null,
            pnl: row.pnl,
            fees: row.fees,
            isPaperTrade: row.isPaperTrade === 1
        });
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    logger.error('Error closing database:', err);
                } else {
                    logger.info('Database connection closed');
                }
            });
        }
    }
}

module.exports = DatabaseService;