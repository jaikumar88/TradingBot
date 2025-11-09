const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'trading.db');
console.log('Connecting to database:', dbPath);

try {
    const db = new Database(dbPath);
    
    // Get all trades
    const trades = db.prepare('SELECT * FROM trades ORDER BY createdAt DESC LIMIT 10').all();
    console.log('\n📊 Recent Trades:');
    console.log('='.repeat(80));
    
    if (trades.length === 0) {
        console.log('No trades found in database');
    } else {
        trades.forEach((trade, index) => {
            console.log(`\n${index + 1}. Trade ID: ${trade.id}`);
            console.log(`   Symbol: ${trade.symbol} | Side: ${trade.side}`);
            console.log(`   Entry: $${trade.entryPrice} | Status: ${trade.status}`);
            console.log(`   Stop Loss: $${trade.stopLoss} | Take Profit: $${trade.takeProfit}`);
            console.log(`   Created: ${trade.createdAt}`);
            
            if (trade.failReason) {
                console.log(`   ❌ Fail Reason: ${trade.failReason}`);
            }
            
            if (trade.orderId) {
                console.log(`   📋 Order ID: ${trade.orderId}`);
            }
        });
    }
    
    // Get trade counts by status
    const statusCounts = db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM trades 
        GROUP BY status
    `).all();
    
    console.log('\n📈 Trade Status Summary:');
    console.log('='.repeat(30));
    statusCounts.forEach(row => {
        console.log(`${row.status}: ${row.count} trades`);
    });
    
    db.close();
    console.log('\n✅ Database check completed');
    
} catch (error) {
    console.error('❌ Error checking database:', error);
}