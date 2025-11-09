# 🤖 Trading Bot - Installation Guide

Follow these steps to get your trading bot up and running quickly.

## Quick Start

### 1. Prerequisites
- Node.js 16 or higher
- npm (comes with Node.js)
- Git (optional)

### 2. Installation
```bash
# Clone or download the project
# cd into the project directory
cd DeltaExchange-Trading

# Install dependencies
npm install
```

### 3. Configuration
```bash
# Run the setup wizard
npm run setup

# OR manually copy and edit the environment file
cp .env.example .env
# Edit .env with your credentials
```

### 4. Required API Keys

#### Telegram Bot Token
1. Open Telegram and search for @BotFather
2. Send `/newbot` and follow instructions
3. Copy the bot token to your .env file

#### OpenAI API Key  
1. Visit https://platform.openai.com/api-keys
2. Create an account if needed
3. Generate a new API key
4. Copy to your .env file

#### Delta Exchange (Optional for live trading)
1. Create account at https://www.delta.exchange/
2. Go to API Management in settings
3. Generate API key and secret
4. Copy to your .env file

### 5. Start the Bot
```bash
# Start in paper trading mode (recommended)
npm start

# Dashboard will be available at:
# http://localhost:3000
```

## Configuration Options

### Basic Setup (.env file)
```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
OPENAI_API_KEY=your_openai_key

# Optional
PAPER_TRADE=true  # Start with paper trading
PORT=3000         # Web dashboard port
LOG_LEVEL=info    # info, debug, warn, error
```

### Trading Configuration
```bash
DEFAULT_RISK_PERCENTAGE=2  # Risk per trade
MAX_POSITIONS=5           # Max concurrent trades
DEFAULT_LEVERAGE=1        # Trading leverage
```

## Getting Started Checklist

- [ ] ✅ Install Node.js 16+
- [ ] ✅ Run `npm install`
- [ ] ✅ Get Telegram bot token from @BotFather
- [ ] ✅ Get OpenAI API key
- [ ] ✅ Run `npm run setup` or copy .env.example to .env
- [ ] ✅ Configure environment variables
- [ ] ✅ Start with `npm start`
- [ ] ✅ Open http://localhost:3000
- [ ] ✅ Add bot to test Telegram group
- [ ] ✅ Test with sample trading messages

## Test the Setup

1. Add your bot to a Telegram group
2. Send a test message like: "BUY BTCUSDT at 45000, SL 43000, TP 48000"
3. Check the dashboard for signal detection
4. Verify trade appears in paper trading mode

## Troubleshooting

### Bot not responding
- Check TELEGRAM_BOT_TOKEN is correct
- Ensure bot is added to the group
- Check logs in data/combined.log

### OpenAI errors
- Verify OPENAI_API_KEY is valid
- Check API usage and billing
- Ensure sufficient API credits

### Dashboard not loading
- Check PORT configuration
- Verify no other service uses the same port
- Check firewall settings

## Support

- Check logs: `data/combined.log`
- Review README.md for detailed documentation
- Ensure all environment variables are set correctly

---

⚠️ **Important**: Always start with paper trading (PAPER_TRADE=true) to test the system safely before using real funds!