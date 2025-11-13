// Real-time Exchange Positions Management
let exchangePositionsInterval = null;
let currentSelectedPlatform = 'delta-india';
let exchangePositionsUpdateCount = 0;

// Initialize exchange positions functionality
function initializeExchangePositions() {
    console.log('Initializing exchange positions...');
    setupExchangePositionsEventListeners();
    updatePlatformDisplay();
    startExchangePositionsUpdates();
    console.log('Exchange positions initialization complete');
}

// Setup event listeners
function setupExchangePositionsEventListeners() {
    // Platform selector change
    const platformSelect = document.getElementById('platformSelect');
    if (platformSelect) {
        platformSelect.addEventListener('change', handleExchangePlatformChange);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-exchange-positions-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            console.log('Manual refresh triggered');
            refreshExchangePositions();
        });
    }
}

// Handle platform change
function handleExchangePlatformChange() {
    const platformSelect = document.getElementById('platformSelect');
    currentSelectedPlatform = platformSelect.value;
    console.log('Exchange positions - Platform changed to:', currentSelectedPlatform);
    
    updatePlatformDisplay();
    refreshExchangePositions();
}

// Update platform display based on selection
function updatePlatformDisplay() {
    const exchangeIndicator = document.getElementById('exchange-indicator');
    const deltaIndiaStatus = document.getElementById('delta-india-status');
    const otherExchangesStatus = document.getElementById('other-exchanges-status');
    const exchangeNotSupported = document.getElementById('exchange-not-supported');
    const noExchangePositions = document.getElementById('no-exchange-positions');
    const exchangePositionsTable = document.getElementById('exchange-positions-table');
    
    if (currentSelectedPlatform === 'delta-india') {
        // Show Delta India interface
        if (exchangeIndicator) exchangeIndicator.textContent = '🇮🇳 Delta India';
        if (deltaIndiaStatus) deltaIndiaStatus.style.display = 'block';
        if (otherExchangesStatus) otherExchangesStatus.style.display = 'none';
        if (exchangeNotSupported) exchangeNotSupported.style.display = 'none';
        if (noExchangePositions) noExchangePositions.style.display = 'block';
        if (exchangePositionsTable) exchangePositionsTable.style.display = 'none';
        
        startExchangePositionsUpdates();
    } else {
        // Show not supported interface for other exchanges
        const platformNames = {
            'paper': '📄 Paper Trading',
            'delta-us': '🇺🇸 Delta US', 
            'coinbase': '🔷 Coinbase Pro',
            'binance': '🔶 Binance'
        };
        
        if (exchangeIndicator) {
            exchangeIndicator.textContent = platformNames[currentSelectedPlatform] || currentSelectedPlatform;
        }
        if (deltaIndiaStatus) deltaIndiaStatus.style.display = 'none';
        if (otherExchangesStatus) otherExchangesStatus.style.display = 'block';
        if (exchangeNotSupported) exchangeNotSupported.style.display = 'block';
        if (noExchangePositions) noExchangePositions.style.display = 'none';
        if (exchangePositionsTable) exchangePositionsTable.style.display = 'none';
        
        stopExchangePositionsUpdates();
    }
}

// Start real-time updates (every 1 second)
function startExchangePositionsUpdates() {
    stopExchangePositionsUpdates(); // Clear any existing interval
    
    if (currentSelectedPlatform === 'delta-india') {
        console.log('Starting real-time position updates for Delta India');
        exchangePositionsInterval = setInterval(refreshExchangePositions, 1000); // Update every 1 second
        // Initial load
        refreshExchangePositions();
    }
}

// Stop updates
function stopExchangePositionsUpdates() {
    if (exchangePositionsInterval) {
        clearInterval(exchangePositionsInterval);
        exchangePositionsInterval = null;
        console.log('Stopped exchange positions updates');
    }
}

