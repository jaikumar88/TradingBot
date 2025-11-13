Write-Host "========================================"
Write-Host "       DELTA TRADING BOT - START"
Write-Host "========================================"

Write-Host "Setting up environment..."

# Add npm global paths to current session
$env:PATH += ";C:\Users\Owner\npm-global;$env:APPDATA\npm"

# Check if PM2 is available
try {
    pm2 --version | Out-Null
    Write-Host "✅ PM2 is available"
}
catch {
    Write-Host "❌ PM2 not found. Installing PM2..."
    npm install -g pm2
    $env:PATH += ";C:\Users\Owner\npm-global;$env:APPDATA\npm"
    Write-Host "✅ PM2 installed!"
}

Write-Host ""
Write-Host "Starting Trading Bot in background..."

# Check if trading-bot is already running
try {
    $result = pm2 describe trading-bot 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "🔄 Trading Bot already running, restarting..."
        pm2 restart trading-bot
        Write-Host "✅ Trading Bot Restarted Successfully!"
    }
    else {
        Write-Host "🆕 Starting new trading bot instance..."
        pm2 start src/app.js --name "trading-bot" --time
        Write-Host "✅ Trading Bot Started Successfully!"
    }
}
catch {
    Write-Host "🆕 Starting new trading bot instance..."
    pm2 start src/app.js --name "trading-bot" --time
    Write-Host "✅ Trading Bot Started Successfully!"
}

Write-Host ""
Write-Host "✅ Trading Bot Started Successfully!"
Write-Host ""
Write-Host "📊 Dashboard: http://localhost:3000"
Write-Host "📝 View Logs: pm2 logs trading-bot"
Write-Host "⚡ Check Status: pm2 status"
Write-Host ""
Write-Host "Press any key to exit..."
Read-Host