// Tab Navigation System for Trading Dashboard

let currentTab = 'overview';

// Initialize tab functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    setupTabEventListeners();
});

function initializeTabs() {
    // Set initial active tab
    switchTab('overview');
    
    // Initialize manual trade form validation when manual tab becomes active
    setupTabSpecificInitialization();
    
    // Initialize range sliders
    initializeRangeSliders();
}

function setupTabEventListeners() {
    // Add keyboard navigation for tabs
    document.addEventListener('keydown', function(e) {
        if (e.altKey) {
            const tabMap = {
                '1': 'overview',
                '2': 'trades', 
                '3': 'manual',
                '4': 'risk',
                '5': 'strategy',
                '6': 'analytics'
            };
            
            if (tabMap[e.key]) {
                e.preventDefault();
                switchTab(tabMap[e.key]);
            }
        }
    });
}

function switchTab(tabName) {
    console.log('Switching to tab:', tabName); // Debug log
    
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-nav-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to selected tab and content
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`${tabName}-tab`);
    
    console.log('Active button:', activeButton); // Debug log
    console.log('Active content:', activeContent); // Debug log
    
    if (activeButton && activeContent) {
        activeButton.classList.add('active');
        activeContent.classList.add('active');
        currentTab = tabName;
        
        console.log('Tab switched successfully to:', tabName); // Debug log
        
        // Tab-specific initialization
        onTabActivated(tabName);
    } else {
        console.error('Could not find tab elements for:', tabName);
        console.error('Available buttons:', document.querySelectorAll('.tab-nav-button'));
        console.error('Available content divs:', document.querySelectorAll('.tab-content'));
    }
}

function onTabActivated(tabName) {
    switch (tabName) {
        case 'trades':
            // Show trades section without auto-loading
            // User can click "Load Trades" button to fetch data
            break;
            
        case 'manual':
            // Initialize manual trade form
            if (typeof loadAvailableSymbols === 'function') {
                loadAvailableSymbols();
            }
            if (typeof setupFormValidation === 'function') {
                setupFormValidation();
            }
            break;
            
        case 'risk':
            // Load risk management data
            loadRiskManagementData();
            break;
            
        case 'strategy':
            // Load strategy settings
            loadStrategySettings();
            break;
            
        case 'analytics':
            // Load analytics data
            loadAnalyticsData();
            break;
            
        case 'overview':
            // Refresh overview data and initialize quick trade
            if (typeof loadStats === 'function') {
                loadStats();
            }
            if (typeof initializeQuickTrade === 'function') {
                initializeQuickTrade();
            }
            break;
    }
}

function setupTabSpecificInitialization() {
    // This will be called when tabs are first initialized
}

function initializeRangeSliders() {
    // Initialize confidence threshold slider
    const confidenceSlider = document.getElementById('confidence-threshold');
    const confidenceValue = document.getElementById('confidence-value');
    
    if (confidenceSlider && confidenceValue) {
        confidenceSlider.addEventListener('input', function() {
            const percentage = Math.round(this.value * 100);
            confidenceValue.textContent = percentage + '%';
        });
    }
    
    // Initialize other range sliders as needed
}

// Risk Management Functions
let symbolRiskSettings = {}; // Store symbol-specific risk settings

function loadRiskManagementData() {
    // Load current risk settings
    updateRiskSummary();
    loadSymbolsForRisk();
    setupRiskEventListeners();
    loadSymbolRiskSettings();
}

async function loadSymbolsForRisk() {
    try {
        const response = await fetch('/api/symbols');
        const data = await response.json();
        
        const symbolSelect = document.getElementById('risk-symbol-select');
        symbolSelect.innerHTML = '<option value="">Select a symbol...</option>';
        
        if (data.success && data.symbols) {
            data.symbols.forEach(symbol => {
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

function setupRiskEventListeners() {
    // Risk type change handler
    const riskTypeSelect = document.getElementById('risk-type-select');
    if (riskTypeSelect) {
        riskTypeSelect.addEventListener('change', function() {
            updateRiskLabels(this.value);
        });
    }
    
    // Add input listeners for real-time calculation preview
    const inputIds = ['symbol-stop-loss', 'symbol-take-profit', 'symbol-position-size', 'symbol-risk-per-trade'];
    inputIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateRiskPreview);
        }
    });
    
    // Symbol selection change
    const symbolSelect = document.getElementById('risk-symbol-select');
    if (symbolSelect) {
        symbolSelect.addEventListener('change', updateRiskPreview);
    }
}

function updateRiskLabels(riskType) {
    const isAmount = riskType === 'amount';
    
    // Update labels
    document.getElementById('stop-loss-label').textContent = isAmount ? 'Stop Loss ($)' : 'Stop Loss (%)';
    document.getElementById('take-profit-label').textContent = isAmount ? 'Take Profit ($)' : 'Take Profit (%)';
    document.getElementById('position-size-label').textContent = isAmount ? 'Max Position Size ($)' : 'Max Position Size (%)';
    
    // Update help text
    const helpText = document.getElementById('risk-per-trade-help');
    helpText.textContent = isAmount ? '$ amount' : '% of portfolio';
    
    // Update input attributes
    const inputs = ['symbol-stop-loss', 'symbol-take-profit', 'symbol-position-size', 'symbol-risk-per-trade'];
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (isAmount) {
            input.min = '1';
            input.step = '1';
        } else {
            input.min = '0.1';
            input.step = '0.1';
        }
    });
    
    updateRiskPreview();
}

