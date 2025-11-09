const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

class TelegramService {
    constructor(config, onMessage) {
        this.config = config.telegram;
        this.onMessage = onMessage;
        this.allowedChats = new Set(this.config.allowedChats);
        
        // Check if we have a real bot token (starts with numbers and contains colon)
        const hasRealBotToken = this.config.botToken && 
                               this.config.botToken.includes(':') && 
                               !this.config.botToken.includes('test_') &&
                               /^\d+:/.test(this.config.botToken);
        
        this.isTestMode = !hasRealBotToken;
        
        if (this.isTestMode) {
            logger.info('🧪 Telegram service running in TEST MODE');
            logger.warn('💡 To connect to real Telegram, add a valid TELEGRAM_BOT_TOKEN to .env file');
            this.bot = null;
            this.setupTestMode();
        } else {
            logger.info('📱 Telegram service connecting to real bot...');
            this.bot = new TelegramBot(this.config.botToken, { polling: true });
            this.setupBot();
        }
    }

    setupTestMode() {
        logger.info('📱 Telegram Test Mode - Use the web interface to simulate messages');
        logger.info(`🔗 Dashboard: http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}`);
        
        // Simulate a test message after 5 seconds
        setTimeout(() => {
            this.simulateTestMessage();
        }, 5000);
    }

    simulateTestMessage() {
        const testMessage = {
            id: Date.now(),
            chatId: 'test-chat-123',
            chatTitle: 'Test Trading Group',
            chatType: 'group',
            text: 'BUY BTCUSDT at 45000, stop loss 43000, take profit 48000. Strong bullish signal with volume confirmation.',
            date: new Date(),
            from: {
                id: 'test-user',
                username: 'test_trader',
                firstName: 'Test'
            }
        };

        logger.info('🧪 Simulating test trading message...');
        if (this.onMessage) {
            this.onMessage(testMessage);
        }
    }

    setupBot() {
        this.bot.on('message', async (msg) => {
            try {
                await this.handleMessage(msg);
            } catch (error) {
                logger.error('Error handling Telegram message:', error);
            }
        });

        this.bot.on('polling_error', (error) => {
            logger.error('Telegram polling error:', error);
        });

        logger.info('Telegram bot initialized and listening for messages');
    }

    async handleMessage(msg) {
        const chatId = msg.chat.id.toString();
        const messageText = msg.text || msg.caption || '';
        const messageType = msg.chat.type; // 'private', 'group', 'supergroup', 'channel'
        const chatTitle = msg.chat.title || msg.chat.first_name || 'Unknown';
        const hasPhoto = msg.photo && msg.photo.length > 0;
        const hasDocument = msg.document;

        // Log message details
        logger.info(`Received message from ${messageType}: ${chatTitle} (${chatId})`);
        if (hasPhoto) {
            logger.info('📸 Message contains photo');
        }
        if (hasDocument) {
            logger.info('📄 Message contains document');
        }
        logger.debug(`Message: ${messageText}`);

        // Check if chat is allowed (if allowedChats is configured)
        if (this.allowedChats.size > 0 && !this.allowedChats.has(chatId)) {
            logger.warn(`Message from unauthorized chat: ${chatId}`);
            return;
        }

        // Skip messages with no text and no image
        if (!messageText && !hasPhoto && !hasDocument) {
            logger.debug('Skipping message with no text or media');
            return;
        }

        // Skip bot commands for now (you can extend this)
        if (messageText.startsWith('/')) {
            await this.handleCommand(msg);
            return;
        }

        // Handle images and text messages
        const shouldProcess = messageText && this.mightContainTradingSignal(messageText) || hasPhoto || hasDocument;
        
        if (shouldProcess) {
            if (hasPhoto || hasDocument) {
                logger.info('📊 Processing message with media for trading signals...');
            } else {
                logger.info('Message might contain trading signal, processing...');
            }
            
            let imageData = null;
            
            // Download image if present
            if (hasPhoto) {
                try {
                    // Get the largest photo size
                    const photo = msg.photo[msg.photo.length - 1];
                    imageData = await this.downloadPhoto(photo.file_id);
                } catch (error) {
                    logger.error('Failed to download photo:', error);
                }
            } else if (hasDocument && this.isImageDocument(msg.document)) {
                try {
                    imageData = await this.downloadDocument(msg.document.file_id);
                } catch (error) {
                    logger.error('Failed to download document:', error);
                }
            }
            
            const messageData = {
                id: msg.message_id,
                chatId: chatId,
                chatTitle: chatTitle,
                chatType: messageType,
                text: messageText,
                image: imageData,
                date: new Date(msg.date * 1000),
                from: {
                    id: msg.from?.id,
                    username: msg.from?.username,
                    firstName: msg.from?.first_name
                }
            };

            // Call the callback to process the message
            if (this.onMessage) {
                await this.onMessage(messageData);
            }
        }
    }

    async handleCommand(msg) {
        const command = msg.text.split(' ')[0].toLowerCase();
        const chatId = msg.chat.id;

        switch (command) {
            case '/start':
                await this.sendMessage(chatId, '🤖 Trading Bot activated! I will monitor this chat for trading signals.');
                break;
            case '/status':
                await this.sendMessage(chatId, '✅ Bot is running and monitoring messages.');
                break;
            case '/help':
                await this.sendMessage(chatId, 
                    '📋 Available commands:\n' +
                    '/start - Activate bot\n' +
                    '/status - Check bot status\n' +
                    '/help - Show this help message\n' +
                    '/trades - Show recent trades\n' +
                    '/stats - Show trading statistics'
                );
                break;
            default:
                // Ignore unknown commands
                break;
        }
    }

