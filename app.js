// Entry point for cPanel / CloudLinux / LiteSpeed Node.js Runner
// Mendukung CommonJS dan ES Module secara universal di Node.js 18, 20, 22
try {
  if (typeof require !== 'undefined') {
    require('./dist/server.cjs');
  } else {
    await import('./dist/server.cjs');
  }
} catch (err) {
  console.error('[cPanel Startup Error]', err);
  try {
    const http = typeof require !== 'undefined' ? require('http') : (await import('http')).default;
    const server = http.createServer((req, res) => {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div style="font-family:sans-serif;max-width:600px;margin:50px auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="color:#dc2626;">SIPAK Guru - Startup Error</h2>
          <p>Terjadi kendala saat inisialisasi server di cPanel hosting:</p>
          <pre style="background:#0f172a;color:#f87171;padding:12px;border-radius:8px;overflow:auto;">${err?.stack || String(err)}</pre>
        </div>
      `);
    });
    if (typeof PhusionPassenger !== 'undefined') {
      server.listen('passenger');
    } else {
      server.listen(process.env.PORT || 3000);
    }
  } catch (innerErr) {
    console.error('Fallback server error:', innerErr);
  }
}
