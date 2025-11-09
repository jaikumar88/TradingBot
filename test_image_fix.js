// Quick fix for the test image in TelegramService.js
const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'src', 'services', 'TelegramService.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the extremely long test image with a proper short one
const shortTestImage = '/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/wAARCABQAFADASIAAhEBAxEB/8QAGwAAAgMBAQEAAAAAAAAAAAAABAUDBgcCAAE//8QAOhAAAgEDAwMCBQEGBAYDAAAAAAECAwQRBQYhEjFBURMiYRQycYGRoQcjQrHB0RVi4fDxCCQzNHKS/8QAIREAAQMCBwEAAAAAAAAAAAAAAgEDBBESEyExQVFhcf/aAAwDAQACEQMRAD8AKx+l/wC6/J4PDjPHvT8/l99F3ydpR3bnLQ==';

// Find the problematic line and replace it
const regex = /const testImageBase64 = `[^`]+`;/;
const replacement = `const testImageBase64 = '${shortTestImage}'; // 80x80px JPEG chart`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Fixed test image in TelegramService.js');
    console.log(`📏 New test image length: ${shortTestImage.length} characters`);
} else {
    console.log('❌ Could not find the test image pattern to replace');
}