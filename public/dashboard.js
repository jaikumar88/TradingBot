// Professional Trading Terminal Dashboard
// High-Performance Financial Interface

let currentTrades = [];
let refreshTimer = null;
const REFRESH_INTERVAL = 5000; // 5 seconds for real-time performance
const API_TIMEOUT = 3000; // 3 seconds timeout for fast responsiveness

// Performance optimizations
let isRefreshing = false;
let lastUpdateTime = 0;
const MIN_UPDATE_INTERVAL = 1000; // Minimum 1 second between updates

// Initialize dashboard with performance optimizations
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupEventListeners();
    startRealTimeUpdates();
    
    // Preload critical data
    Promise.all([
        loadStats(),
        loadConfig()
    ]).then(() => {
        updateConnectionStatus(true);
        console.log('Trading terminal initialized successfully');
        
        // Load active trades on the home screen
        if (typeof loadActiveTrades === 'function') {
            loadActiveTrades();
        }
    }).catch(error => {
        updateConnectionStatus(false);
        console.error('Failed to initialize terminal:', error);
    });
});

function initializeDashboard() {
    // Set default states
    updateConnectionStatus(true);
    setupControlToggles();
}

function setupEventListeners() {
    // Trading mode toggle
    const tradingSwitch = document.getElementById('tradingModeSwitch');
    tradingSwitch?.addEventListener('change', handleTradingModeChange);
    
    // AI mode toggle  
    const aiSwitch = document.getElementById('aiModeSwitch');
    aiSwitch?.addEventListener('change', handleAIModeChange);
    
    // AI provider select
    const providerSelect = document.getElementById('aiProviderSelect');
    providerSelect?.addEventListener('change', handleProviderChange);
    
    // Platform selector
    const platformSelect = document.getElementById('platformSelect');
    platformSelect?.addEventListener('change', handlePlatformChange);
    
    // Performance optimization: Use passive listeners where possible
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
}

function handleVisibilityChange() {
    if (document.hidden) {
        // Slow down updates when tab is not visible
        clearInterval(refreshTimer);
        refreshTimer = setInterval(refreshData, 30000); // 30 seconds
    } else {
        // Speed up when tab becomes visible
        startRealTimeUpdates();
        refreshData(); // Immediate update
    }
}

function startRealTimeUpdates() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshData, REFRESH_INTERVAL);
}

async function refreshData() {
    // Throttle updates for performance
    const now = Date.now();
    if (now - lastUpdateTime < MIN_UPDATE_INTERVAL || isRefreshing) {
        return;
    }
    
    isRefreshing = true;
    lastUpdateTime = now;
    
    // Show refresh animation
    const spinner = document.getElementById('refresh-spinner');
    const text = document.getElementById('refresh-text');
    if (spinner && text) {
        spinner.style.display = 'inline-block';
        text.textContent = 'Updating...';
    }
    
    try {
        // Only refresh stats automatically, trades are loaded on demand
        const statsResponse = await fetchWithTimeout('/api/stats');
        const stats = await statsResponse.json();
        if (stats.success) {
            updateStatsDisplay(stats.data);
        }

        updateConnectionStatus(true);
        
    } catch (error) {
        console.error('Refresh failed:', error);
        updateConnectionStatus(false);
    } finally {
        isRefreshing = false;
        
        // Hide refresh animation
        if (spinner && text) {
            spinner.style.display = 'none';
            text.textContent = '↻ Refresh';
        }
    }
}

async function fetchWithTimeout(url, options = {}, timeout = API_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...options.headers
            },
            ...options
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    
    if (statusDot && statusText) {
        if (connected) {
            statusDot.className = 'status-dot';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Disconnected';
        }
    }
}

