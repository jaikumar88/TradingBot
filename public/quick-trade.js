// Quick Trade Functionality
let quickTradeCurrentSymbol = '';
let quickTradeCurrentPosition = null;
let quickTradeUpdateInterval = null;
let quickTradeCurrentSide = 'long'; // Track current side for toggle
let quickTradeInProgress = false; // Flag to prevent multiple simultaneous trades
let quickTradeEventListenersSetup = false; // Flag to prevent duplicate event listeners

// Initialize quick trade functionality
function initializeQuickTrade() {
    console.log('Initializing quick trade...');
    loadQuickTradeSymbols();
    setupQuickTradeEventListeners();
    setupQuickTradeKeyboardShortcuts();
    console.log('Quick trade initialization complete');
}

// Load symbols for quick trade
async function loadQuickTradeSymbols() {
    console.log('Loading quick trade symbols...');
    try {
        const response = await fetch('/api/symbols');
        const data = await response.json();
        
        console.log('Symbols API response:', data);
        
        const symbolSelect = document.getElementById('quick-trade-symbol');
        symbolSelect.innerHTML = '<option value="">Select symbol...</option>';
        
        if (data.success && data.data) {
            // Add popular symbols first
            const popularSymbols = ['BTCUSD', 'ETHUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSD', 'ADAUSD'];
            const otherSymbols = data.data.filter(s => !popularSymbols.includes(s));
            
            popularSymbols.forEach(symbol => {
                if (data.data.includes(symbol)) {
                    const option = document.createElement('option');
                    option.value = symbol;
                    option.textContent = symbol;
                    symbolSelect.appendChild(option);
                }
            });
            
            // Add separator
            if (popularSymbols.length > 0) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '─────────────';
                symbolSelect.appendChild(separator);
            }
            
            // Add remaining symbols
            otherSymbols.forEach(symbol => {
                const option = document.createElement('option');
                option.value = symbol;
                option.textContent = symbol;
                symbolSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading symbols:', error);
        showNotification('Failed to load symbols', 'error');
    }
}

// Setup event listeners
function setupQuickTradeEventListeners() {
    // Prevent duplicate event listener setup
    if (quickTradeEventListenersSetup) {
        console.log('Quick trade event listeners already setup, skipping...');
        return;
    }
    
    const symbolSelect = document.getElementById('quick-trade-symbol');
    if (symbolSelect) {
        symbolSelect.addEventListener('change', function() {
            quickTradeCurrentSymbol = this.value;
            onQuickTradeSymbolChange();
        });
    }
    
    const quantityInput = document.getElementById('quick-trade-quantity');
    if (quantityInput) {
        quantityInput.addEventListener('input', validateQuickTradeQuantity);
    }
    
    // Add event listeners for quick trade buttons with single execution protection
    const longBtn = document.getElementById('quick-long-btn');
    const shortBtn = document.getElementById('quick-short-btn');
    
    if (longBtn) {
        // Remove any existing listeners first
        longBtn.replaceWith(longBtn.cloneNode(true));
        const newLongBtn = document.getElementById('quick-long-btn');
        newLongBtn.addEventListener('click', () => executeQuickTrade('long'));
    }
    
    if (shortBtn) {
        // Remove any existing listeners first
        shortBtn.replaceWith(shortBtn.cloneNode(true));
        const newShortBtn = document.getElementById('quick-short-btn');
        newShortBtn.addEventListener('click', () => executeQuickTrade('short'));
    }
    
    // Reverse trade button
    const reverseBtn = document.getElementById('reverse-quick-trade-btn');
    if (reverseBtn) {
        reverseBtn.addEventListener('click', reverseQuickTrade);
    }
    
    // Quantity adjustment buttons
    const decreaseBtn = document.querySelector('button[title="Decrease quantity (Q)"]');
    const increaseBtn = document.querySelector('button[title="Increase quantity (W)"]');
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => adjustQuickTradeQuantity(-1));
    }
    
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => adjustQuickTradeQuantity(1));
    }
    
    // Preset quantity buttons using data attributes
    const quantityButtons = document.querySelectorAll('button[data-quantity]');
    quantityButtons.forEach(btn => {
        const quantity = parseFloat(btn.getAttribute('data-quantity'));
        btn.addEventListener('click', () => setQuickTradeQuantity(quantity));
    });
    
    // Active trades refresh button
    const refreshActiveBtn = document.getElementById('refresh-active-btn');
    if (refreshActiveBtn) {
        refreshActiveBtn.addEventListener('click', loadActiveTrades);
    }
    
    // Mark event listeners as setup
    quickTradeEventListenersSetup = true;
    console.log('Quick trade event listeners setup complete');
}