// Refresh positions from exchange
async function refreshExchangePositions() {
    console.log('Starting refreshExchangePositions...');
    console.log('Current platform:', currentSelectedPlatform);
    
    const loadingElement = document.getElementById('positions-loading');
    const noPositionsElement = document.getElementById('no-exchange-positions');
    const tableElement = document.getElementById('exchange-positions-table');
    const lastUpdateElement = document.getElementById('last-update-time');
    
    console.log('DOM elements found:', {
        loading: !!loadingElement,
        noPositions: !!noPositionsElement,
        table: !!tableElement,
        lastUpdate: !!lastUpdateElement
    });
    
    try {
        // Show loading state briefly (only on first load)
        if (exchangePositionsUpdateCount === 0 && loadingElement) {
            loadingElement.style.display = 'block';
            if (noPositionsElement) noPositionsElement.style.display = 'none';
            if (tableElement) tableElement.style.display = 'none';
        }
        
        // Fetch positions from backend (which handles exchange integration)
        const response = await fetch(`/api/exchange-positions?platform=${currentSelectedPlatform}`);
        const data = await response.json();
        
        console.log('API Response:', data);
        
        exchangePositionsUpdateCount++;
        
        // Update last update time
        if (lastUpdateElement) {
            const now = new Date();
            lastUpdateElement.textContent = `Last update: ${now.toLocaleTimeString()}`;
            lastUpdateElement.style.color = 'var(--text-tertiary)';
        }
        
        // Hide loading
        if (loadingElement) loadingElement.style.display = 'none';
        
        if (data.success) {
            if (!data.supported) {
                // Exchange not supported - show appropriate message
                if (tableElement) tableElement.style.display = 'none';
                if (noPositionsElement) noPositionsElement.style.display = 'none';
                showExchangeNotSupported(data.platform);
                return;
            }
            
            if (data.positions && data.positions.length > 0) {
                // Debug: log position data
                console.log('Exchange positions received:', data.positions);
                
                // Show positions table
                displayExchangePositions(data.positions);
                if (tableElement) tableElement.style.display = 'block';
                if (noPositionsElement) noPositionsElement.style.display = 'none';
                hideExchangeNotSupported();
            } else {
                // No positions
                if (tableElement) tableElement.style.display = 'none';
                if (noPositionsElement) noPositionsElement.style.display = 'block';
                hideExchangeNotSupported();
            }
        } else {
            throw new Error(data.error || 'Failed to fetch positions');
        }
    } catch (error) {
        console.error('Error fetching exchange positions:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            platform: currentSelectedPlatform,
            url: `/api/exchange-positions?platform=${currentSelectedPlatform}`
        });
        if (loadingElement) loadingElement.style.display = 'none';
        if (noPositionsElement) noPositionsElement.style.display = 'block';
        if (tableElement) tableElement.style.display = 'none';
        
        // Show error in last update
        if (lastUpdateElement) {
            lastUpdateElement.textContent = 'Last update: Error - ' + new Date().toLocaleTimeString();
            lastUpdateElement.style.color = 'var(--accent-red)';
        }
    }
}

// Display positions in table
function displayExchangePositions(positions) {
    console.log('displayExchangePositions called with:', positions);
    const tbody = document.getElementById('exchange-positions-tbody');
    console.log('Found tbody element:', !!tbody);
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    positions.forEach((position, index) => {
        console.log(`Creating row ${index} for position:`, position);
        const row = createPositionRow(position);
        console.log(`Created row:`, row);
        tbody.appendChild(row);
    });
    
    console.log(`Added ${positions.length} rows to table`);
}

