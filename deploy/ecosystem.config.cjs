// PM2 process file: keeps the API running and restarts it after crashes or reboots.
// Start:  pm2 start deploy/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'dandiya-api',
      cwd: __dirname + '/../server',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production' },
      time: true,
    },
  ],
};