// Symbol change handler
function onQuickTradeSymbolChange() {
    if (quickTradeCurrentSymbol) {
        document.getElementById('quick-trade-no-symbol').style.display = 'none';
        document.getElementById('quick-trade-position-info').style.display = 'block';
        startQuickTradeUpdates();
        updateQuickTradePosition();
    } else {
        document.getElementById('quick-trade-no-symbol').style.display = 'block';
        document.getElementById('quick-trade-position-info').style.display = 'none';
        stopQuickTradeUpdates();
        hideReverseButton();
    }
}

// Start real-time updates
function startQuickTradeUpdates() {
    stopQuickTradeUpdates(); // Clear any existing interval
    quickTradeUpdateInterval = setInterval(() => {
        updateQuickTradeMarketData();
        updateQuickTradePosition();
    }, 5000); // Reduce frequency from 1s to 5s to reduce API load
    
    // Initial update
    updateQuickTradeMarketData();
}

// Stop updates
function stopQuickTradeUpdates() {
    if (quickTradeUpdateInterval) {
        clearInterval(quickTradeUpdateInterval);
        quickTradeUpdateInterval = null;
    }
}

// Update market data
async function updateQuickTradeMarketData() {
    if (!quickTradeCurrentSymbol) return;
    
    try {
        // Get lightweight price data specifically for quick trades
        const response = await fetch(`/api/quick-price/${quickTradeCurrentSymbol}`);
        const data = await response.json();
        
        if (data.success && data.price) {
            const priceData = data.price;
            const price = priceData.markPrice || priceData.lastPrice || priceData.bestAsk;
            
            document.getElementById('quick-market-price').textContent = `$${price.toFixed(2)}`;
            
            // Show spread info if available
            if (priceData.spread) {
                const spreadElement = document.getElementById('quick-price-change');
                if (spreadElement) {
                    spreadElement.textContent = `Spread: $${priceData.spread.toFixed(3)}`;
                    spreadElement.style.color = 'var(--text-secondary)';
                }
            }
            
            // Store current prices for quick trade execution
            window.quickTradePrices = {
                bestBid: priceData.bestBid,
                bestAsk: priceData.bestAsk,
                markPrice: priceData.markPrice
            };
        }
    } catch (error) {
        console.error('Error fetching quick trade price data:', error);
    }
}

// Update position info
async function updateQuickTradePosition() {
    if (!quickTradeCurrentSymbol) return;
    
    try {
        const response = await fetch('/api/positions');
        const data = await response.json();
        
        if (data.success && data.positions) {
            const position = data.positions.find(p => p.symbol === quickTradeCurrentSymbol);
            quickTradeCurrentPosition = position;
            
            if (position && Math.abs(position.size) > 0.001) {
                showQuickTradePosition(position);
                showReverseButton();
            } else {
                hideQuickTradePosition();
                hideReverseButton();
            }
        }
    } catch (error) {
        console.error('Error fetching positions:', error);
        hideQuickTradePosition();
        hideReverseButton();
    }
}

// Show position details
function showQuickTradePosition(position) {
    document.getElementById('quick-position-details').style.display = 'block';
    document.getElementById('quick-no-position').style.display = 'none';
    
    document.getElementById('quick-position-size').textContent = Math.abs(position.size).toFixed(3);
    document.getElementById('quick-entry-price').textContent = `$${position.entry_price.toFixed(2)}`;
    
    const side = position.size > 0 ? 'LONG' : 'SHORT';
    const sideElement = document.getElementById('quick-position-side');
    sideElement.textContent = side;
    sideElement.style.color = position.size > 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    
    const pnl = position.unrealized_pnl || 0;
    const pnlElement = document.getElementById('quick-position-pnl');
    pnlElement.textContent = `$${pnl.toFixed(2)}`;
    pnlElement.style.color = pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
}

// Hide position details
function hideQuickTradePosition() {
    document.getElementById('quick-position-details').style.display = 'none';
    document.getElementById('quick-no-position').style.display = 'block';
    quickTradeCurrentPosition = null;
}

// Show/Hide reverse button
function showReverseButton() {
    document.getElementById('quick-reverse-container').style.display = 'block';
}