function updateStatsDisplay(stats) {
    // High-performance DOM updates using document fragments
    const updates = [
        { id: 'total-pnl', value: formatCurrency(stats.totalPnl || 0), className: getPnlClass(stats.totalPnl) },
        { id: 'total-trades', value: stats.totalTrades || 0, className: 'neutral' },
        { id: 'win-rate', value: (stats.winRate || 0) + '%', className: 'neutral' },
        { id: 'active-trades', value: stats.activeTrades || 0, className: 'neutral' }
    ];
    
    // Batch DOM updates for performance
    requestAnimationFrame(() => {
        updates.forEach(update => {
            const element = document.getElementById(update.id);
            if (element) {
                element.textContent = update.value;
                element.className = `stat-value ${update.className}`;
            }
        });
        
        // Update change indicators
        updateChangeIndicators(stats);
        
        // Update paper trading info if available
        if (stats.paperTrading) {
            updatePaperTradingDisplay(stats.paperTrading);
        }
    });
}

function updateChangeIndicators(stats) {
    const pnlChange = document.getElementById('pnl-change');
    const tradesChange = document.getElementById('trades-change');
    const winrateChange = document.getElementById('winrate-change');
    const activeChange = document.getElementById('active-change');
    
    if (pnlChange) {
        pnlChange.textContent = stats.totalPnl >= 0 ? 'Profitable' : 'Loss Position';
        pnlChange.className = `stat-change ${getPnlClass(stats.totalPnl)}`;
    }
    
    if (tradesChange) {
        tradesChange.textContent = stats.totalTrades > 0 ? `${stats.totalTrades} executed` : 'Ready to trade';
    }
    
    if (winrateChange) {
        const rate = stats.winRate || 0;
        winrateChange.textContent = rate > 0 ? `${rate >= 60 ? 'Excellent' : rate >= 40 ? 'Good' : 'Below Average'}` : 'No completed trades';
        winrateChange.className = `stat-change ${rate >= 60 ? 'positive' : rate >= 40 ? 'neutral' : 'negative'}`;
    }
    
    if (activeChange) {
        const active = stats.activeTrades || 0;
        activeChange.textContent = active > 0 ? `${active} position${active > 1 ? 's' : ''} open` : 'No active positions';
        activeChange.className = `stat-change ${active > 0 ? 'positive' : 'neutral'}`;
    }
}

function updatePaperTradingDisplay(paperStats) {
    const elements = {
        'paper-balance': formatCurrency(paperStats.paperBalance || 10000),
        'paper-pnl': formatCurrency(paperStats.totalPnl || 0),
        'paper-trades-count': paperStats.totalTrades || 0
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            if (id === 'paper-pnl') {
                element.className = getPnlClass(paperStats.totalPnl);
            }
        }
    });
}

