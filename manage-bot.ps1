# Delta Exchange Trading Bot Manager (PowerShell)
# Run this script to manage your trading bot easily

function Show-Menu {
    Clear-Host
    Write-Host "🤖 Delta Exchange Trading Bot - Background Manager" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[1] Start Trading Bot (Background)" -ForegroundColor Green
    Write-Host "[2] Stop Trading Bot" -ForegroundColor Red
    Write-Host "[3] Restart Trading Bot" -ForegroundColor Yellow
    Write-Host "[4] View Status" -ForegroundColor Blue
    Write-Host "[5] View Live Logs" -ForegroundColor Magenta
    Write-Host "[6] Open Dashboard" -ForegroundColor Cyan
    Write-Host "[7] Setup Auto-start on Boot" -ForegroundColor DarkYellow
    Write-Host "[8] Exit" -ForegroundColor Gray
    Write-Host ""
}

function Start-TradingBot {
    Write-Host "Starting Trading Bot in background..." -ForegroundColor Green
    pm2 start ecosystem.config.js
    Write-Host "✅ Trading Bot started! Dashboard: http://localhost:3000" -ForegroundColor Green
}

function Stop-TradingBot {
    Write-Host "Stopping Trading Bot..." -ForegroundColor Red
    pm2 stop trading-bot
    Write-Host "✅ Trading Bot stopped!" -ForegroundColor Green
}

function Restart-TradingBot {
    Write-Host "Restarting Trading Bot..." -ForegroundColor Yellow
    pm2 restart trading-bot
    Write-Host "✅ Trading Bot restarted!" -ForegroundColor Green
}

function Show-Status {
    Write-Host "Trading Bot Status:" -ForegroundColor Blue
    pm2 status
}

function Show-Logs {
    Write-Host "Live logs (Press Ctrl+C to exit):" -ForegroundColor Magenta
    pm2 logs trading-bot
}

function Open-Dashboard {
    Write-Host "Opening Dashboard..." -ForegroundColor Cyan
    Start-Process "http://localhost:3000"
}

function Setup-AutoStart {
    Write-Host "Setting up auto-start on boot..." -ForegroundColor DarkYellow
    pm2 startup
    Write-Host "After running the command above, execute: pm2 save" -ForegroundColor Yellow
}

# Main loop
do {
    Show-Menu
    $choice = Read-Host "Enter your choice (1-8)"
    
    switch ($choice) {
        "1" { Start-TradingBot; Read-Host "Press Enter to continue" }
        "2" { Stop-TradingBot; Read-Host "Press Enter to continue" }
        "3" { Restart-TradingBot; Read-Host "Press Enter to continue" }
        "4" { Show-Status; Read-Host "Press Enter to continue" }
        "5" { Show-Logs }
        "6" { Open-Dashboard }
        "7" { Setup-AutoStart; Read-Host "Press Enter to continue" }
        "8" { Write-Host "Goodbye! 👋" -ForegroundColor Green; break }
        default { Write-Host "Invalid choice. Please try again." -ForegroundColor Red; Start-Sleep 2 }
    }
} while ($choice -ne "8")