function hideReverseButton() {
    document.getElementById('quick-reverse-container').style.display = 'none';
}

// Quantity controls
function adjustQuickTradeQuantity(direction) {
    const quantityInput = document.getElementById('quick-trade-quantity');
    let currentQuantity = parseFloat(quantityInput.value) || 0;
    
    const increment = direction > 0 ? 0.1 : -0.1;
    currentQuantity += increment;
    currentQuantity = Math.max(0.001, Math.round(currentQuantity * 1000) / 1000);
    
    quantityInput.value = currentQuantity.toFixed(3);
    validateQuickTradeQuantity();
}

function setQuickTradeQuantity(amount) {
    const quantityInput = document.getElementById('quick-trade-quantity');
    quantityInput.value = amount.toFixed(3);
    validateQuickTradeQuantity();
}

function validateQuickTradeQuantity() {
    const quantityInput = document.getElementById('quick-trade-quantity');
    let quantity = parseFloat(quantityInput.value);
    
    if (isNaN(quantity) || quantity <= 0) {
        quantityInput.style.borderColor = 'var(--accent-red)';
        return false;
    }
    
    quantityInput.style.borderColor = 'var(--border-primary)';
    return true;
}

// Trade execution
async function executeQuickTrade(side) {
    console.log('executeQuickTrade called with side:', side);
    
    // Prevent multiple simultaneous trades
    if (quickTradeInProgress) {
        console.log('Trade already in progress, ignoring duplicate request');
        showNotification('Trade already in progress', 'warning');
        return;
    }
    
    if (!quickTradeCurrentSymbol) {
        console.log('No symbol selected');
        showNotification('Please select a symbol', 'error');
        return;
    }
    
    if (!validateQuickTradeQuantity()) {
        console.log('Invalid quantity');
        showNotification('Please enter a valid quantity', 'error');
        return;
    }
    
    const quantity = parseFloat(document.getElementById('quick-trade-quantity').value);
    
    // Set flag to prevent multiple calls
    quickTradeInProgress = true;
    
    // Add visual feedback that trade is processing
    const longBtn = document.getElementById('quick-long-btn');
    const shortBtn = document.getElementById('quick-short-btn');
    const originalText = side === 'long' ? longBtn.innerHTML : shortBtn.innerHTML;
    const targetBtn = side === 'long' ? longBtn : shortBtn;
    
    targetBtn.innerHTML = '⏳ Processing...';
    targetBtn.disabled = true;
    
    // Also disable the other button to prevent switching during execution
    const otherBtn = side === 'long' ? shortBtn : longBtn;
    otherBtn.disabled = true;
    
    targetBtn.innerHTML = '⏳ Processing...';
    targetBtn.disabled = true;
    
    try {
        const startTime = Date.now();
        console.log(`⚡ QUICK TRADE: ${side} ${quantity} ${quickTradeCurrentSymbol}`);
        
        // Reduced timeout for faster failure detection
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout (reduced from 30)
        
        const response = await fetch('/api/quick-trade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                symbol: quickTradeCurrentSymbol,
                side: side,
                quantity: quantity,
                type: 'market'
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        const executionTime = Date.now() - startTime;
        
        console.log('Quick trade response:', data, `in ${executionTime}ms`);
        
        if (data.success) {
            const finalTime = data.execution_time_ms || executionTime;
            console.log(`⚡ TRADE COMPLETED in ${finalTime}ms`);
            showNotification(`${side.toUpperCase()} order placed: ${quantity} ${quickTradeCurrentSymbol} (${finalTime}ms)`, 'success');
            updateQuickTradePosition(); // Refresh position immediately
            loadActiveTrades(); // Refresh the active trades list
        } else {
            console.error(`❌ TRADE FAILED in ${executionTime}ms:`, data.error);
            showNotification(`Failed to place order: ${data.error}`, 'error');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('Quick trade request timed out');
            showNotification('Trade request timed out. Please try again.', 'error');
        } else {
            console.error('Error executing quick trade:', error);
            showNotification('Failed to execute trade', 'error');
        }
    } finally {
        // Reset flag and restore button states
        quickTradeInProgress = false;
        targetBtn.innerHTML = originalText;
        targetBtn.disabled = false;
        otherBtn.disabled = false;
    }
}

// Reverse trade
async function reverseQuickTrade() {
    if (!quickTradeCurrentPosition || !quickTradeCurrentSymbol) {
        showNotification('No position to reverse', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/reverse-trade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                symbol: quickTradeCurrentSymbol
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Position reversed for ${quickTradeCurrentSymbol}`, 'success');
            updateQuickTradePosition(); // Refresh position immediately
        } else {
            showNotification(`Failed to reverse position: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error reversing trade:', error);
        showNotification('Failed to reverse trade', 'error');
    }
}

// Toggle trade side
function toggleQuickTradeSide() {
    quickTradeCurrentSide = quickTradeCurrentSide === 'long' ? 'short' : 'long';
    
    const longBtn = document.getElementById('quick-long-btn');
    const shortBtn = document.getElementById('quick-short-btn');
    
    if (quickTradeCurrentSide === 'long') {
        longBtn.style.opacity = '1';
        shortBtn.style.opacity = '0.7';
    } else {
        longBtn.style.opacity = '0.7';
        shortBtn.style.opacity = '1';
    }
    
    showNotification(`Quick trade side: ${quickTradeCurrentSide.toUpperCase()}`, 'info');
}

// Keyboard shortcuts
function setupQuickTradeKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Only handle shortcuts when not in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Prevent default for our shortcuts
        const shortcutKeys = ['KeyQ', 'KeyW', 'KeyL', 'KeyS', 'KeyR', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
        if (shortcutKeys.includes(e.code)) {
            e.preventDefault();
        }
        
        switch (e.code) {
            case 'KeyQ': // Decrease quantity
                adjustQuickTradeQuantity(-1);
                break;
            case 'KeyW': // Increase quantity
                adjustQuickTradeQuantity(1);
                break;
            case 'KeyL': // Long
                executeQuickTrade('long');
                break;
            case 'KeyS': // Short
                executeQuickTrade('short');
                break;
            case 'KeyR': // Reverse
                reverseQuickTrade();
                break;
            case 'Space': // Toggle side
                toggleQuickTradeSide();
                break;
            case 'Digit1': // Quick amounts
                setQuickTradeQuantity(0.1);
                break;
            case 'Digit2':
                setQuickTradeQuantity(0.5);
                break;
            case 'Digit3':
                setQuickTradeQuantity(1);
                break;
            case 'Digit4':
                setQuickTradeQuantity(2);
                break;
            case 'Digit5':
                setQuickTradeQuantity(5);
                break;
        }
    });
}