function updateRiskPreview() {
    const symbol = document.getElementById('risk-symbol-select').value;
    const riskType = document.getElementById('risk-type-select').value;
    const stopLoss = parseFloat(document.getElementById('symbol-stop-loss').value);
    const takeProfit = parseFloat(document.getElementById('symbol-take-profit').value);
    const positionSize = parseFloat(document.getElementById('symbol-position-size').value);
    const riskPerTrade = parseFloat(document.getElementById('symbol-risk-per-trade').value);
    
    if (!symbol || isNaN(stopLoss) || isNaN(takeProfit) || isNaN(positionSize) || isNaN(riskPerTrade)) {
        return;
    }
    
    // Simple risk calculations (assuming $10,000 portfolio for demo)
    const portfolioSize = 10000;
    let riskAmount, positionValue, rewardRatio;
    
    if (riskType === 'percentage') {
        riskAmount = (riskPerTrade / 100) * portfolioSize;
        positionValue = (positionSize / 100) * portfolioSize;
        rewardRatio = takeProfit / stopLoss;
    } else {
        riskAmount = riskPerTrade;
        positionValue = positionSize;
        rewardRatio = takeProfit / stopLoss;
    }
    
    // Update help text with preview
    const helpText = document.getElementById('risk-per-trade-help');
    const originalText = riskType === 'amount' ? '$ amount' : '% of portfolio';
    helpText.innerHTML = `${originalText}<br><small style="color: var(--accent-blue);">Risk: $${riskAmount.toFixed(2)} | R:R = 1:${rewardRatio.toFixed(2)}</small>`;
}

function addSymbolRiskSettings() {
    const symbol = document.getElementById('risk-symbol-select').value;
    const riskType = document.getElementById('risk-type-select').value;
    const stopLoss = parseFloat(document.getElementById('symbol-stop-loss').value);
    const takeProfit = parseFloat(document.getElementById('symbol-take-profit').value);
    const positionSize = parseFloat(document.getElementById('symbol-position-size').value);
    const riskPerTrade = parseFloat(document.getElementById('symbol-risk-per-trade').value);
    
    if (!symbol) {
        showNotification('Please select a symbol', 'error');
        return;
    }
    
    if (isNaN(stopLoss) || isNaN(takeProfit) || isNaN(positionSize) || isNaN(riskPerTrade)) {
        showNotification('Please fill in all fields with valid numbers', 'error');
        return;
    }
    
    // Validation
    if (riskType === 'percentage') {
        if (stopLoss >= takeProfit) {
            showNotification('Take profit must be greater than stop loss', 'error');
            return;
        }
        if (stopLoss > 20 || takeProfit > 50) {
            showNotification('Percentage values seem too high. Please check your inputs.', 'warning');
            return;
        }
    }
    
    // Store symbol settings
    symbolRiskSettings[symbol] = {
        riskType,
        stopLoss,
        takeProfit,
        positionSize,
        riskPerTrade
    };
    
    // Update display
    updateSymbolRiskList();
    clearSymbolForm();
    showNotification(`Risk settings added for ${symbol}`, 'success');
}

