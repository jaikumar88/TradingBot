const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../data');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'trading-bot' },
    transports: [
        // Write all logs to file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                let log = `${timestamp} [${service}] ${level}: ${message}`;
                
                // Add metadata if present, with safe JSON stringification
                if (Object.keys(meta).length) {
                    try {
                        const metaStr = JSON.stringify(meta, null, 2);
                        if (metaStr && metaStr !== '{}') {
                            log += `\n${metaStr}`;
                        }
                    } catch (circularError) {
                        // Handle circular references
                        const seen = new WeakSet();
                        const safeStr = JSON.stringify(meta, (key, value) => {
                            if (typeof value === 'object' && value !== null) {
                                if (seen.has(value)) {
                                    return '[Circular]';
                                }
                                seen.add(value);
                            }
                            return value;
                        }, 2);
                        if (safeStr && safeStr !== '{}') {
                            log += `\n${safeStr}`;
                        }
                    }
                }
                
                return log;
            })
        ),
    }));
}

module.exports = logger;