// Telegram Client Service for reading channel messages
// This replaces the bot approach for channels

const { TelegramApi } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const logger = require('../utils/logger');

class TelegramClientService {
    constructor(config, onMessage) {
        this.config = config;
        this.onMessage = onMessage;
        this.client = null;
        this.channelUsername = null; // e.g., 'crypto_trading_prt' 
        this.isConnected = false;
    }

    async initialize() {
        // You'll need these from https://my.telegram.org/apps
        const apiId = parseInt(process.env.TELEGRAM_API_ID);
        const apiHash = process.env.TELEGRAM_API_HASH;
        const stringSession = new StringSession(process.env.TELEGRAM_SESSION || '');

        if (!apiId || !apiHash) {
            logger.error('Missing TELEGRAM_API_ID and TELEGRAM_API_HASH for channel reading');
            logger.info('Get these from: https://my.telegram.org/apps');
            return false;
        }

        try {
            this.client = new TelegramApi(stringSession, apiId, apiHash, {
                connectionRetries: 5,
            });

            logger.info('🔗 Connecting to Telegram...');
            await this.client.start({
                phoneNumber: async () => await input.text('Please enter your phone number: '),
                password: async () => await input.text('Please enter your password: '),
                phoneCode: async () => await input.text('Please enter the code you received: '),
                onError: (err) => logger.error('Telegram connection error:', err),
            });

            this.isConnected = true;
            logger.info('✅ Connected to Telegram successfully!');
            
            // Save session for next time
            const session = this.client.session.save();
            logger.info('Session saved. Add this to your .env as TELEGRAM_SESSION:');
            logger.info(session);

            return true;
        } catch (error) {
            logger.error('Failed to connect to Telegram:', error);
            return false;
        }
    }

    async startChannelMonitoring(channelUsername) {
        if (!this.isConnected) {
            logger.error('Not connected to Telegram');
            return;
        }

        try {
            // Get channel entity
            const channel = await this.client.getEntity(channelUsername);
            logger.info(`📺 Monitoring channel: ${channel.title}`);

            // Listen for new messages
            this.client.addEventHandler(async (event) => {
                if (event.isChannel && event.message) {
                    await this.handleChannelMessage(event.message, channel);
                }
            });

            logger.info('🔄 Channel monitoring started');
        } catch (error) {
            logger.error('Error starting channel monitoring:', error);
        }
    }

    async handleChannelMessage(message, channel) {
        try {
            const messageData = {
                id: message.id,
                chatId: channel.id.toString(),
                chatTitle: channel.title,
                chatType: 'channel',
                text: message.message,
                date: new Date(message.date * 1000),
                from: {
                    id: 'channel',
                    username: channel.username,
                    firstName: channel.title
                }
            };

            logger.info(`📨 New channel message: ${messageData.text?.substring(0, 100)}...`);

            if (this.onMessage) {
                await this.onMessage(messageData);
            }
        } catch (error) {
            logger.error('Error handling channel message:', error);
        }
    }

    async getChannelHistory(channelUsername, limit = 10) {
        if (!this.isConnected) {
            logger.error('Not connected to Telegram');
            return [];
        }

        try {
            const channel = await this.client.getEntity(channelUsername);
            const messages = await this.client.getMessages(channel, { limit });
            
            return messages.map(msg => ({
                id: msg.id,
                text: msg.message,
                date: new Date(msg.date * 1000),
                views: msg.views
            }));
        } catch (error) {
            logger.error('Error getting channel history:', error);
            return [];
        }
    }
}

module.exports = TelegramClientService;