// Create position table row
function createPositionRow(position) {
    const row = document.createElement('tr');
    
    const size = Math.abs(position.size);
    // Handle both 'buy'/'sell' and 'long'/'short' formats
    const isLong = position.side === 'buy' || position.side === 'long' || position.size > 0;
    const side = isLong ? 'LONG' : 'SHORT';
    const sideClass = isLong ? 'positive' : 'negative';
    const entryPrice = parseFloat(position.entry_price || position.entryPrice || 0);
    const markPrice = parseFloat(position.mark_price || position.markPrice || entryPrice);
    
    // Use backend-calculated values if available, otherwise fallback to frontend calculation
    const unrealizedPnl = position.unrealizedPnl !== undefined ? position.unrealizedPnl : (position.unrealized_pnl || 0);
    const realizedPnl = position.realizedPnl !== undefined ? position.realizedPnl : (position.realized_pnl || 0);
    const totalPnl = unrealizedPnl + realizedPnl;
    
    // Use backend-calculated ROE if available
    const roePercentage = position.roe !== undefined ? position.roe : (() => {
        if (entryPrice > 0) {
            const priceDiff = isLong ? markPrice - entryPrice : entryPrice - markPrice;
            return (priceDiff / entryPrice) * 100;
        }
        return 0;
    })();
    
    const pnlClass = totalPnl >= 0 ? 'positive' : 'negative';
    const roeClass = roePercentage >= 0 ? 'positive' : 'negative';
    
    row.innerHTML = `
        <td>
            <div class="symbol">${position.product_symbol || position.symbol}</div>
        </td>
        <td>
            <span class="${sideClass}" style="font-weight: 600;">${side}</span>
        </td>
        <td>
            <div style="font-family: 'JetBrains Mono', monospace;">${size.toFixed(4)}</div>
        </td>
        <td>
            <div style="font-family: 'JetBrains Mono', monospace;">₹${entryPrice.toFixed(2)}</div>
        </td>
        <td>
            <div style="font-family: 'JetBrains Mono', monospace;">₹${markPrice.toFixed(2)}</div>
        </td>
        <td>
            <div class="${pnlClass}" style="font-family: 'JetBrains Mono', monospace; font-weight: 600;">
                ₹${totalPnl.toFixed(2)}
                ${unrealizedPnl !== 0 && realizedPnl !== 0 ? `<br><small style="opacity: 0.7;">U: ₹${unrealizedPnl.toFixed(2)} | R: ₹${realizedPnl.toFixed(2)}</small>` : ''}
            </div>
        </td>
        <td>
            <div class="${roeClass}" style="font-family: 'JetBrains Mono', monospace; font-weight: 600;">
                ${roePercentage >= 0 ? '+' : ''}${roePercentage.toFixed(2)}%
            </div>
        </td>
        <td>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn-modern btn-outline" 
                        style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                        onclick="closeExchangePosition('${position.product_symbol || position.symbol}', ${position.size})">
                    Close
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Close position function
async function closeExchangePosition(symbol, size) {
    if (confirm(`Close position for ${symbol}?`)) {
        const startTime = Date.now();
        
        try {
            console.log(`⚡ Closing position: ${symbol}, size: ${size}`);
            
            const response = await fetch('/api/quick-trade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    symbol: symbol,
                    side: size > 0 ? 'short' : 'long', // Opposite side to close
                    quantity: Math.abs(size),
                    type: 'market'
                })
            });
            
            const data = await response.json();
            const executionTime = Date.now() - startTime;
            
            if (data.success) {
                const finalTime = data.execution_time_ms || executionTime;
                console.log(`⚡ Position closed in ${finalTime}ms`);
                showNotification(`${symbol} position closed in ${finalTime}ms`, 'success');
                // Refresh positions immediately for instant feedback
                refreshExchangePositions();
            } else {
                console.error(`❌ Close failed in ${executionTime}ms:`, data.error);
                showNotification(`Failed to close ${symbol}: ${data.error}`, 'error');
            }
        } catch (error) {
            const executionTime = Date.now() - startTime;
            console.error(`❌ Close failed in ${executionTime}ms:`, error);
            showNotification('Failed to close position', 'error');
        }
    }
}

// Show notification (reuse existing function or create simple one)
function showNotification(message, type = 'info') {
    // Try to use existing notification system, but avoid infinite recursion
    if (window.showNotification && window.showNotification !== showNotification) {
        window.showNotification(message, type);
        return;
    }
    
    // Fallback to simple alert/console
    console.log(`${type.toUpperCase()}: ${message}`);
    if (type === 'error') {
        alert(`Error: ${message}`);
    }
}

// Show exchange not supported message
function showExchangeNotSupported(platform) {
    const exchangeNotSupportedElement = document.getElementById('exchange-not-supported');
    if (exchangeNotSupportedElement) {
        exchangeNotSupportedElement.style.display = 'block';
        exchangeNotSupportedElement.textContent = `${platform} exchange is not yet integrated`;
    }
    console.log(`Exchange not supported: ${platform}`);
}

// Hide exchange not supported message
function hideExchangeNotSupported() {
    const exchangeNotSupportedElement = document.getElementById('exchange-not-supported');
    if (exchangeNotSupportedElement) {
        exchangeNotSupportedElement.style.display = 'none';
    }
}

// Cleanup function
function cleanupExchangePositions() {
    stopExchangePositionsUpdates();
}

// Export functions to global scope
window.initializeExchangePositions = initializeExchangePositions;
window.cleanupExchangePositions = cleanupExchangePositions;
window.closeExchangePosition = closeExchangePosition;
window.handleExchangePlatformChange = handleExchangePlatformChange;

console.log('Exchange positions module loaded');