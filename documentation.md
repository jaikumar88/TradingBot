---
layout: default
title: Documentation
---

# 📚 Documentation

## Table of Contents
- [Installation](#installation)
- [Configuration](#configuration)
- [API Integration](#api-integration)
- [Trading Features](#trading-features)
- [Dashboard](#dashboard)
- [Troubleshooting](#troubleshooting)

## Installation

### Prerequisites
- Node.js 16 or higher
- Python 3.8+ (for advanced features)
- Telegram Bot Token
- OpenAI API Key (optional)
- Delta Exchange Account

### Quick Setup
```bash
git clone https://github.com/jaikumar88/TradingBot.git
cd TradingBot
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

## Configuration

### Environment Variables
```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id

# OpenAI (Optional)
OPENAI_API_KEY=your_openai_key

# Delta Exchange
DELTA_API_KEY=your_delta_api_key
DELTA_SECRET=your_delta_secret
DELTA_PASSPHRASE=your_passphrase

# Trading Settings
PAPER_TRADING=true
RISK_PERCENTAGE=2
```

## API Integration

### Delta Exchange Setup
1. Create account at [Delta Exchange](https://www.delta.exchange)
2. Generate API credentials
3. Whitelist your IP address
4. Configure webhook endpoints

### Telegram Bot Setup
1. Message [@BotFather](https://t.me/botfather)
2. Create new bot with `/newbot`
3. Get bot token
4. Add bot to your trading group

## Trading Features

### Automated Trading
- **Signal Detection**: AI analyzes messages for trading signals
- **Risk Management**: Configurable risk parameters
- **Stop Loss/Take Profit**: Automatic bracket orders
- **Position Sizing**: Dynamic sizing based on risk percentage

### Supported Order Types
- Market Orders
- Limit Orders
- Bracket Orders (Entry + SL + TP)
- Stop-Loss Orders

### Risk Management
- Maximum position size limits
- Slippage protection (1% default)
- Daily loss limits
- Drawdown protection

## Dashboard

### Features
- Real-time trade monitoring
- Performance analytics
- Risk metrics
- Trade history
- Portfolio overview

### Access
- Default URL: `http://localhost:3000`
- Mobile responsive design
- Real-time updates via WebSocket

## Troubleshooting

### Common Issues

#### Bot Not Starting
```bash
# Check Node.js version
node --version

# Check dependencies
npm install

# Check configuration
cat .env
```

#### API Connection Issues
- Verify API credentials
- Check IP whitelist
- Validate network connectivity

#### Trading Not Working
- Confirm paper trading mode
- Check Delta Exchange connection
- Verify signal format

### Support
- [GitHub Issues](https://github.com/jaikumar88/TradingBot/issues)
- [Community Discussions](https://github.com/jaikumar88/TradingBot/discussions)
- [Documentation Wiki](https://github.com/jaikumar88/TradingBot/wiki)