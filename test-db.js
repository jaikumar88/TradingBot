// Test script to check database and API issues
const DatabaseService = require('./src/services/DatabaseService.js');

async function checkDatabase() {
    try {
        const db = new DatabaseService('./trading.db');
        console.log('=== CHECKING DATABASE ===');
        
        const trades = await db.getAllTrades();
        console.log(`Found ${trades.length} trades:`);
        trades.forEach(trade => {
            console.log(`ID: ${trade.id}, Symbol: ${trade.symbol}, Status: ${trade.status}, Entry: ${trade.entry_price}`);
        });
        
        // Test if we can create a test trade to delete
        console.log('\n=== CREATING TEST TRADE FOR DELETE ===');
        const testTrade = await db.createTrade({
            symbol: 'BTCUSDT',
            side: 'buy',
            size: 0.001,
            entry_price: 45000,
            status: 'closed',
            created_at: new Date().toISOString()
        });
        console.log(`Created test trade with ID: ${testTrade.id}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Database error:', error);
        process.exit(1);
    }
}

checkDatabase();