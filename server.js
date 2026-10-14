// Backup Entry point for cPanel / CloudLinux / LiteSpeed Node.js Runner
process.env.NODE_ENV = 'production';

try {
  require('./dist/server.cjs');
} catch (err) {
  if (err && err.code === 'ERR_REQUIRE_ESM') {
    import('./dist/server.cjs');
  } else {
    console.error('[cPanel Startup Error]', err);
    try {
      const http = require('http');
      const server = http.createServer((req, res) => {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <div style="font-family:sans-serif;max-width:600px;margin:50px auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;">
            <h2 style="color:#dc2626;margin-top:0;">SIPAK Guru - Startup Error</h2>
            <p style="color:#334155;">Terjadi kendala saat inisialisasi server di cPanel hosting:</p>
            <pre style="background:#0f172a;color:#f87171;padding:12px;border-radius:8px;overflow:auto;font-size:12px;">${err?.stack || String(err)}</pre>
            <p style="color:#64748b;font-size:12px;">Pastikan Anda sudah mengekstrak folder <code>dist</code> dan menjalankan <code>npm install</code>.</p>
          </div>
        `);
      });
      if (typeof PhusionPassenger !== 'undefined') {
        server.listen('passenger');
      } else {
        server.listen(process.env.PORT || 3000);
      }
    } catch (innerErr) {
      console.error('Fallback error handler failed:', innerErr);
    }
  }
}
