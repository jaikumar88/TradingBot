// === MANUAL TRADE ENTRY FUNCTIONS ===

// Toggle manual trade form visibility
function toggleManualTradeForm() {
    const form = document.getElementById('manual-trade-form');
    const toggleText = document.getElementById('manual-trade-toggle-text');
    const toggleBtn = document.getElementById('toggle-manual-trade');
    
    if (form.style.display === 'none' || !form.style.display) {
        form.style.display = 'block';
        toggleText.textContent = 'Hide Form';
        toggleBtn.classList.replace('btn-outline', 'btn-success');
        loadAvailableSymbols();
        setupFormValidation();
    } else {
        form.style.display = 'none';
        toggleText.textContent = 'Show Form';
        toggleBtn.classList.replace('btn-success', 'btn-outline');
    }
}

// Load available symbols from API
async function loadAvailableSymbols() {
    try {
        const response = await fetch('/api/symbols');
        const data = await response.json();
        
        const symbolSelect = document.getElementById('trade-symbol');
        if (data.success && data.data) {
            symbolSelect.innerHTML = '<option value="">Select Symbol...</option>';
            data.data.forEach(symbol => {
                const option = document.createElement('option');
                option.value = symbol;
                option.textContent = symbol;
                symbolSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading symbols:', error);
    }
}

// Setup form validation
function setupFormValidation() {
    const requiredFields = ['trade-symbol', 'trade-side', 'trade-quantity', 'trade-entry-price'];
    const createBtn = document.getElementById('create-manual-trade');
    
    function validateForm() {
        const isValid = requiredFields.every(fieldId => {
            const field = document.getElementById(fieldId);
            return field && field.value.trim() !== '';
        });
        
        createBtn.disabled = !isValid;
        return isValid;
    }
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', validateForm);
            field.addEventListener('change', validateForm);
        }
    });
    
    validateForm(); // Initial validation
}

// Get current market price for selected symbol
async function getMarketPrice() {
    const symbolSelect = document.getElementById('trade-symbol');
    const entryPriceInput = document.getElementById('trade-entry-price');
    
    if (!symbolSelect.value) {
        alert('Please select a symbol first');
        return;
    }
    
    const btn = document.getElementById('get-market-price');
    btn.disabled = true;
    btn.textContent = '📊 Loading...';
    
    try {
        const response = await fetch(`https://api.india.delta.exchange/v2/tickers/${symbolSelect.value}`);
        const data = await response.json();
        
        if (data.result && data.result.mark_price) {
            entryPriceInput.value = parseFloat(data.result.mark_price).toFixed(2);
            showNotification('Market price loaded successfully', 'success');
        } else {
            throw new Error('Failed to get market price');
        }
    } catch (error) {
        console.error('Error getting market price:', error);
        showNotification('Failed to get market price', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '📊 Get Market Price';
    }
}

// Create manual trade
async function createManualTrade() {
    const symbol = document.getElementById('trade-symbol').value;
    const side = document.getElementById('trade-side').value;
    const quantity = parseFloat(document.getElementById('trade-quantity').value);
    const entryPrice = parseFloat(document.getElementById('trade-entry-price').value);
    const stopLoss = document.getElementById('trade-stop-loss').value ? 
        parseFloat(document.getElementById('trade-stop-loss').value) : null;
    const takeProfit = document.getElementById('trade-take-profit').value ? 
        parseFloat(document.getElementById('trade-take-profit').value) : null;
    
    // Validation
    if (!symbol || !side || !quantity || !entryPrice) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (quantity <= 0 || entryPrice <= 0) {
        showNotification('Quantity and entry price must be positive', 'error');
        return;
    }
    
    if (stopLoss && ((side === 'buy' && stopLoss >= entryPrice) || (side === 'sell' && stopLoss <= entryPrice))) {
        showNotification('Invalid stop loss price for this trade direction', 'error');
        return;
    }
    
    if (takeProfit && ((side === 'buy' && takeProfit <= entryPrice) || (side === 'sell' && takeProfit >= entryPrice))) {
        showNotification('Invalid take profit price for this trade direction', 'error');
        return;
    }
    
    const createBtn = document.getElementById('create-manual-trade');
    createBtn.disabled = true;
    createBtn.textContent = '🚀 Creating...';
    
    try {
        const tradeData = {
            symbol,
            side,
            quantity,
            entry_price: entryPrice,
            stop_loss: stopLoss,
            take_profit: takeProfit,
            reason: 'manual_entry'
        };
        
        const response = await fetch('/api/trades', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tradeData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Trade created successfully!', 'success');
            clearManualTradeForm();
            if (typeof loadTrades === 'function') loadTrades(); // Refresh trades table
            if (typeof loadStats === 'function') loadStats(); // Refresh statistics
        } else {
            throw new Error(result.error || 'Failed to create trade');
        }
        
    } catch (error) {
        console.error('Error creating trade:', error);
        showNotification(`Failed to create trade: ${error.message}`, 'error');
    } finally {
        createBtn.disabled = false;
        createBtn.textContent = '🚀 Create Trade';
        setupFormValidation(); // Re-enable validation
    }
}

// Clear manual trade form
function clearManualTradeForm() {
    document.getElementById('trade-symbol').value = '';
    document.getElementById('trade-side').value = '';
    document.getElementById('trade-quantity').value = '';
    document.getElementById('trade-entry-price').value = '';
    document.getElementById('trade-stop-loss').value = '';
    document.getElementById('trade-take-profit').value = '';
    
    const createBtn = document.getElementById('create-manual-trade');
    createBtn.disabled = true;
}

// Show notification to user
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        max-width: 400px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease;
    `;
    
    switch (type) {
        case 'success':
            notification.style.background = '#02c076';
            break;
        case 'error':
            notification.style.background = '#f84960';
            break;
        case 'warning':
            notification.style.background = '#ffc107';
            break;
        default:
            notification.style.background = '#3c9eff';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Expose global functions
window.toggleManualTradeForm = toggleManualTradeForm;
window.getMarketPrice = getMarketPrice;
window.createManualTrade = createManualTrade;
window.clearManualTradeForm = clearManualTradeForm;