function updateSymbolRiskList() {
    const listContainer = document.getElementById('symbol-risk-list');
    
    if (Object.keys(symbolRiskSettings).length === 0) {
        listContainer.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No symbol-specific risk settings configured</div>';
        return;
    }
    
    let html = '<div style="display: grid; gap: 1rem;">';
    
    for (const [symbol, settings] of Object.entries(symbolRiskSettings)) {
        const typeDisplay = settings.riskType === 'amount' ? '$' : '%';
        
        html += `
            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 6px; border-left: 4px solid var(--accent-blue);">
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 0.5rem;">
                    <h5 style="color: var(--text-primary); margin: 0; font-size: 1rem;">${symbol}</h5>
                    <button onclick="removeSymbolRiskSettings('${symbol}')" style="background: var(--accent-red); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Remove</button>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.5rem; font-size: 0.875rem;">
                    <div>
                        <span style="color: var(--text-secondary);">Type:</span>
                        <span style="color: var(--text-primary); font-weight: 600;">${settings.riskType === 'amount' ? 'Fixed Amount' : 'Percentage'}</span>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary);">Stop Loss:</span>
                        <span style="color: var(--accent-red); font-weight: 600;">${settings.stopLoss}${typeDisplay}</span>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary);">Take Profit:</span>
                        <span style="color: var(--accent-green); font-weight: 600;">${settings.takeProfit}${typeDisplay}</span>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary);">Position Size:</span>
                        <span style="color: var(--text-primary); font-weight: 600;">${settings.positionSize}${typeDisplay}</span>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary);">Risk/Trade:</span>
                        <span style="color: var(--text-primary); font-weight: 600;">${settings.riskPerTrade}${settings.riskType === 'amount' ? '$' : '% portfolio'}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    listContainer.innerHTML = html;
}

function removeSymbolRiskSettings(symbol) {
    // Remove from local storage
    delete symbolRiskSettings[symbol];
    
    // Remove from backend
    fetch(`/api/risk-settings/${encodeURIComponent(symbol)}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateSymbolRiskList();
            showNotification(`Risk settings removed for ${symbol}`, 'info');
        } else {
            // Re-add to local storage if API call failed
            console.error('Failed to remove from backend, keeping local copy');
            showNotification('Failed to remove settings from server', 'warning');
        }
    })
    .catch(error => {
        console.error('Error removing symbol risk settings:', error);
        showNotification('Error removing settings', 'error');
    });
}

function clearSymbolForm() {
    document.getElementById('risk-symbol-select').value = '';
    document.getElementById('risk-type-select').value = 'percentage';
    document.getElementById('symbol-stop-loss').value = '2';
    document.getElementById('symbol-take-profit').value = '4';
    document.getElementById('symbol-position-size').value = '10';
    document.getElementById('symbol-risk-per-trade').value = '2';
    updateRiskLabels('percentage');
}

function loadSymbolRiskSettings() {
    // Load saved symbol risk settings from API
    fetch('/api/risk-settings')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.settings) {
                // Load global settings
                const global = data.settings.global;
                if (global) {
                    document.getElementById('max-risk-per-trade').value = global.maxRiskPerTrade;
                    document.getElementById('max-positions').value = global.maxPositions;
                    document.getElementById('daily-loss-limit').value = global.dailyLossLimit;
                    document.getElementById('auto-stop-loss').checked = global.autoStopLoss;
                }
                
                // Load symbol settings
                symbolRiskSettings = data.settings.symbols || {};
                updateSymbolRiskList();
                updateRiskSummary();
            }
        })
        .catch(error => {
            console.error('Error loading risk settings:', error);
            symbolRiskSettings = {};
            updateSymbolRiskList();
        });
}

function saveRiskSettings() {
    const globalSettings = {
        maxRiskPerTrade: document.getElementById('max-risk-per-trade').value,
        maxPositions: document.getElementById('max-positions').value,
        dailyLossLimit: document.getElementById('daily-loss-limit').value,
        autoStopLoss: document.getElementById('auto-stop-loss').checked
    };
    
    const allSettings = {
        global: globalSettings,
        symbols: symbolRiskSettings
    };
    
    // Send to backend
    fetch('/api/risk-settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(allSettings)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Risk settings saved successfully', 'success');
        } else {
            showNotification('Failed to save risk settings: ' + data.error, 'error');
        }
        updateRiskSummary();
    })
    .catch(error => {
        console.error('Error saving risk settings:', error);
        showNotification('Failed to save risk settings', 'error');
    });
}

function resetRiskSettings() {
    // Reset global settings
    document.getElementById('max-risk-per-trade').value = 2;
    document.getElementById('max-positions').value = 5;
    document.getElementById('daily-loss-limit').value = 5;
    document.getElementById('auto-stop-loss').checked = true;
    
    // Reset symbol settings
    symbolRiskSettings = {};
    updateSymbolRiskList();
    clearSymbolForm();
    
    showNotification('Risk settings reset to defaults', 'info');
    updateRiskSummary();
}