function updateTradesTable(trades) {
    const tbody = document.getElementById('trades-table-body');
    if (!tbody) return;
    
    if (trades.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 3rem; color: var(--text-tertiary);">
                    📊 No trades found
                    <div style="font-size: 0.875rem; margin-top: 0.5rem;">Send a trade message to get started</div>
                </td>
            </tr>
        `;
        return;
    }
    
    // High-performance table rendering using DocumentFragment
    const fragment = document.createDocumentFragment();
    
    trades.slice(0, 50).forEach(trade => { // Limit to 50 for performance
        const row = createTradeRow(trade);
        fragment.appendChild(row);
    });
    
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

function createTradeRow(trade) {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    row.onclick = () => showTradeDetails(trade);
    
    const pnl = calculatePnL(trade);
    const pnlClass = getPnlClass(pnl);
    
    row.innerHTML = `
        <td style="font-weight: 600;">#${trade.id}</td>
        <td style="font-weight: 600; color: var(--accent-blue);">${trade.symbol}</td>
        <td>
            <span style="color: ${trade.side === 'buy' ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 600;">
                ${trade.side.toUpperCase()}
            </span>
        </td>
        <td>${trade.quantity}</td>
        <td>${formatCurrency(trade.entryPrice)}</td>
        <td class="${pnlClass}" style="font-weight: 600;">${formatCurrency(pnl)}</td>
        <td>
            <span class="status-badge status-${trade.status}">
                ${trade.status.toUpperCase()}
            </span>
        </td>
        <td style="font-size: 0.75rem; color: var(--text-tertiary);">
            ${formatTime(trade.openTime || trade.createdAt)}
        </td>
    `;
    
    return row;
}

function calculatePnL(trade) {
    if (trade.status === 'closed') {
        return trade.pnl || 0;
    }
    
    // For active trades, calculate current P&L if current price available
    return trade.unrealizedPnL || 0;
}

function getPnlClass(value) {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
}

function formatCurrency(value) {
    if (typeof value !== 'number') return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
}

function showTradeDetails(trade) {
    // Enhanced trade details modal
    const details = `
Trade #${trade.id} Details:

Symbol: ${trade.symbol}
Side: ${trade.side.toUpperCase()}
Quantity: ${trade.quantity}
Entry Price: ${formatCurrency(trade.entryPrice)}
Stop Loss: ${trade.stopLoss ? formatCurrency(trade.stopLoss) : 'Not set'}
Take Profit: ${trade.takeProfit ? formatCurrency(trade.takeProfit) : 'Not set'}
Status: ${trade.status.toUpperCase()}
P&L: ${formatCurrency(calculatePnL(trade))}
Created: ${new Date(trade.createdAt).toLocaleString()}
${trade.closeTime ? 'Closed: ' + new Date(trade.closeTime).toLocaleString() : ''}
`;
    
    alert(details);
}

async function handleTradingModeChange(event) {
    const isLive = event.target.checked;
    const label = document.getElementById('tradingModeLabel');
    
    if (label) {
        label.textContent = isLive ? 'LIVE' : 'PAPER';
        label.style.color = isLive ? 'var(--accent-red)' : 'var(--accent-orange)';
    }
    
    // Update alert banner
    const alert = document.getElementById('trading-alert');
    if (alert) {
        if (isLive) {
            alert.className = 'alert-banner alert-danger';
            alert.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-red);"></div>
                    <strong>⚠️ LIVE TRADING MODE</strong>
                </div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.875rem;">
                    Real money at risk - Trade carefully
                </div>
            `;
        } else {
            alert.className = 'alert-banner alert-warning';
            alert.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-orange);"></div>
                    <strong>PAPER TRADING MODE</strong>
                </div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.875rem;" id="paper-trading-info">
                    Balance: <span id="paper-balance">$10,000</span> | P&L: <span id="paper-pnl">$0.00</span> | Trades: <span id="paper-trades-count">0</span>
                </div>
            `;
        }
    }
    
    // Send to backend
    try {
        await fetchWithTimeout('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                tradingMode: isLive ? 'Live' : 'Paper' 
            })
        });
        console.log(`Trading mode changed to: ${isLive ? 'Live' : 'Paper'}`);
    } catch (error) {
        console.error('Failed to update trading mode:', error);
    }
}

async function handleAIModeChange(event) {
    const isLive = event.target.checked;
    const label = document.getElementById('aiModeLabel');
    
    if (label) {
        label.textContent = isLive ? 'LIVE' : 'TEST';
        label.style.color = isLive ? 'var(--accent-green)' : 'var(--accent-orange)';
    }
    
    // Send to backend
    try {
        await fetchWithTimeout('/api/config', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                aiMode: isLive ? 'live' : 'test' 
            })
        });
        console.log(`AI mode changed to: ${isLive ? 'Live' : 'Test'}`);
    } catch (error) {
        console.error('Failed to update AI mode:', error);
    }
}

async function handleProviderChange(event) {
    const provider = event.target.value;
    
    try {
        await fetchWithTimeout('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aiProvider: provider })
        });
        console.log(`AI provider changed to: ${provider}`);
    } catch (error) {
        console.error('Failed to update AI provider:', error);
    }
}

async function handlePlatformChange(event) {
    const platform = event.target.value;
    const statusElement = document.getElementById('platformStatus');
    
    // Update status indicator
    if (statusElement) {
        const statusText = platform === 'paper' ? 'Paper Mode' : 'Connected';
        const statusColor = platform === 'paper' ? 'var(--accent-orange)' : 'var(--accent-green)';
        
        statusElement.innerHTML = `
            <span class="status-indicator">
                <span class="status-dot" style="background: ${statusColor}"></span>
                ${statusText}
            </span>
        `;
    }
    
    try {
        // Send platform change to backend
        await fetchWithTimeout('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                tradingPlatform: platform,
                paperTrade: platform === 'paper' 
            })
        });
        
        console.log(`Trading platform changed to: ${platform}`);
        
        // Update exchange positions display
        if (typeof handleExchangePlatformChange === 'function') {
            handleExchangePlatformChange();
        }
        
        // Refresh trades to show only relevant platform trades
        refreshData();
        
    } catch (error) {
        console.error('Failed to update trading platform:', error);
        // Show error message to user
        showError(`Failed to switch to ${platform}. Please try again.`);
    }
}

function setupControlToggles() {
    // Initialize toggles based on current config
    loadConfig();
}

async function loadStats() {
    try {
        const response = await fetchWithTimeout('/api/stats');
        const result = await response.json();
        
        if (result.success) {
            updateStatsDisplay(result.data);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadTrades() {
    try {
        // Update button state to show loading
        const loadButton = document.getElementById('load-trades-btn');
        if (loadButton) {
            loadButton.innerHTML = '<span>⏳</span> Loading...';
            loadButton.disabled = true;
        }

        // Show loading state in table
        const tableBody = document.getElementById('trades-table-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 3rem; color: var(--text-tertiary);">
                        <div class="loading-spinner" style="margin: 0 auto 1rem;"></div>
                        Loading trades...
                    </td>
                </tr>
            `;
        }

        const statusFilter = document.getElementById('status-filter')?.value || '';
        const url = statusFilter ? `/api/trades?status=${statusFilter}` : '/api/trades';
        
        const response = await fetchWithTimeout(url);
        const result = await response.json();
        
        if (result.success) {
            currentTrades = result.data;
            updateTradesTable(currentTrades);
            
            // Update button to show refresh option
            if (loadButton) {
                loadButton.innerHTML = '<span>🔄</span> Refresh Trades';
                loadButton.disabled = false;
            }
        } else {
            throw new Error(result.error || 'Failed to load trades');
        }
    } catch (error) {
        console.error('Error loading trades:', error);
        
        // Show error state
        const tableBody = document.getElementById('trades-table-body');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 3rem; color: var(--color-sell);">
                        <div style="margin: 0 auto 1rem;">⚠️</div>
                        <div style="margin-bottom: 1rem;">Error loading trades</div>
                        <div style="font-size: 0.875rem;">${error.message}</div>
                    </td>
                </tr>
            `;
        }
        
        // Reset button state
        const loadButton = document.getElementById('load-trades-btn');
        if (loadButton) {
            loadButton.innerHTML = '<span>📋</span> Load Trades';
            loadButton.disabled = false;
        }
    }
}

async function loadConfig() {
    try {
        const response = await fetchWithTimeout('/api/config');
        const result = await response.json();
        
        if (result.success) {
            // Update UI controls based on config
            const config = result.data;
            
            const tradingSwitch = document.getElementById('tradingModeSwitch');
            const tradingLabel = document.getElementById('tradingModeLabel');
            if (tradingSwitch && tradingLabel) {
                const isLive = !config.isPaperTrading;
                tradingSwitch.checked = isLive;
                tradingLabel.textContent = isLive ? 'LIVE' : 'PAPER';
                tradingLabel.style.color = isLive ? 'var(--accent-red)' : 'var(--accent-orange)';
            }
            
            const aiSwitch = document.getElementById('aiModeSwitch');
            const aiLabel = document.getElementById('aiModeLabel');
            if (aiSwitch && aiLabel) {
                const isLive = !config.useTestAI;
                aiSwitch.checked = isLive;
                aiLabel.textContent = isLive ? 'LIVE' : 'TEST';
                aiLabel.style.color = isLive ? 'var(--accent-green)' : 'var(--accent-orange)';
            }
            
            const providerSelect = document.getElementById('aiProviderSelect');
            if (providerSelect) {
                providerSelect.value = config.aiProvider || 'pattern_only';
            }
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

function filterTrades() {
    loadTrades(); // Reload with filter
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    clearInterval(refreshTimer);
});

// Expose global functions
window.refreshData = refreshData;
window.filterTrades = filterTrades;

function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    
    if (statusDot && statusText) {
        if (connected) {
            statusDot.className = 'status-dot';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Disconnected';
        }
    }
}

function updateStatsDisplay(stats) {
    // High-performance DOM updates using document fragments
    const updates = [
        { id: 'total-pnl', value: formatCurrency(stats.totalPnl || 0), className: getPnlClass(stats.totalPnl) },
        { id: 'total-trades', value: stats.totalTrades || 0, className: 'neutral' },
        { id: 'win-rate', value: (stats.winRate || 0) + '%', className: 'neutral' },
        { id: 'active-trades', value: stats.activeTrades || 0, className: 'neutral' }
    ];
    
    // Batch DOM updates for performance
    requestAnimationFrame(() => {
        updates.forEach(update => {
            const element = document.getElementById(update.id);
            if (element) {
                element.textContent = update.value;
                element.className = `stat-value ${update.className}`;
            }
        });
        
        // Update change indicators
        updateChangeIndicators(stats);
        
        // Update paper trading info if available
        if (stats.paperTrading) {
            updatePaperTradingDisplay(stats.paperTrading);
        }
    });
}

function updateChangeIndicators(stats) {
    const pnlChange = document.getElementById('pnl-change');
    const tradesChange = document.getElementById('trades-change');
    const winrateChange = document.getElementById('winrate-change');
    const activeChange = document.getElementById('active-change');
    
    if (pnlChange) {
        pnlChange.textContent = stats.totalPnl >= 0 ? 'Profitable' : 'Loss Position';
        pnlChange.className = `stat-change ${getPnlClass(stats.totalPnl)}`;
    }
    
    if (tradesChange) {
        tradesChange.textContent = stats.totalTrades > 0 ? `${stats.totalTrades} executed` : 'Ready to trade';
    }
    
    if (winrateChange) {
        const rate = stats.winRate || 0;
        winrateChange.textContent = rate > 0 ? `${rate >= 60 ? 'Excellent' : rate >= 40 ? 'Good' : 'Below Average'}` : 'No completed trades';
        winrateChange.className = `stat-change ${rate >= 60 ? 'positive' : rate >= 40 ? 'neutral' : 'negative'}`;
    }
    
    if (activeChange) {
        const active = stats.activeTrades || 0;
        activeChange.textContent = active > 0 ? `${active} position${active > 1 ? 's' : ''} open` : 'No active positions';
        activeChange.className = `stat-change ${active > 0 ? 'positive' : 'neutral'}`;
    }
}

function updatePaperTradingDisplay(paperStats) {
    const elements = {
        'paper-balance': formatCurrency(paperStats.paperBalance || 10000),
        'paper-pnl': formatCurrency(paperStats.totalPnl || 0),
        'paper-trades-count': paperStats.totalTrades || 0
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            if (id === 'paper-pnl') {
                element.className = getPnlClass(paperStats.totalPnl);
            }
        }
    });
}

function updateTradesTable(trades) {
    const tbody = document.getElementById('trades-table-body');
    if (!tbody) return;
    
    if (trades.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 3rem; color: var(--text-tertiary);">
                    📊 No trades found
                    <div style="font-size: 0.875rem; margin-top: 0.5rem;">Send a trade message to get started</div>
                </td>
            </tr>
        `;
        return;
    }
    
    // High-performance table rendering using DocumentFragment
    const fragment = document.createDocumentFragment();
    
    trades.slice(0, 50).forEach(trade => { // Limit to 50 for performance
        const row = createTradeRow(trade);
        fragment.appendChild(row);
    });
    
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