    mightContainTradingSignal(text) {
        const keywords = [
            'buy', 'sell', 'long', 'short', 'entry', 'exit',
            'target', 'tp', 'sl', 'stop loss', 'take profit',
            'btc', 'eth', 'bitcoin', 'ethereum', 'usdt',
            'bullish', 'bearish', 'pump', 'dump',
            'resistance', 'support', 'breakout',
            'signal', 'call', 'trade'
        ];

        const lowerText = text.toLowerCase();
        return keywords.some(keyword => lowerText.includes(keyword));
    }

    async sendMessage(chatId, text, options = {}) {
        try {
            if (this.isTestMode) {
                logger.info(`📤 [TEST MODE] Would send to ${chatId}: ${text}`);
                return { message_id: Date.now(), chat: { id: chatId } };
            }
            
            return await this.bot.sendMessage(chatId, text, {
                parse_mode: 'HTML',
                ...options
            });
        } catch (error) {
            logger.error(`Error sending message to ${chatId}:`, error);
            if (this.isTestMode) {
                return null;
            }
            throw error;
        }
    }

    async sendTradeNotification(chatId, trade, action) {
        const emoji = action === 'opened' ? '🟢' : action === 'closed' ? '🔴' : '🟡';
        const message = `
${emoji} <b>Trade ${action.toUpperCase()}</b>

<b>Symbol:</b> ${trade.symbol}
<b>Side:</b> ${trade.side.toUpperCase()}
<b>Quantity:</b> ${trade.quantity}
<b>Entry Price:</b> $${trade.entryPrice}
<b>Stop Loss:</b> $${trade.stopLoss}
<b>Take Profit:</b> $${trade.takeProfit}
<b>Status:</b> ${trade.status}
${trade.pnl !== 0 ? `<b>P&L:</b> $${trade.pnl.toFixed(2)}` : ''}
<b>Paper Trade:</b> ${trade.isPaperTrade ? 'Yes' : 'No'}
        `;

        return await this.sendMessage(chatId, message);
    }

    async notifyError(chatId, error, context = '') {
        const message = `❌ <b>Error</b>${context ? ` (${context})` : ''}:\n${error.message}`;
        return await this.sendMessage(chatId, message);
    }

    async downloadPhoto(fileId) {
        try {
            if (this.isTestMode) {
                logger.info(`📸 [TEST MODE] Simulating photo download: ${fileId}`);
                // Return a larger mock base64 image for testing (a proper small trading chart)
                // This is a small but valid PNG image that should work with image processing
                const testImageBase64 = '/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/wAARCABQAFADASIAAhEBAxEB/8QAGwAAAgMBAQEAAAAAAAAAAAAABAUDBgcCAAE//8QAOhAAAgEDAwMCBQEGBAYDAAAAAAECAwQRBQYhEjFBURMiYRQycYGRoQcjQrHB0RVi4fDxCCQzNHKS/8QAIREAAQMCBwEAAAAAAAAAAAAAAgEDBBESEyExQVFhcf/aAAwDAQACEQMRAD8AKx+l/wC6/J4PDjPHvT8/l99F3ydpR3bnLQ=='; // 80x80px JPEG chart
                logger.info(`📸 [TEST MODE] Using test chart image: ${testImageBase64.length} chars`);
                return testImageBase64;
            }

            logger.info(`📸 [REAL MODE] Downloading photo: ${fileId}`);
            const file = await this.bot.getFile(fileId);
            logger.info(`📸 File info: ${file.file_path}, size: ${file.file_size} bytes`);
            
            // Download file and get the file path
            const filePath = await this.bot.downloadFile(fileId, './temp/');
            logger.info(`📸 Downloaded to: ${filePath}`);
            
            // Read the actual file content
            const fs = require('fs');
            const buffer = fs.readFileSync(filePath);
            logger.info(`📸 Read buffer size: ${buffer.length} bytes`);
            
            // Convert buffer to base64
            const base64Image = buffer.toString('base64');
            logger.info(`📸 Base64 conversion complete: ${base64Image.length} chars`);
            
            // Clean up temp file
            fs.unlinkSync(filePath);
            
            return base64Image;
        } catch (error) {
            logger.error('Error downloading photo:', error);
            throw error;
        }
    }

    async downloadDocument(fileId) {
        try {
            if (this.isTestMode) {
                logger.info(`📄 [TEST MODE] Simulating document download: ${fileId}`);
                // Return a mock base64 image for testing (1x1 pixel PNG)
                return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            }

            const file = await this.bot.getFile(fileId);
            const buffer = await this.bot.downloadFile(fileId, './temp/');
            
            // Convert buffer to base64 for Ollama
            const base64Image = buffer.toString('base64');
            return base64Image;
        } catch (error) {
            logger.error('Error downloading document:', error);
            throw error;
        }
    }

    isImageDocument(document) {
        if (!document || !document.mime_type) return false;
        return document.mime_type.startsWith('image/');
    }
}

module.exports = TelegramService;