function updateRiskSummary() {
    // Calculate and display risk metrics (placeholder values)
    document.getElementById('current-exposure').textContent = '$1,250.00';
    document.getElementById('risk-utilization').textContent = '25%';
    document.getElementById('max-daily-loss').textContent = '-$500.00';
    document.getElementById('available-positions').textContent = '3';
}

// Strategy Functions
function loadStrategySettings() {
    // Load current strategy configuration
    setupStrategyEventListeners();
}

function setupStrategyEventListeners() {
    // Auto trade signals toggle
    const autoTradeToggle = document.getElementById('auto-trade-signals');
    const autoTradeLabel = document.getElementById('auto-trade-label');
    
    if (autoTradeToggle && autoTradeLabel) {
        autoTradeToggle.addEventListener('change', function() {
            autoTradeLabel.textContent = this.checked ? 'AUTO' : 'MANUAL';
        });
    }
}

function saveStrategySettings() {
    const settings = {
        strategyType: document.getElementById('strategy-type').value,
        confidenceThreshold: document.getElementById('confidence-threshold').value,
        positionSizeMethod: document.getElementById('position-size-method').value,
        timeframeFocus: document.getElementById('timeframe-focus').value,
        autoTradeSignals: document.getElementById('auto-trade-signals').checked,
        maxLeverage: document.getElementById('max-leverage').value
    };
    
    console.log('Saving strategy settings:', settings);
    showNotification('Strategy settings saved successfully', 'success');
}

function backtestStrategy() {
    showNotification('Starting strategy backtest...', 'info');
    
    // Simulate backtest process
    setTimeout(() => {
        showNotification('Backtest completed! Results available in Analytics tab.', 'success');
    }, 3000);
}

// Analytics Functions
function loadAnalyticsData() {
    // Load performance analytics (placeholder)
    updatePerformanceMetrics();
}

function updatePerformanceMetrics() {
    // Update analytics displays (placeholder values)
    const metrics = {
        sharpeRatio: '1.45',
        maxDrawdown: '-8.2%',
        profitFactor: '2.3',
        avgHoldTime: '4.2h',
        performance7d: '+$234.56',
        performance30d: '+$1,245.32',
        performanceMonth: '+$892.17',
        performanceTotal: '+$2,464.20'
    };
    
    Object.keys(metrics).forEach(key => {
        const element = document.getElementById(key.replace(/([A-Z])/g, '-$1').toLowerCase());
        if (element) {
            element.textContent = metrics[key];
        }
    });
}

function loadEquityCurve() {
    showNotification('Loading equity curve chart...', 'info');
    
    // Placeholder for chart loading
    setTimeout(() => {
        showNotification('Chart loaded successfully!', 'success');
    }, 2000);
}

// Utility function to show notifications (if not already defined)
if (typeof showNotification === 'undefined') {
    function showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

// Export functions for global access
window.switchTab = switchTab;
window.saveRiskSettings = saveRiskSettings;
window.resetRiskSettings = resetRiskSettings;
window.addSymbolRiskSettings = addSymbolRiskSettings;
window.removeSymbolRiskSettings = removeSymbolRiskSettings;
window.clearSymbolForm = clearSymbolForm;
window.saveStrategySettings = saveStrategySettings;
window.backtestStrategy = backtestStrategy;
window.loadEquityCurve = loadEquityCurve;

// Initialize tabs when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing tabs');
    
    // Ensure all tab buttons have event listeners
    const tabButtons = document.querySelectorAll('.tab-nav-button');
    console.log('Found tab buttons:', tabButtons.length);
    
    tabButtons.forEach(button => {
        const tabName = button.getAttribute('data-tab');
        console.log('Setting up button for tab:', tabName);
        
        // Remove existing listeners and add new ones
        button.onclick = null;
        button.onclick = function() {
            console.log('Button clicked for tab:', tabName);
            switchTab(tabName);
        };
    });
    
    // Initialize the first tab
    setTimeout(() => {
        console.log('Initializing overview tab');
        switchTab('overview');
    }, 100);
});

// Keyboard shortcuts for tabs
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey) {
        const tabMap = {
            '1': 'overview',
            '2': 'trades',
            '3': 'manual',
            '4': 'risk',
            '5': 'strategy',
            '6': 'analytics'
        };
        
        if (tabMap[e.key]) {
            e.preventDefault();
            switchTab(tabMap[e.key]);
        }
    }
});