function createTradeRow(trade) {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    row.onclick = () => showTradeDetails(trade);
    
    const pnl = calculatePnL(trade);
    const pnlClass = getPnlClass(pnl);
    
    // Create action buttons based on trade status
    let actionButtons = '';
    if (trade.status === 'open') {
        actionButtons = `
            <button class="close-trade-btn" data-trade-id="${trade.id}" 
                    style="background: var(--accent-orange); color: white; border: none; padding: 0.25rem 0.5rem; 
                           border-radius: 4px; font-size: 0.75rem; cursor: pointer; margin-right: 0.25rem;">
                ✕ Close
            </button>
            <button class="flip-trade-btn" data-trade-id="${trade.id}" 
                    style="background: var(--accent-purple, #6366f1); color: white; border: none; padding: 0.25rem 0.5rem; 
                           border-radius: 4px; font-size: 0.75rem; cursor: pointer; margin-right: 0.25rem;">
                🔄 Flip
            </button>`;
    }
    
    actionButtons += `
        <button class="delete-trade-btn" data-trade-id="${trade.id}" 
                style="background: var(--accent-red); color: white; border: none; padding: 0.25rem 0.5rem; 
                       border-radius: 4px; font-size: 0.75rem; cursor: pointer; opacity: 0.8;">
            🗑️ Delete
        </button>`;
    
    row.innerHTML = `
        <td style="font-weight: 600;">#${trade.id}</td>
        <td style="font-weight: 600; color: var(--accent-blue);">${trade.symbol}</td>
        <td>
            <span style="color: ${trade.side === 'buy' ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight: 600;">
                ${trade.side.toUpperCase()}
            </span>
        </td>
        <td>${trade.quantity}</td>
        <td>${formatCurrency(trade.entryPrice)}</td>
        <td>${trade.stopLoss ? formatCurrency(trade.stopLoss) : '-'}</td>
        <td>${trade.takeProfit ? formatCurrency(trade.takeProfit) : '-'}</td>
        <td class="${pnlClass}" style="font-weight: 600;">${formatCurrency(pnl)}</td>
        <td>
            <span class="status-badge status-${trade.status}">
                ${trade.status.toUpperCase()}
            </span>
        </td>
        <td style="font-size: 0.75rem; color: var(--text-tertiary);">
            ${formatTime(trade.openTime || trade.createdAt)}
        </td>
        <td style="min-width: 150px;">
            ${actionButtons}
        </td>
    `;
    
    // Add event listeners for buttons
    setTimeout(() => {
        const closeBtn = row.querySelector('.close-trade-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tradeId = e.target.getAttribute('data-trade-id');
                closeTrade(tradeId);
            });
        }
        
        const flipBtn = row.querySelector('.flip-trade-btn');
        if (flipBtn) {
            flipBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tradeId = e.target.getAttribute('data-trade-id');
                flipTrade(tradeId);
            });
        }
        
        const deleteBtn = row.querySelector('.delete-trade-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tradeId = e.target.getAttribute('data-trade-id');
                deleteTrade(tradeId);
            });
        }
    }, 0);
    
    return row;
}