// Cleanup function
function cleanupQuickTrade() {
    stopQuickTradeUpdates();
}

// Active Trades Management
async function loadActiveTrades() {
    try {
        // Update button state
        const refreshBtn = document.getElementById('refresh-active-btn');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<span>⏳</span> Loading...';
            refreshBtn.disabled = true;
        }

        const response = await fetch('/api/trades?status=active');
        const data = await response.json();

        if (data.success) {
            displayActiveTrades(data.data);
        } else {
            showNotification('Failed to load active trades', 'error');
        }
    } catch (error) {
        console.error('Error loading active trades:', error);
        showNotification('Failed to load active trades', 'error');
    } finally {
        // Reset button state
        const refreshBtn = document.getElementById('refresh-active-btn');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<span>🔄</span> Refresh';
            refreshBtn.disabled = false;
        }
    }
}

function displayActiveTrades(trades) {
    const noTradesEl = document.getElementById('no-active-trades');
    const tradesListEl = document.getElementById('active-trades-list');

    if (!trades || trades.length === 0) {
        if (noTradesEl) noTradesEl.style.display = 'block';
        if (tradesListEl) {
            tradesListEl.style.display = 'none';
            tradesListEl.innerHTML = '';
        }
        
        // Update active trades counter in stats
        const activeTradesEl = document.getElementById('active-trades');
        if (activeTradesEl) activeTradesEl.textContent = '0';
        
        return;
    }

    if (noTradesEl) noTradesEl.style.display = 'none';
    if (tradesListEl) tradesListEl.style.display = 'block';

    // Update active trades counter in stats
    const activeTradesEl = document.getElementById('active-trades');
    if (activeTradesEl) activeTradesEl.textContent = trades.length;

    if (tradesListEl) {
        tradesListEl.innerHTML = trades.map(trade => createActiveTradeHTML(trade)).join('');
    }
}

