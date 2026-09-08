import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { getDbPool, checkDbConnection, getDatabaseSqlContent } from "./src/server/db";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // JSON Body Parser for API requests
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Simple health status API
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Database Connection Status check (XAMPP MySQL / MariaDB)
  app.get("/api/db-status", async (req, res) => {
    try {
      const status = await checkDbConnection();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({
        connected: false,
        message: `Database status check failed: ${err.message || err}`,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Download database.sql directly for phpMyAdmin in XAMPP
  app.get("/api/download-sql", (req, res) => {
    try {
      const sqlContent = getDatabaseSqlContent();
      res.setHeader("Content-Type", "application/sql");
      res.setHeader("Content-Disposition", 'attachment; filename="sipak_guru_db.sql"');
      res.send(sqlContent);
    } catch (err: any) {
      res.status(500).send(`Error downloading SQL file: ${err.message}`);
    }
  });

  // Schema summary information for documentation
  app.get("/api/schema-info", (req, res) => {
    res.json({
      database: process.env.DB_NAME || "sipak_guru_db",
      charset: "utf8mb4",
      collation: "utf8mb4_unicode_ci",
      tables: [
        {
          name: "app_users",
          description: "Akun login Super Admin dan Operator Sekolah",
          primaryKey: "username",
          columns: ["id", "username", "password", "role", "school", "displayName", "created_at", "updated_at"]
        },
        {
          name: "schools",
          description: "Master Data Unit Kerja / Sekolah di bawah KCD XIII",
          primaryKey: "id",
          columns: ["id", "npsn", "name", "address", "city", "principalName", "principalNip", "principalStatus"]
        },
        {
          name: "teachers",
          description: "Data Guru PNS, Pangkat, TMT, SK PAK, Spesimen TTD / TTE",
          primaryKey: "id",
          columns: ["id", "name", "nip", "school", "currentGolongan", "targetGolongan", "baseAK", "akIntegrasi2022", "akPendidikan", "ratingSKP", "workDurationYears", "karpegNumber", "birthPlaceDate", "gender", "tmtCurrentPangkat", "tmtCurrentJabatan", "unitKerja", "instansiBiro", "nomorSuratKonversi", "nomorSuratAkumulasi", "nomorSuratPenetapan", "tempatDitetapkan", "tanggalPenetapan", "pejabatPenilaiTitle", "pejabatPenilaiInstansi", "pejabatPenilaiNama", "pejabatPenilaiNip", "pejabatPenilaiGolongan", "pejabatPenilaiStatus", "signatureType", "ttdBasahType", "ttdBasahImageUrl", "ttdBasahImageBase64", "ttdBasahHeight", "tteLogoType", "tteLogoUrl", "tteLogoBase64", "tteTextHeader", "tteTextJabatan1", "tteTextJabatan2", "skPangkatFileLink", "pakIntegrasiFileLink", "ijazahFileLink", "additionalFileLink", "createdBy"]
        },
        {
          name: "evaluations",
          description: "Riwayat konversi predikat SKP ke Angka Kredit per tahun",
          primaryKey: "id",
          foreignKey: "teacherId -> teachers.id (CASCADE)",
          columns: ["id", "teacherId", "year", "period", "rating", "level", "coefficient", "multiplier", "creditEarned", "akPendidikan", "notes", "startDate", "endDate", "isCustomRange", "customMonths", "skpFileLink", "evidenceFileLink", "overrideData", "createdBy"]
        },
        {
          name: "kop_settings",
          description: "Pengaturan KOP Surat Dinas dan Spesimen Tanda Tangan",
          primaryKey: "id",
          columns: ["id", "logoType", "customLogoUrl", "row1", "row2", "row3", "row4", "row5", "row6", "signatureType", "ttdBasahType", "ttdBasahImageUrl", "ttdBasahImageBase64", "ttdBasahHeight", "tteLogoType", "tteLogoUrl", "tteLogoBase64", "tteTextHeader", "tteTextJabatan1", "tteTextJabatan2"]
        },
        {
          name: "system_logs",
          description: "Audit trail log operasional sistem",
          primaryKey: "id",
          columns: ["id", "timestamp", "error", "operationType", "path", "userId", "email", "browser", "severity", "resolved", "resolutionNotes"]
        }
      ]
    });
  });

  // =========================================================================
  // MySQL REST API Endpoints (Localhost / XAMPP)
  // =========================================================================

  // GET Teachers
  app.get("/api/mysql/teachers", async (req, res) => {
    try {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>("SELECT * FROM `teachers` ORDER BY `name` ASC");
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST / Upsert Teacher
  app.post("/api/mysql/teachers", async (req, res) => {
    try {
      const pool = getDbPool();
      const t = req.body;
      const sql = `
        INSERT INTO \`teachers\` (
          id, name, nip, school, currentGolongan, targetGolongan,
          baseAK, akIntegrasi2022, akPendidikan, ratingSKP, workDurationYears,
          karpegNumber, birthPlaceDate, gender, tmtCurrentPangkat, tmtCurrentJabatan,
          unitKerja, instansiBiro, nomorSuratKonversi, nomorSuratAkumulasi, nomorSuratPenetapan,
          tempatDitetapkan, tanggalPenetapan, pejabatPenilaiTitle, pejabatPenilaiInstansi,
          pejabatPenilaiNama, pejabatPenilaiNip, pejabatPenilaiGolongan, pejabatPenilaiStatus,
          signatureType, ttdBasahType, ttdBasahImageUrl, ttdBasahImageBase64, ttdBasahHeight,
          tteLogoType, tteLogoUrl, tteLogoBase64, tteTextHeader, tteTextJabatan1, tteTextJabatan2,
          skPangkatFileLink, pakIntegrasiFileLink, ijazahFileLink, additionalFileLink, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name), nip = VALUES(nip), school = VALUES(school),
          currentGolongan = VALUES(currentGolongan), targetGolongan = VALUES(targetGolongan),
          baseAK = VALUES(baseAK), akIntegrasi2022 = VALUES(akIntegrasi2022), akPendidikan = VALUES(akPendidikan),
          ratingSKP = VALUES(ratingSKP), workDurationYears = VALUES(workDurationYears),
          karpegNumber = VALUES(karpegNumber), birthPlaceDate = VALUES(birthPlaceDate), gender = VALUES(gender),
          tmtCurrentPangkat = VALUES(tmtCurrentPangkat), tmtCurrentJabatan = VALUES(tmtCurrentJabatan),
          unitKerja = VALUES(unitKerja), instansiBiro = VALUES(instansiBiro),
          nomorSuratKonversi = VALUES(nomorSuratKonversi), nomorSuratAkumulasi = VALUES(nomorSuratAkumulasi),
          nomorSuratPenetapan = VALUES(nomorSuratPenetapan), tempatDitetapkan = VALUES(tempatDitetapkan),
          tanggalPenetapan = VALUES(tanggalPenetapan), pejabatPenilaiTitle = VALUES(pejabatPenilaiTitle),
          pejabatPenilaiInstansi = VALUES(pejabatPenilaiInstansi), pejabatPenilaiNama = VALUES(pejabatPenilaiNama),
          pejabatPenilaiNip = VALUES(pejabatPenilaiNip), pejabatPenilaiGolongan = VALUES(pejabatPenilaiGolongan),
          pejabatPenilaiStatus = VALUES(pejabatPenilaiStatus), signatureType = VALUES(signatureType),
          ttdBasahType = VALUES(ttdBasahType), ttdBasahImageUrl = VALUES(ttdBasahImageUrl),
          ttdBasahImageBase64 = VALUES(ttdBasahImageBase64), ttdBasahHeight = VALUES(ttdBasahHeight),
          tteLogoType = VALUES(tteLogoType), tteLogoUrl = VALUES(tteLogoUrl), tteLogoBase64 = VALUES(tteLogoBase64),
          tteTextHeader = VALUES(tteTextHeader), tteTextJabatan1 = VALUES(tteTextJabatan1), tteTextJabatan2 = VALUES(tteTextJabatan2),
          skPangkatFileLink = VALUES(skPangkatFileLink), pakIntegrasiFileLink = VALUES(pakIntegrasiFileLink),
          ijazahFileLink = VALUES(ijazahFileLink), additionalFileLink = VALUES(additionalFileLink)
      `;
      const values = [
        t.id, t.name, t.nip, t.school, t.currentGolongan, t.targetGolongan,
        t.baseAK || 0, t.akIntegrasi2022 || 0, t.akPendidikan || 0, t.ratingSKP || 'Baik', t.workDurationYears || 0,
        t.karpegNumber || null, t.birthPlaceDate || null, t.gender || 'Laki-Laki', t.tmtCurrentPangkat || null, t.tmtCurrentJabatan || null,
        t.unitKerja || null, t.instansiBiro || null, t.nomorSuratKonversi || null, t.nomorSuratAkumulasi || null, t.nomorSuratPenetapan || null,
        t.tempatDitetapkan || null, t.tanggalPenetapan || null, t.pejabatPenilaiTitle || null, t.pejabatPenilaiInstansi || null,
        t.pejabatPenilaiNama || null, t.pejabatPenilaiNip || null, t.pejabatPenilaiGolongan || null, t.pejabatPenilaiStatus || 'definitif',
        t.signatureType || 'ttd_basah', t.ttdBasahType || 'blank', t.ttdBasahImageUrl || null, t.ttdBasahImageBase64 || null, t.ttdBasahHeight || 64,
        t.tteLogoType || 'default', t.tteLogoUrl || null, t.tteLogoBase64 || null, t.tteTextHeader || null, t.tteTextJabatan1 || null, t.tteTextJabatan2 || null,
        t.skPangkatFileLink || null, t.pakIntegrasiFileLink || null, t.ijazahFileLink || null, t.additionalFileLink || null, t.createdBy || 'admin'
      ];
      await pool.query(sql, values);
      res.json({ success: true, id: t.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE Teacher
  app.delete("/api/mysql/teachers/:id", async (req, res) => {
    try {
      const pool = getDbPool();
      await pool.query("DELETE FROM `teachers` WHERE `id` = ?", [req.params.id]);
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET Evaluations of Teacher
  app.get("/api/mysql/teachers/:id/evaluations", async (req, res) => {
    try {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>(
        "SELECT * FROM `evaluations` WHERE `teacherId` = ? ORDER BY `year` ASC",
        [req.params.id]
      );
      // Parse JSON overrideData if string
      const parsed = rows.map((r) => {
        if (typeof r.overrideData === "string") {
          try {
            r.overrideData = JSON.parse(r.overrideData);
          } catch (e) {}
        }
        return r;
      });
      res.json(parsed);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST / Upsert Evaluation
  app.post("/api/mysql/teachers/:id/evaluations", async (req, res) => {
    try {
      const pool = getDbPool();
      const teacherId = req.params.id;
      const ev = req.body;
      const sql = `
        INSERT INTO \`evaluations\` (
          id, teacherId, year, period, rating, level, coefficient, multiplier,
          creditEarned, akPendidikan, notes, startDate, endDate, isCustomRange,
          customMonths, skpFileLink, evidenceFileLink, overrideData, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          year = VALUES(year), period = VALUES(period), rating = VALUES(rating),
          level = VALUES(level), coefficient = VALUES(coefficient), multiplier = VALUES(multiplier),
          creditEarned = VALUES(creditEarned), akPendidikan = VALUES(akPendidikan), notes = VALUES(notes),
          startDate = VALUES(startDate), endDate = VALUES(endDate), isCustomRange = VALUES(isCustomRange),
          customMonths = VALUES(customMonths), skpFileLink = VALUES(skpFileLink), evidenceFileLink = VALUES(evidenceFileLink),
          overrideData = VALUES(overrideData)
      `;
      const overrideStr = ev.overrideData ? JSON.stringify(ev.overrideData) : null;
      const values = [
        ev.id, teacherId, ev.year, ev.period, ev.rating, ev.level,
        ev.coefficient || 0, ev.multiplier || 1, ev.creditEarned || 0, ev.akPendidikan || 0,
        ev.notes || null, ev.startDate || null, ev.endDate || null, ev.isCustomRange ? 1 : 0,
        ev.customMonths || 12, ev.skpFileLink || null, ev.evidenceFileLink || null,
        overrideStr, ev.createdBy || 'admin'
      ];
      await pool.query(sql, values);
      res.json({ success: true, id: ev.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE Evaluation
  app.delete("/api/mysql/evaluations/:id", async (req, res) => {
    try {
      const pool = getDbPool();
      await pool.query("DELETE FROM `evaluations` WHERE `id` = ?", [req.params.id]);
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET / POST Schools
  app.get("/api/mysql/schools", async (req, res) => {
    try {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>("SELECT * FROM `schools` ORDER BY `name` ASC");
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/mysql/schools", async (req, res) => {
    try {
      const pool = getDbPool();
      const s = req.body;
      const sql = `
        INSERT INTO \`schools\` (id, npsn, name, city, address, principalName, principalNip, principalStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          npsn = VALUES(npsn), name = VALUES(name), city = VALUES(city),
          address = VALUES(address), principalName = VALUES(principalName),
          principalNip = VALUES(principalNip), principalStatus = VALUES(principalStatus)
      `;
      await pool.query(sql, [
        s.id, s.npsn, s.name, s.city || null, s.address || null,
        s.principalName || null, s.principalNip || null, s.principalStatus || 'definitif'
      ]);
      res.json({ success: true, id: s.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET / POST Users
  app.get("/api/mysql/users", async (req, res) => {
    try {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>("SELECT id, username, password, role, school, displayName, created_at, updated_at FROM `app_users` ORDER BY `displayName` ASC");
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/mysql/users", async (req, res) => {
    try {
      const pool = getDbPool();
      const u = req.body;
      const sql = `
        INSERT INTO \`app_users\` (username, password, role, school, displayName)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          password = VALUES(password), role = VALUES(role),
          school = VALUES(school), displayName = VALUES(displayName)
      `;
      await pool.query(sql, [u.username, u.password, u.role, u.school, u.displayName]);
      res.json({ success: true, username: u.username });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/mysql/users/:username", async (req, res) => {
    try {
      const pool = getDbPool();
      await pool.query("DELETE FROM `app_users` WHERE `username` = ?", [req.params.username]);
      res.json({ success: true, username: req.params.username });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET / POST Kop Settings
  app.get("/api/mysql/settings/kop", async (req, res) => {
    try {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>("SELECT * FROM `kop_settings` WHERE `id` = 'default' LIMIT 1");
      if (rows && rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.json(null);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/mysql/settings/kop", async (req, res) => {
    try {
      const pool = getDbPool();
      const k = req.body;
      const sql = `
        INSERT INTO \`kop_settings\` (
          id, logoType, customLogoUrl, row1, row2, row3, row4, row5, row6,
          signatureType, ttdBasahType, ttdBasahImageUrl, ttdBasahImageBase64, ttdBasahHeight,
          tteLogoType, tteLogoUrl, tteLogoBase64, tteTextHeader, tteTextJabatan1, tteTextJabatan2
        ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          logoType = VALUES(logoType), customLogoUrl = VALUES(customLogoUrl),
          row1 = VALUES(row1), row2 = VALUES(row2), row3 = VALUES(row3),
          row4 = VALUES(row4), row5 = VALUES(row5), row6 = VALUES(row6),
          signatureType = VALUES(signatureType), ttdBasahType = VALUES(ttdBasahType),
          ttdBasahImageUrl = VALUES(ttdBasahImageUrl), ttdBasahImageBase64 = VALUES(ttdBasahImageBase64),
          ttdBasahHeight = VALUES(ttdBasahHeight), tteLogoType = VALUES(tteLogoType),
          tteLogoUrl = VALUES(tteLogoUrl), tteLogoBase64 = VALUES(tteLogoBase64),
          tteTextHeader = VALUES(tteTextHeader), tteTextJabatan1 = VALUES(tteTextJabatan1),
          tteTextJabatan2 = VALUES(tteTextJabatan2)
      `;
      await pool.query(sql, [
        k.logoType || 'svg-jabar', k.customLogoUrl || null,
        k.row1 || '', k.row2 || '', k.row3 || '', k.row4 || '', k.row5 || '', k.row6 || '',
        k.signatureType || 'ttd_basah', k.ttdBasahType || 'blank', k.ttdBasahImageUrl || null,
        k.ttdBasahImageBase64 || null, k.ttdBasahHeight || 64, k.tteLogoType || 'default',
        k.tteLogoUrl || null, k.tteLogoBase64 || null, k.tteTextHeader || null,
        k.tteTextJabatan1 || null, k.tteTextJabatan2 || null
      ]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve Vite in development, static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      }
    }));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving compiled production static assets with CORS enabled.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SIPAK-GURU Server running in ${process.env.NODE_ENV || "development"} mode on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server startup crash:", err);
  process.exit(1);
});

