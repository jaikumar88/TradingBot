const crypto = require('crypto');
const axios = require('axios');

const apiKey = 'PfWaP4MA4xvqgeNk3ew7dthRwhhyKv';
const apiSecret = 'FSYWFQCvbRNHd79yKTdBn8ZAfCk0pEWnOEaC9HIksy86fY2HgO09kWeE3tU1';
const baseUrl = 'https://api.delta.exchange';

function generateSignature(method, path, timestamp, body = '') {
    const message = method + timestamp + path + body;
    return crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
}

async function testAuth() {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'GET';
    const path = '/v2/wallet/balances';
    const signature = generateSignature(method, path, timestamp);
    
    const headers = {
        'api-key': apiKey,
        'timestamp': timestamp,
        'signature': signature,
        'Content-Type': 'application/json'
    };
    
    console.log('Testing authentication...');
    console.log('API Key:', apiKey);
    console.log('Timestamp:', timestamp);
    console.log('Signature:', signature.substring(0, 16) + '...');
    console.log('Message:', method + timestamp + path);
    
    try {
        const response = await axios.get(`${baseUrl}${path}`, { headers });
        console.log('✅ Authentication successful!');
        console.log('Balance data:', response.data);
    } catch (error) {
        console.log('❌ Authentication failed!');
        console.log('Status:', error.response?.status);
        console.log('Error:', JSON.stringify(error.response?.data, null, 2));
        
        // Test if it's an IP restriction issue
        if (error.response?.data?.error?.code === 'invalid_api_key') {
            console.log('\n🔍 This might be due to:');
            console.log('1. API keys don\'t have trading permissions');
            console.log('2. IP address not whitelisted');
            console.log('3. API keys are for testnet but connecting to mainnet');
            console.log('4. Incorrect signature generation');
        }
    }
}

async function testPublicEndpoint() {
    console.log('\n🔍 Testing public endpoint...');
    try {
        const response = await axios.get(`${baseUrl}/v2/products`);
        console.log('✅ Public endpoint works');
    } catch (error) {
        console.log('❌ Public endpoint failed');
    }
}

async function runTests() {
    await testPublicEndpoint();
    await testAuth();
}

runTests();