function createActiveTradeHTML(trade) {
    const pnl = trade.current_pnl || 0;
    const pnlClass = pnl >= 0 ? 'positive' : 'negative';
    const pnlSign = pnl >= 0 ? '+' : '';
    
    const sideClass = trade.side === 'buy' ? 'long' : 'short';
    const sideLabel = trade.side === 'buy' ? 'LONG' : 'SHORT';
    
    return `
        <div class="active-trade-item" data-trade-id="${trade.id}">
            <div class="active-trade-header">
                <div class="active-trade-symbol">${trade.symbol}</div>
                <div class="active-trade-side ${sideClass}">${sideLabel}</div>
            </div>
            
            <div class="active-trade-details">
                <div class="active-trade-detail">
                    <div class="active-trade-detail-label">Quantity</div>
                    <div class="active-trade-detail-value">${trade.quantity}</div>
                </div>
                
                <div class="active-trade-detail">
                    <div class="active-trade-detail-label">Entry Price</div>
                    <div class="active-trade-detail-value">$${parseFloat(trade.entry_price).toFixed(2)}</div>
                </div>
                
                <div class="active-trade-detail">
                    <div class="active-trade-detail-label">Current P&L</div>
                    <div class="active-trade-detail-value active-trade-pnl ${pnlClass}">
                        ${pnlSign}$${Math.abs(pnl).toFixed(2)}
                    </div>
                </div>
                
                <div class="active-trade-detail">
                    <div class="active-trade-detail-label">Status</div>
                    <div class="active-trade-detail-value">${trade.status}</div>
                </div>
            </div>
            
            <div class="active-trade-actions">
                <button class="active-trade-btn flip" onclick="flipPosition('${trade.id}', '${trade.symbol}', '${trade.quantity}', '${trade.side}')" 
                        title="Flip position from ${sideLabel} to ${trade.side === 'buy' ? 'SHORT' : 'LONG'}">
                    🔄 FLIP TO ${trade.side === 'buy' ? 'SHORT' : 'LONG'}
                </button>
                <button class="active-trade-btn close" onclick="closePosition('${trade.id}')" 
                        title="Close this position">
                    ✕ CLOSE
                </button>
            </div>
        </div>
    `;
}

// Close position function
async function closePosition(tradeId) {
    if (!confirm('Are you sure you want to close this position?')) {
        return;
    }

    try {
        const response = await fetch(`/api/trades/${tradeId}/close`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Position closed successfully', 'success');
            loadActiveTrades(); // Refresh the list
            updateQuickTradePosition(); // Update quick trade display
        } else {
            showNotification(`Failed to close position: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error closing position:', error);
        showNotification('Failed to close position', 'error');
    }
}

// Flip position function
async function flipPosition(tradeId, symbol, quantity, currentSide) {
    const newSide = currentSide === 'buy' ? 'sell' : 'buy';
    const newSideLabel = newSide === 'buy' ? 'LONG' : 'SHORT';
    
    if (!confirm(`Are you sure you want to flip this position to ${newSideLabel}?`)) {
        return;
    }

    try {
        // Close the current position
        const closeResponse = await fetch(`/api/trades/${tradeId}/close`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const closeData = await closeResponse.json();

        if (closeData.success) {
            // Open new position in opposite direction
            const openResponse = await fetch('/api/quick-trade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    symbol: symbol,
                    side: newSide,
                    quantity: parseFloat(quantity),
                    type: 'market'
                })
            });

            const openData = await openResponse.json();

            if (openData.success) {
                showNotification(`Position flipped to ${newSideLabel} successfully`, 'success');
                loadActiveTrades(); // Refresh the list
                updateQuickTradePosition(); // Update quick trade display
            } else {
                showNotification(`Failed to open new position: ${openData.error}`, 'error');
            }
        } else {
            showNotification(`Failed to close position: ${closeData.error}`, 'error');
        }
    } catch (error) {
        console.error('Error flipping position:', error);
        showNotification('Failed to flip position', 'error');
    }
}

// Export functions
window.adjustQuickTradeQuantity = adjustQuickTradeQuantity;
window.setQuickTradeQuantity = setQuickTradeQuantity;
window.executeQuickTrade = executeQuickTrade;
window.reverseQuickTrade = reverseQuickTrade;
window.initializeQuickTrade = initializeQuickTrade;
window.cleanupQuickTrade = cleanupQuickTrade;
window.loadActiveTrades = loadActiveTrades;
window.closePosition = closePosition;
window.flipPosition = flipPosition;
