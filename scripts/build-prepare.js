const fs = require('fs');
const path = require('path');

console.log('🔨 Preparing production build...');

// Create build directory
const buildDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
    console.log('✅ Created dist directory');
}

// Copy necessary files
const filesToCopy = [
    'src',
    'public',
    'config',
    'package.json',
    '.env.example'
];

filesToCopy.forEach(file => {
    const sourcePath = path.join(__dirname, '..', file);
    const destPath = path.join(buildDir, file);
    
    if (fs.existsSync(sourcePath)) {
        copyRecursive(sourcePath, destPath);
        console.log(`✅ Copied ${file}`);
    }
});

// Create production package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

// Remove dev dependencies for production
const prodPackageJson = {
    ...packageJson,
    scripts: {
        start: "NODE_ENV=production node src/app.js"
    },
    devDependencies: {} // Remove dev dependencies
};

fs.writeFileSync(
    path.join(buildDir, 'package.json'), 
    JSON.stringify(prodPackageJson, null, 2)
);

console.log('✅ Production build prepared successfully!');

function copyRecursive(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursive(
                path.join(src, childItemName),
                path.join(dest, childItemName)
            );
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}