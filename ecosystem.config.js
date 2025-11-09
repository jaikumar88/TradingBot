module.exports = {
  apps: [
    {
      name: 'trading-bot',
      script: 'src/app.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 5000,
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // Process management
      pid_file: './logs/trading-bot.pid',
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000,
      
      // Resource limits
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};