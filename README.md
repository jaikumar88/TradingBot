# 🤖 Delta Exchange Trading Bot

An automated trading bot that reads messages from Telegram chats/groups, analyzes them using OpenAI, and executes trades on Delta Exchange. The bot includes comprehensive trade management, paper trading mode, and a real-time dashboard.

## 🚀 Features

- **📱 Telegram Integration**: Monitors messages from specified chats and groups
- **🧠 AI Analysis**: Uses OpenAI GPT-4 to analyze messages for trading signals
- **💹 Delta Exchange Trading**: Automated trade execution with stop-loss and take-profit
- **📊 Paper Trading**: Test the system without real money
- **📈 Real-time Dashboard**: Web interface for monitoring trades and performance
- **🗃️ Trade History**: Complete record keeping with SQLite database
- **⚡ Risk Management**: Configurable risk parameters and validation
- **🔄 Auto-monitoring**: Continuous trade monitoring and position management

## 📋 Prerequisites

- Node.js 16+ 
- Telegram Bot Token
- OpenAI API Key
- Delta Exchange Account (optional for live trading)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DeltaExchange-Trading
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env file with your credentials
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

5. **Access the dashboard**
   Open http://localhost:3000 in your browser

## ⚙️ Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` |
| `OPENAI_API_KEY` | Your OpenAI API key | `sk-...` |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_ALLOWED_CHATS` | Comma-separated chat IDs to monitor | All chats |
| `DELTA_API_KEY` | Delta Exchange API key | Required for live trading |
| `DELTA_API_SECRET` | Delta Exchange API secret | Required for live trading |
| `PAPER_TRADE` | Enable paper trading mode | `true` |
| `DEFAULT_RISK_PERCENTAGE` | Default risk per trade | `2` |
| `MAX_POSITIONS` | Maximum concurrent positions | `5` |
| `PORT` | Web server port | `3000` |

## 🔧 Setup Guide

### 1. Create Telegram Bot

1. Message @BotFather on Telegram
2. Send `/newbot` and follow instructions
3. Save the bot token to your `.env` file
4. Add your bot to the groups you want to monitor

### 2. Get Chat IDs

1. Add your bot to a group/chat
2. Send a message in the group
3. Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find your chat ID in the response
5. Add chat IDs to `TELEGRAM_ALLOWED_CHATS` (optional)

### 3. Get OpenAI API Key

1. Visit [OpenAI API](https://platform.openai.com/)
2. Create an account and navigate to API keys
3. Generate a new API key
4. Add it to your `.env` file

### 4. Delta Exchange Setup (Optional)

1. Create account at [Delta Exchange](https://www.delta.exchange/)
2. Generate API credentials in account settings
3. Add credentials to `.env` file
4. Set `PAPER_TRADE=false` for live trading

## 📊 Dashboard Features

- **Real-time Statistics**: Total P&L, win rate, active trades
- **Trade Management**: View, monitor, and manually close trades
- **Paper Trading Status**: Track paper trading performance
- **Trade History**: Complete transaction history with AI analysis
- **Performance Metrics**: Detailed analytics and reporting

## 🔍 How It Works

1. **Message Monitoring**: Bot listens to configured Telegram chats/groups
2. **Signal Detection**: AI analyzes messages for trading keywords and patterns
3. **Signal Analysis**: OpenAI extracts trade parameters (entry, stop-loss, take-profit)
4. **Trade Validation**: System validates trade parameters and risk management
5. **Trade Execution**: Automated order placement on Delta Exchange
6. **Trade Monitoring**: Continuous monitoring for stop-loss/take-profit triggers
7. **Record Keeping**: All trades and decisions stored in database

## 🔒 Security & Risk Management

- **Paper Trading**: Default mode for testing without real money
- **Risk Validation**: Automatic validation of risk/reward ratios
- **Position Limits**: Configurable maximum concurrent positions
- **Stop-Loss**: Automatic stop-loss orders for all trades
- **Environment Isolation**: Separate testnet and live trading environments

## 🤖 AI Signal Analysis

The bot uses OpenAI to analyze messages for:

- **Trading Signals**: Buy/sell recommendations
- **Entry Points**: Specific price levels
- **Stop-Loss Levels**: Risk management points
- **Take-Profit Targets**: Profit-taking levels
- **Confidence Scoring**: Signal quality assessment

## 📁 Project Structure

```
src/
├── app.js                 # Main application entry point
├── models/
│   ├── Trade.js          # Trade data model
│   └── Config.js         # Configuration model
├── services/
│   ├── TelegramService.js    # Telegram bot integration
│   ├── OpenAIService.js      # AI message analysis
│   ├── DeltaExchangeService.js # Exchange API integration
│   ├── DatabaseService.js    # Database operations
│   └── TradeManager.js       # Trade execution and management
├── controllers/
│   └── WebServer.js      # Web dashboard API
├── utils/
│   ├── logger.js         # Logging utility
│   └── helpers.js        # Helper functions
public/
├── index.html            # Dashboard UI
└── dashboard.js          # Frontend JavaScript
config/                   # Configuration files
data/                     # Database and logs
```

## 📝 API Endpoints

- `GET /api/trades` - Get all trades
- `GET /api/trades/:id` - Get specific trade
- `POST /api/trades/:id/close` - Close a trade
- `GET /api/stats` - Get trading statistics
- `GET /api/balance` - Get account balance
- `GET /api/health` - Health check

## 🚦 Status Monitoring

Monitor bot status via:
- Web dashboard at http://localhost:3000
- Log files in `data/` directory
- API health endpoint at `/api/health`

## ⚠️ Important Notes

- **Start with Paper Trading**: Always test with `PAPER_TRADE=true` first
- **Monitor Performance**: Regularly review trades and adjust AI prompts if needed
- **Security**: Keep API keys secure and never commit them to version control
- **Backup**: Regularly backup your `data/trading.db` file
- **Testing**: Thoroughly test signal detection with your specific Telegram groups

## 🔧 Troubleshooting

### Common Issues

1. **Bot not receiving messages**
   - Ensure bot is added to the group
   - Check if bot has proper permissions
   - Verify TELEGRAM_BOT_TOKEN

2. **OpenAI analysis failing**
   - Verify OPENAI_API_KEY is valid
   - Check API rate limits and billing
   - Monitor logs for specific errors

3. **Delta Exchange connection issues**
   - Verify API credentials
   - Check network connectivity
   - Ensure proper API permissions

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

## 📞 Support

For issues and questions:
1. Check the logs in `data/combined.log`
2. Review the troubleshooting section
3. Ensure all environment variables are properly set

## ⚖️ License

This project is licensed under the MIT License.

## ⚠️ Disclaimer

This trading bot is for educational and testing purposes. Cryptocurrency trading involves significant risk. Never trade with money you cannot afford to lose. Always start with paper trading mode and thoroughly test the system before using real funds.

## 🚀 Getting Started Checklist

- [ ] Install Node.js 16+
- [ ] Clone repository and install dependencies
- [ ] Create Telegram bot and get token
- [ ] Get OpenAI API key
- [ ] Copy `.env.example` to `.env` and configure
- [ ] Start with `PAPER_TRADE=true`
- [ ] Run `npm start`
- [ ] Open dashboard at http://localhost:3000
- [ ] Add bot to test Telegram group
- [ ] Send test trading messages
- [ ] Monitor dashboard for signals and trades
- [ ] Review and adjust configuration as needed
