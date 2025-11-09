# Trading Bot UI Controls Documentation

## Overview

The trading bot now includes comprehensive UI controls that allow you to toggle between different operational modes without restarting the application.

## New Features Added

### 1. Configuration API Endpoints

#### GET /api/config
Returns the current configuration status:
```json
{
    "success": true,
    "data": {
        "useTestAI": false,
        "isPaperTrading": true
    }
}
```

#### POST /api/config
Updates the configuration:
```json
{
    "useTestAI": true,
    "isPaperTrading": false
}
```

### 2. UI Control Panel

The dashboard now includes a "Trading Controls" panel with two toggle switches:

#### AI Mode Toggle
- **Test AI Mode**: Uses mock OpenAI responses for testing
- **Live AI Mode**: Uses real OpenAI API for analysis
- Controls the `USE_TEST_AI` environment variable
- Icon: Brain (🧠)

#### Trading Mode Toggle
- **Paper Trading**: Simulates trades without real money
- **Live Trading**: Executes real trades on Delta Exchange
- Controls the `PAPER_TRADING` environment variable
- Icon: Chart Bar (📊)

### 3. Real-time Configuration Updates

All configuration changes are applied immediately without requiring a restart:

- OpenAI Service checks `process.env.USE_TEST_AI` on each message analysis
- Delta Exchange Service checks `process.env.PAPER_TRADING` for trade execution
- UI provides immediate feedback on mode changes

## Environment Variables

### New Configuration Variables

```env
# Use test AI instead of real OpenAI API
USE_TEST_AI=false

# Keep existing paper trading setting as default
PAPER_TRADING=true
```

## How It Works

### Backend Implementation

1. **WebServer Controller**
   - Added `/api/config` endpoints
   - Handles GET and POST requests for configuration
   - Updates environment variables in real-time

2. **OpenAI Service**
   - Checks `USE_TEST_AI` environment variable on each analysis
   - Falls back to test mode if OpenAI API fails
   - Uses `gpt-4o-mini` model for better cost efficiency

3. **Delta Exchange Service**
   - Checks `PAPER_TRADING` environment variable for each trade
   - Seamlessly switches between paper and live trading
   - Maintains separate paper trading state

### Frontend Implementation

1. **Control Panel UI**
   - Toggle switches with clear labels
   - Real-time status updates
   - Warning message for live trading mode

2. **JavaScript Functions**
   - `loadConfig()`: Loads current configuration from API
   - `updateConfig()`: Sends configuration updates to API
   - `setupConfigToggles()`: Sets up event listeners for toggles

## Usage Instructions

### To Switch to Live AI Mode:

1. Open the dashboard at `http://localhost:3000`
2. Locate the "Trading Controls" panel
3. Toggle the "AI Mode" switch to the right (Live AI Mode)
4. The system will immediately start using real OpenAI API

### To Switch to Live Trading:

1. **⚠️ WARNING**: Only do this when confident in the system!
2. Toggle the "Trading Mode" switch to the right (Live Trading)
3. Configure real Delta Exchange API credentials in `.env`
4. The system will start executing real trades

### Safety Features

- **Warning Alert**: Displayed when switching to live modes
- **Real-time Feedback**: Status messages show current mode
- **Immediate Effect**: No restart required for changes
- **Fallback Handling**: Graceful degradation if APIs fail

## Testing the Features

### Test AI Mode Toggle:

1. Send a test message to your Telegram bot
2. Check the logs - should see "Using test AI mode"
3. Toggle to Live AI Mode in UI
4. Send another message
5. Check logs - should see real OpenAI API calls

### Test Trading Mode Toggle:

1. Generate a trade signal (real or test)
2. In Paper Trading mode, check paper trade simulation
3. Toggle to Live Trading mode (if you have real APIs configured)
4. Generate another trade signal
5. Check if real API calls are made

## API Integration Status

### Current Configuration:
- **OpenAI API**: ✅ Real key configured, ready for live use
- **Telegram Bot**: ✅ Real bot token, receiving messages
- **Delta Exchange**: ⚠️ Still in paper trading mode (recommended for testing)

### Next Steps for Live Trading:
1. Test the Live AI mode thoroughly with paper trading
2. Configure real Delta Exchange API credentials
3. Start with small test amounts when switching to live trading
4. Monitor the dashboard closely for any issues

## Troubleshooting

### Common Issues:

1. **Toggle not working**: Check browser console for JavaScript errors
2. **Config not saving**: Check server logs for API errors  
3. **OpenAI not switching**: Verify API key is correctly set in `.env`
4. **Paper trading not working**: Check Delta Exchange service logs

### Debugging:

- Check browser Network tab for failed API calls
- Monitor server logs for configuration changes
- Verify environment variables are being updated correctly

## Security Considerations

- Live trading requires real API credentials with trading permissions
- Always test thoroughly in paper trading mode first
- Monitor positions and balances when using live trading
- Keep API keys secure and never commit them to version control

## Future Enhancements

Possible future additions:
- Position size controls in UI
- Risk management settings
- Trading hours configuration
- Performance analytics controls
- Alert system configuration