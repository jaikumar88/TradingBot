// Utility functions for the trading bot

/**
 * Format number as currency
 * @param {number} amount 
 * @param {string} currency 
 * @returns {string}
 */
function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
    }).format(amount);
}

/**
 * Format percentage
 * @param {number} value 
 * @param {number} decimals 
 * @returns {string}
 */
function formatPercentage(value, decimals = 2) {
    return `${value.toFixed(decimals)}%`;
}

/**
 * Calculate percentage change
 * @param {number} oldValue 
 * @param {number} newValue 
 * @returns {number}
 */
function calculatePercentageChange(oldValue, newValue) {
    return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Calculate risk-reward ratio
 * @param {number} entryPrice 
 * @param {number} stopLoss 
 * @param {number} takeProfit 
 * @returns {number}
 */
function calculateRiskReward(entryPrice, stopLoss, takeProfit) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    return reward / risk;
}

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Generate random ID
 * @param {number} length 
 * @returns {string}
 */
function generateRandomId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms 
 * @returns {Promise}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn 
 * @param {number} retries 
 * @param {number} delay 
 * @returns {Promise}
 */
async function retryWithBackoff(fn, retries = 3, delay = 1000) {
    try {
        return await fn();
    } catch (error) {
        if (retries > 0) {
            await sleep(delay);
            return retryWithBackoff(fn, retries - 1, delay * 2);
        }
        throw error;
    }
}

/**
 * Sanitize string for use in file names
 * @param {string} str 
 * @returns {string}
 */
function sanitizeFilename(str) {
    return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Truncate string to specified length
 * @param {string} str 
 * @param {number} maxLength 
 * @returns {string}
 */
function truncateString(str, maxLength = 100) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Deep clone object
 * @param {Object} obj 
 * @returns {Object}
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 * @param {Object} obj 
 * @returns {boolean}
 */
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

/**
 * Get time ago string
 * @param {Date} date 
 * @returns {string}
 */
function timeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, seconds] of Object.entries(intervals)) {
        const interval = Math.floor(diffInSeconds / seconds);
        if (interval > 0) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }
    
    return 'just now';
}

/**
 * Validate trading symbol format
 * @param {string} symbol 
 * @returns {boolean}
 */
function isValidSymbol(symbol) {
    // Check for common crypto trading pair formats
    const symbolRegex = /^[A-Z]{3,6}(USDT|USD|BTC|ETH)$/;
    return symbolRegex.test(symbol);
}

/**
 * Parse trading symbol to get base and quote currencies
 * @param {string} symbol 
 * @returns {Object}
 */
function parseSymbol(symbol) {
    const quoteCurrencies = ['USDT', 'USD', 'BTC', 'ETH'];
    
    for (const quote of quoteCurrencies) {
        if (symbol.endsWith(quote)) {
            return {
                base: symbol.slice(0, -quote.length),
                quote: quote,
                symbol: symbol
            };
        }
    }
    
    return null;
}

/**
 * Format trade duration
 * @param {Date} openTime 
 * @param {Date} closeTime 
 * @returns {string}
 */
function formatTradeDuration(openTime, closeTime = new Date()) {
    const duration = closeTime - openTime;
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

module.exports = {
    formatCurrency,
    formatPercentage,
    calculatePercentageChange,
    calculateRiskReward,
    isValidEmail,
    generateRandomId,
    sleep,
    retryWithBackoff,
    sanitizeFilename,
    truncateString,
    deepClone,
    isEmpty,
    timeAgo,
    isValidSymbol,
    parseSymbol,
    formatTradeDuration
};