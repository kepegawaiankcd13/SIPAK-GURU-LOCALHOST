// Entry point for cPanel / CloudLinux Phusion Passenger
// Mendukung CommonJS dan ES Module secara universal di Node.js 18, 20, 22
(async () => {
  try {
    // 1. Muat bundle server produksi dari dist/server.cjs
    await import('./dist/server.cjs');
  } catch (err) {
    console.error('[cPanel Startup] Gagal memuat ./dist/server.cjs:', err);

    // 2. Jika bundle belum ter-upload atau hilang, tampilkan halaman diagnosa ramah di browser
    try {
      const http = await import('http');
      const server = http.createServer((req, res) => {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 50px auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
              <span style="font-size: 32px;">⚠️</span>
              <div>
                <h2 style="margin: 0; color: #dc2626; font-size: 22px;">SIPAK Guru - Folder 'dist' Belum Ditemukan</h2>
                <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">Node.js cPanel berhasil membaca file <code>app.js</code> ini, namun belum menemukan file bundle.</p>
              </div>
            </div>
            
            <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
              <p style="margin: 0 0 8px; font-weight: bold; color: #1e293b;">Langkah Penyelesaian:</p>
              <ol style="margin: 0; padding-left: 20px; color: #334155; line-height: 1.6; font-size: 14px;">
                <li>Pastikan folder <b>dist</b> (yang berisi <code>server.cjs</code> dan <code>index.html</code>) sudah di-upload ke folder yang sama dengan <code>app.js</code>.</li>
                <li>Setelah folder <code>dist</code> di-upload, buka menu <b>Setup Node.js App</b> di cPanel dan klik <b>RESTART</b>.</li>
              </ol>
            </div>

            <details style="margin-top: 16px;">
              <summary style="cursor: pointer; color: #64748b; font-size: 13px;">Lihat detail log error</summary>
              <pre style="background: #0f172a; color: #f87171; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto; margin-top: 8px;">${err && err.stack ? err.stack : String(err)}</pre>
            </details>
          </div>
        `);
      });

      const port = process.env.PORT || 3000;
      server.listen(port, () => {
        console.log('[cPanel Diagnostic] Fallback server aktif di port/socket:', port);
      });
    } catch (fallbackErr) {
      console.error('[cPanel Diagnostic] Gagal menjalankan fallback server:', fallbackErr);
    }
  }
})();
