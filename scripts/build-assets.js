const fs = require('fs');
const path = require('path');

console.log('📦 Building production assets...');

// Minify CSS (basic minification)
function minifyCSS(cssContent) {
    return cssContent
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\s*{\s*/g, '{') // Remove spaces around braces
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*;\s*/g, ';') // Remove spaces around semicolons
        .trim();
}

// Minify JS (basic minification)
function minifyJS(jsContent) {
    return jsContent
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/.*$/gm, '') // Remove line comments
        .replace(/\s+/g, ' ') // Replace multiple spaces
        .replace(/\s*{\s*/g, '{')
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*;\s*/g, ';')
        .trim();
}

// Process dashboard files
const publicDir = path.join(__dirname, '..', 'dist', 'public');
const indexPath = path.join(publicDir, 'index.html');
const jsPath = path.join(publicDir, 'dashboard.js');

if (fs.existsSync(indexPath)) {
    let htmlContent = fs.readFileSync(indexPath, 'utf8');
    
    // Extract and minify inline CSS
    htmlContent = htmlContent.replace(/<style>([\s\S]*?)<\/style>/g, (match, css) => {
        return `<style>${minifyCSS(css)}</style>`;
    });
    
    // Add production optimizations
    htmlContent = htmlContent.replace(
        '<head>',
        `<head>
        <meta name="robots" content="noindex, nofollow">
        <meta name="referrer" content="no-referrer">
        <link rel="preload" href="dashboard.js" as="script">`
    );
    
    fs.writeFileSync(indexPath, htmlContent);
    console.log('✅ Optimized index.html');
}

if (fs.existsSync(jsPath)) {
    let jsContent = fs.readFileSync(jsPath, 'utf8');
    
    // Add production API endpoint
    jsContent = `
// Production configuration
const API_BASE_URL = window.location.origin;
const IS_PRODUCTION = true;

${jsContent}
`;
    
    jsContent = minifyJS(jsContent);
    fs.writeFileSync(jsPath, jsContent);
    console.log('✅ Optimized dashboard.js');
}

console.log('✅ Production assets built successfully!');