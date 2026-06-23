// File cấu hình PM2 (process manager) - .cjs vì package.json đặt "type":
// "module", còn pm2 đọc config theo CommonJS (module.exports).
module.exports = {
  apps: [
    {
      name: "social-analyzer-backend",
      script: "src/server.js",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_memory_restart: "300M",
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      time: true,
    },
  ],
};