function calculatePnL(trade) {
    if (trade.status === 'closed') {
        return trade.pnl || 0;
    }
    
    // For active trades, calculate current P&L if current price available
    // This would need real-time price data
    return trade.unrealizedPnL || 0;
}

function getPnlClass(value) {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
}

function formatCurrency(value) {
    if (typeof value !== 'number') return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
        .format(Math.round((date - new Date()) / (1000 * 60)), 'minute');
}

function showTradeDetails(trade) {
    // Simple alert for now - can be enhanced with modal
    alert(`Trade Details:
ID: ${trade.id}
Symbol: ${trade.symbol}
Side: ${trade.side}
Quantity: ${trade.quantity}
Entry: ${formatCurrency(trade.entryPrice)}
Status: ${trade.status}
P&L: ${formatCurrency(calculatePnL(trade))}`);
}

async function deleteTrade(tradeId) {
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete trade #${tradeId}? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/trades/${tradeId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            showNotification(result.message, 'success');
            // Reload trades to reflect the deletion
            loadTrades();
        } else {
            showNotification(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting trade:', error);
        showNotification('Failed to delete trade. Please try again.', 'error');
    }
}

// Close an active trade
async function closeTrade(tradeId) {
    // Confirm closure
    if (!confirm(`Are you sure you want to close trade #${tradeId}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/trades/${tradeId}/close`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'manual' })
        });

        const result = await response.json();

        if (result.success) {
            showNotification(`Trade #${tradeId} closed successfully`, 'success');
            // Reload trades to show updated status
            loadTrades();
        } else {
            showNotification(`Error closing trade: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error closing trade:', error);
        showNotification('Failed to close trade. Please try again.', 'error');
    }
}

// Flip/reverse a trade position
async function flipTrade(tradeId) {
    // Confirm flip action
    if (!confirm(`Are you sure you want to flip/reverse trade #${tradeId}? This will close the current position and open an opposite one.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/reverse-trade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                tradeId: parseInt(tradeId),
                reason: 'manual_flip' 
            })
        });

        const result = await response.json();

        if (result.success) {
            showNotification(`Trade #${tradeId} flipped successfully`, 'success');
            // Reload trades to show the new reversed position
            loadTrades();
        } else {
            showNotification(`Error flipping trade: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error flipping trade:', error);
        showNotification('Failed to flip trade. Please try again.', 'error');
    }
}

async function handleTradingModeChange(event) {
    const isLive = event.target.checked;
    const label = document.getElementById('tradingModeLabel');
    
    if (label) {
        label.textContent = isLive ? 'LIVE' : 'PAPER';
    }
    
    // Update alert banner
    const alert = document.getElementById('trading-alert');
    if (alert) {
        if (isLive) {
            alert.className = 'alert-banner alert-danger';
            alert.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-red);"></div>
                    <strong>LIVE TRADING MODE</strong>
                </div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.875rem;">
                    ⚠️ Real money at risk - Trade carefully
                </div>
            `;
        } else {
            alert.className = 'alert-banner alert-warning';
        }
    }
    
    // Send to backend
    try {
        await fetchWithTimeout('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                tradingMode: isLive ? 'live' : 'paper' 
            })
        });
    } catch (error) {
        console.error('Failed to update trading mode:', error);
    }
}

