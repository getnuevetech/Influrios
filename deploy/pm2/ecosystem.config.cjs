module.exports = {
  apps: [
    {
      name: "influrios",
      cwd: "/var/www/influrios",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      // Loads DATABASE_URL / NEXT_PUBLIC_* from the app .env
      env_file: "/var/www/influrios/.env",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "768M",
      time: true,
      error_file: "/var/www/influrios/logs/pm2-error.log",
      out_file: "/var/www/influrios/logs/pm2-out.log",
    },
  ],
};
