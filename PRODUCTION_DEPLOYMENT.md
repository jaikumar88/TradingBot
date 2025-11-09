# Production Build Configuration

## Build Scripts
```json
{
  "scripts": {
    "build": "npm run build:client && npm run build:server",
    "build:client": "webpack --mode=production",
    "build:server": "node scripts/build-server.js",
    "start:prod": "NODE_ENV=production node dist/app.js",
    "deploy": "npm run build && npm run deploy:vercel"
  }
}
```

## Environment Configuration
```bash
# Production Environment Variables
NODE_ENV=production
PORT=3000

# API Keys (Required for production)
TELEGRAM_BOT_TOKEN=your_production_bot_token
OPENAI_API_KEY=your_production_openai_key
DELTA_API_KEY=your_production_delta_key
DELTA_SECRET=your_production_delta_secret
DELTA_PASSPHRASE=your_production_passphrase

# Database
DATABASE_URL=your_production_database_url

# Security
SESSION_SECRET=your_secure_session_secret
CORS_ORIGIN=https://yourdomain.com
```

## Deployment Platforms

### 1. Vercel (Recommended for Frontend + Serverless)
- ✅ Free tier available
- ✅ Automatic deployments from GitHub
- ✅ Custom domains
- ✅ Global CDN

### 2. Railway (Recommended for Full Stack)
- ✅ Database included
- ✅ Continuous deployment
- ✅ Environment variables
- ✅ Custom domains

### 3. Heroku
- ✅ Easy deployment
- ✅ Add-ons ecosystem
- ✅ Scaling options

### 4. DigitalOcean App Platform
- ✅ Full control
- ✅ Database options
- ✅ Load balancing