async function handleAIModeChange(event) {
    const isLive = event.target.checked;
    const label = document.getElementById('aiModeLabel');
    
    if (label) {
        label.textContent = isLive ? 'LIVE' : 'TEST';
    }
    
    // Send to backend
    try {
        await fetchWithTimeout('/api/config', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                aiMode: isLive ? 'live' : 'test' 
            })
        });
    } catch (error) {
        console.error('Failed to update AI mode:', error);
    }
}

async function handleProviderChange(event) {
    const provider = event.target.value;
    
    try {
        await fetchWithTimeout('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aiProvider: provider })
        });
    } catch (error) {
        console.error('Failed to update AI provider:', error);
    }
}

function setupControlToggles() {
    // Initialize toggles based on current config
    loadConfig();
}

function filterTrades() {
    loadTrades(); // Reload with filter
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    clearInterval(refreshTimer);
});

// Expose global functions
window.refreshData = refreshData;
window.filterTrades = filterTrades;

// Utility function to show error messages
function showError(message, duration = 5000) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--accent-red);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(248, 73, 96, 0.3);
        z-index: 10000;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
    `;
    errorDiv.textContent = message;

    document.body.appendChild(errorDiv);

    // Auto remove after duration
    setTimeout(() => {
        errorDiv.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 300);
    }, duration);
}

// Add CSS animations for error notifications
if (!document.querySelector('#error-animations-style')) {
    const style = document.createElement('style');
    style.id = 'error-animations-style';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
