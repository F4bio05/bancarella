/**
 * Configurazione pm2 per Bancarella.
 *
 *   npm i -g pm2
 *   npm ci && npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup      # esegui il comando che stampa
 *   pm2 logs bancarella
 *
 * Alternativa senza pm2: deploy/bancarella.service (systemd). Usa una delle
 * due, non entrambe, o si azzuffano sulla stessa porta.
 */

module.exports = {
  apps: [
    {
      name: "bancarella",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      // -H 127.0.0.1: l'app ascolta solo in locale, si entra solo da nginx
      // (e quindi da HTTPS). La porta 5000 va poi nel proxy_pass di nginx.
      args: "start -H 127.0.0.1 -p 5000",

      // Il database è un file SQLite: un solo processo, mai cluster mode.
      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      max_restarts: 10,
      min_uptime: "20s",
      max_memory_restart: "500M",
      time: true,

      env: {
        NODE_ENV: "production",
        // Il database vive fuori dalla cartella dell'app: un deploy non lo tocca.
        DATA_DIR: "/var/lib/bancarella",
        // Da attivare SOLO se il sito risponde in HTTP e non in HTTPS,
        // altrimenti il browser scarta il cookie di sessione.
        // COOKIE_NON_SICURO: "1",
      },
    },
  ],
};
