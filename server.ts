import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { getDbPool, checkDbConnection, getDatabaseSqlContent, autoInitializeMysql } from "./src/server/db";
import { readLocalDb, writeLocalDb, type LocalDbData } from "./src/server/fileDb";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // JSON Body Parser for API requests
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Auto-init MySQL if running
  autoInitializeMysql().catch((err) => {
    console.warn("MySQL auto-init notice:", err.message);
  });

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
      res.json({
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

  // =========================================================================
  // USER AUTHENTICATION / LOGIN API
  // =========================================================================
  app.post(["/api/login", "/api/mysql/login"], async (req, res) => {
    const { username, password } = req.body;
    const uName = (username || "").trim().toLowerCase();
    const pWord = (password || "").trim();

    if (!uName || !pWord) {
      return res.status(400).json({ error: "Username dan password harus diisi." });
    }

    try {
      // 1. Try MySQL app_users
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>(
        "SELECT id, username, password, role, school, displayName FROM `app_users` WHERE LOWER(`username`) = ? LIMIT 1",
        [uName]
      );
      if (rows && rows.length > 0) {
        const u = rows[0];
        if (u.password === pWord) {
          return res.json({
            success: true,
            user: {
              username: u.username,
              displayName: u.displayName,
              role: u.role,
              school: u.school
            }
          });
        } else {
          return res.status(401).json({ error: "Kombinasi password yang dimasukkan salah!" });
        }
      }
    } catch (err) {
      console.warn("MySQL login query fallback to local store:", err);
    }

    // 2. Fallback to local DB store
    const localDb = readLocalDb();
    const found = localDb.users.find(
      (u: any) => u.username.toLowerCase() === uName
    );
    if (found) {
      if (found.password === pWord) {
        return res.json({
          success: true,
          user: {
            username: found.username,
            displayName: found.displayName,
            role: found.role,
            school: found.school
          }
        });
      } else {
        return res.status(401).json({ error: "Kombinasi password yang dimasukkan salah!" });
      }
    }

    return res.status(404).json({ error: "Akun pengguna tidak ditemukan dalam database." });
  });

  // =========================================================================
  // TEACHERS API (GET, POST, DELETE)
  // =========================================================================
  app.get(["/api/teachers", "/api/mysql/teachers"], async (req, res) => {
    try {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>("SELECT * FROM `teachers` ORDER BY `name` ASC");
      res.json(rows);
    } catch (err: any) {
      console.warn("Teachers GET fallback to local store:", err.message);
      const local = readLocalDb();
      res.json(local.teachers || []);
    }
  });

  app.post(["/api/teachers", "/api/mysql/teachers"], async (req, res) => {
    const t = req.body;
    if (!t.id || !t.name || !t.nip) {
      return res.status(400).json({ error: "ID, Nama, dan NIP guru wajib diisi." });
    }

    // Always update local store copy
    const local = readLocalDb();
    const existingIdx = local.teachers.findIndex((item: any) => item.id === t.id);
    if (existingIdx >= 0) {
      local.teachers[existingIdx] = { ...local.teachers[existingIdx], ...t };
    } else {
      local.teachers.push(t);
    }
    writeLocalDb(local);

    try {
      const pool = getDbPool();
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
        t.id, t.name, t.nip, t.school || '', t.currentGolongan || 'III/c', t.targetGolongan || 'III/d',
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
    } catch (err: any) {
      console.warn("MySQL write warning (saved to local backup):", err.message);
    }
    res.json({ success: true, id: t.id });
  });

  app.delete(["/api/teachers/:id", "/api/mysql/teachers/:id"], async (req, res) => {
    const id = req.params.id;
    // Local store deletion
    const local = readLocalDb();
    local.teachers = local.teachers.filter((item: any) => item.id !== id);
    local.evaluations = local.evaluations.filter((ev: any) => ev.teacherId !== id);
    writeLocalDb(local);

    try {
      const pool = getDbPool();
      await pool.query("DELETE FROM `evaluations` WHERE `teacherId` = ?", [id]);
      await pool.query("DELETE FROM `teachers` WHERE `id` = ?", [id]);
    } catch (err: any) {
      console.warn("MySQL delete warning:", err.message);
    }
    res.json({ success: true, id });
  });

  // =========================================================================
  // EVALUATIONS API (GET, POST, DELETE)
  // =========================================================================
  app.get(["/api/teachers/:id/evaluations", "/api/mysql/teachers/:id/evaluations"], async (req, res) => {
    const teacherId = req.params.id;
    try {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>(
        "SELECT * FROM `evaluations` WHERE `teacherId` = ? ORDER BY `year` ASC",
        [teacherId]
      );
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
      console.warn("Evaluations GET fallback to local store:", err.message);
      const local = readLocalDb();
      const evs = local.evaluations.filter((ev: any) => ev.teacherId === teacherId);
      res.json(evs);
    }
  });

  app.post(["/api/teachers/:id/evaluations", "/api/mysql/teachers/:id/evaluations"], async (req, res) => {
    const teacherId = req.params.id;
    const ev = req.body;
    if (!ev.id) {
      ev.id = `eval_${ev.year || 2024}_${Date.now()}`;
    }

    // Local store update
    const local = readLocalDb();
    const idx = local.evaluations.findIndex((item: any) => item.id === ev.id);
    if (idx >= 0) {
      local.evaluations[idx] = { ...local.evaluations[idx], ...ev, teacherId };
    } else {
      local.evaluations.push({ ...ev, teacherId });
    }
    writeLocalDb(local);

    try {
      const pool = getDbPool();
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
      const overrideStr = ev.overrideData ? (typeof ev.overrideData === 'string' ? ev.overrideData : JSON.stringify(ev.overrideData)) : null;
      const values = [
        ev.id, teacherId, ev.year, ev.period || 'Tahunan', ev.rating || 'Baik', ev.level || 'Ahli Muda',
        ev.coefficient || 25, ev.multiplier || 1, ev.creditEarned || 25, ev.akPendidikan || 0,
        ev.notes || null, ev.startDate || null, ev.endDate || null, ev.isCustomRange ? 1 : 0,
        ev.customMonths || 12, ev.skpFileLink || null, ev.evidenceFileLink || null,
        overrideStr, ev.createdBy || 'admin'
      ];
      await pool.query(sql, values);
    } catch (err: any) {
      console.warn("MySQL eval write warning:", err.message);
    }
    res.json({ success: true, id: ev.id });
  });

  app.delete(["/api/evaluations/:id", "/api/mysql/evaluations/:id"], async (req, res) => {
    const id = req.params.id;
    const local = readLocalDb();
    local.evaluations = local.evaluations.filter((ev: any) => ev.id !== id);
    writeLocalDb(local);

    try {
      const pool = getDbPool();
      await pool.query("DELETE FROM `evaluations` WHERE `id` = ?", [id]);
    } catch (err: any) {
      console.warn("MySQL eval delete warning:", err.message);
    }
    res.json({ success: true, id });
  });

  // =========================================================================
  // SCHOOLS API (GET, POST, DELETE)
  // =========================================================================
  app.get(["/api/schools", "/api/mysql/schools"], async (req, res) => {
    try {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>("SELECT * FROM `schools` ORDER BY `name` ASC");
      res.json(rows);
    } catch (err: any) {
      console.warn("Schools GET fallback to local store:", err.message);
      const local = readLocalDb();
      res.json(local.schools || []);
    }
  });

  app.post(["/api/schools", "/api/mysql/schools"], async (req, res) => {
    const s = req.body;
    const schoolId = s.id || s.npsn;
    if (!schoolId || !s.name || !s.npsn) {
      return res.status(400).json({ error: "NPSN dan Nama Sekolah wajib diisi." });
    }

    const local = readLocalDb();
    const idx = local.schools.findIndex((item: any) => item.id === schoolId || item.npsn === s.npsn);
    if (idx >= 0) {
      local.schools[idx] = { ...local.schools[idx], ...s, id: schoolId };
    } else {
      local.schools.push({ ...s, id: schoolId });
    }
    writeLocalDb(local);

    try {
      const pool = getDbPool();
      const sql = `
        INSERT INTO \`schools\` (id, npsn, name, city, address, principalName, principalNip, principalStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          npsn = VALUES(npsn), name = VALUES(name), city = VALUES(city),
          address = VALUES(address), principalName = VALUES(principalName),
          principalNip = VALUES(principalNip), principalStatus = VALUES(principalStatus)
      `;
      await pool.query(sql, [
        schoolId, s.npsn, s.name, s.city || null, s.address || null,
        s.principalName || null, s.principalNip || null, s.principalStatus || 'definitif'
      ]);
    } catch (err: any) {
      console.warn("MySQL schools write warning:", err.message);
    }
    res.json({ success: true, id: schoolId });
  });

  app.delete(["/api/schools/:id", "/api/mysql/schools/:id"], async (req, res) => {
    const id = req.params.id;
    const local = readLocalDb();
    local.schools = local.schools.filter((s: any) => s.id !== id && s.npsn !== id);
    writeLocalDb(local);

    try {
      const pool = getDbPool();
      await pool.query("DELETE FROM `schools` WHERE `id` = ? OR `npsn` = ?", [id, id]);
    } catch (err: any) {
      console.warn("MySQL schools delete warning:", err.message);
    }
    res.json({ success: true, id });
  });

  // =========================================================================
  // APP USERS API (GET, POST, DELETE)
  // =========================================================================
  app.get(["/api/users", "/api/mysql/users"], async (req, res) => {
    try {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>("SELECT id, username, password, role, school, displayName, created_at, updated_at FROM `app_users` ORDER BY `displayName` ASC");
      res.json(rows);
    } catch (err: any) {
      console.warn("Users GET fallback to local store:", err.message);
      const local = readLocalDb();
      res.json(local.users || []);
    }
  });

  app.post(["/api/users", "/api/mysql/users"], async (req, res) => {
    const u = req.body;
    if (!u.username || !u.password) {
      return res.status(400).json({ error: "Username dan password wajib diisi." });
    }

    const local = readLocalDb();
    const idx = local.users.findIndex((item: any) => item.username.toLowerCase() === u.username.toLowerCase());
    if (idx >= 0) {
      local.users[idx] = { ...local.users[idx], ...u };
    } else {
      local.users.push(u);
    }
    writeLocalDb(local);

    try {
      const pool = getDbPool();
      const sql = `
        INSERT INTO \`app_users\` (username, password, role, school, displayName)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          password = VALUES(password), role = VALUES(role),
          school = VALUES(school), displayName = VALUES(displayName)
      `;
      await pool.query(sql, [u.username, u.password, u.role || 'school_admin', u.school || 'ALL', u.displayName || u.username]);
    } catch (err: any) {
      console.warn("MySQL users write warning:", err.message);
    }
    res.json({ success: true, username: u.username });
  });

  app.delete(["/api/users/:username", "/api/mysql/users/:username"], async (req, res) => {
    const username = req.params.username;
    const local = readLocalDb();
    local.users = local.users.filter((u: any) => u.username !== username);
    writeLocalDb(local);

    try {
      const pool = getDbPool();
      await pool.query("DELETE FROM `app_users` WHERE `username` = ?", [username]);
    } catch (err: any) {
      console.warn("MySQL users delete warning:", err.message);
    }
    res.json({ success: true, username });
  });

  // =========================================================================
  // KOP SETTINGS API (GET, POST)
  // =========================================================================
  app.get(["/api/settings/kop", "/api/mysql/settings/kop"], async (req, res) => {
    try {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>("SELECT * FROM `kop_settings` WHERE `id` = 'default' LIMIT 1");
      if (rows && rows.length > 0) {
        return res.json(rows[0]);
      }
    } catch (err: any) {
      console.warn("Kop settings GET fallback to local store:", err.message);
    }
    const local = readLocalDb();
    res.json(local.kopSettings || null);
  });

  app.post(["/api/settings/kop", "/api/mysql/settings/kop"], async (req, res) => {
    const k = req.body;
    const local = readLocalDb();
    local.kopSettings = { ...local.kopSettings, ...k };
    writeLocalDb(local);

    try {
      const pool = getDbPool();
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
    } catch (err: any) {
      console.warn("MySQL kop write warning:", err.message);
    }
    res.json({ success: true });
  });

  // =========================================================================
  // SYSTEM LOGS API (GET, POST, DELETE)
  // =========================================================================
  app.get(["/api/logs", "/api/mysql/logs"], async (req, res) => {
    try {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>("SELECT * FROM `system_logs` ORDER BY `timestamp` DESC LIMIT 200");
      res.json(rows);
    } catch (err: any) {
      const local = readLocalDb();
      res.json(local.logs || []);
    }
  });

  app.post(["/api/logs", "/api/mysql/logs"], async (req, res) => {
    const l = req.body;
    const logItem = {
      id: l.id || Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      timestamp: l.timestamp || new Date().toISOString(),
      error: l.error || 'Unknown event',
      operationType: l.operationType || 'general',
      path: l.path || null,
      userId: l.userId || null,
      email: l.email || null,
      browser: l.browser || null,
      severity: l.severity || 'info',
      resolved: l.resolved ? 1 : 0,
      resolutionNotes: l.resolutionNotes || null
    };

    const local = readLocalDb();
    local.logs.unshift(logItem);
    if (local.logs.length > 200) local.logs = local.logs.slice(0, 200);
    writeLocalDb(local);

    try {
      const pool = getDbPool();
      await pool.query(`
        INSERT INTO \`system_logs\` (id, timestamp, error, operationType, path, userId, email, browser, severity, resolved, resolutionNotes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        logItem.id, logItem.timestamp, logItem.error, logItem.operationType,
        logItem.path, logItem.userId, logItem.email, logItem.browser,
        logItem.severity, logItem.resolved, logItem.resolutionNotes
      ]);
    } catch (err: any) {}
    res.json({ success: true, id: logItem.id });
  });

  app.delete(["/api/logs", "/api/mysql/logs"], async (req, res) => {
    const local = readLocalDb();
    local.logs = [];
    writeLocalDb(local);
    try {
      const pool = getDbPool();
      await pool.query("TRUNCATE TABLE `system_logs`");
    } catch (err: any) {}
    res.json({ success: true });
  });

  // =========================================================================
  // BATCH SYNC & EXPORT/IMPORT API
  // =========================================================================
  app.get(["/api/backup/export", "/api/mysql/export"], async (req, res) => {
    try {
      const local = readLocalDb();
      let schools = local.schools;
      let teachers = local.teachers;
      let evaluations = local.evaluations;
      let users = local.users;
      let kopSettings = local.kopSettings;

      try {
        const pool = getDbPool();
        const [scRows] = await pool.query<any[]>("SELECT * FROM `schools`");
        const [tcRows] = await pool.query<any[]>("SELECT * FROM `teachers`");
        const [evRows] = await pool.query<any[]>("SELECT * FROM `evaluations`");
        const [usRows] = await pool.query<any[]>("SELECT id, username, password, role, school, displayName FROM `app_users`");
        const [kpRows] = await pool.query<any[]>("SELECT * FROM `kop_settings` WHERE `id` = 'default'");
        if (scRows.length > 0) schools = scRows;
        if (tcRows.length > 0) teachers = tcRows;
        if (evRows.length > 0) evaluations = evRows;
        if (usRows.length > 0) users = usRows;
        if (kpRows.length > 0) kopSettings = kpRows[0];
      } catch (err) {}

      res.json({
        version: "sipak_v2_mysql",
        timestamp: new Date().toISOString(),
        exportedBy: "admin",
        schools,
        teachers: teachers.map((t: any) => ({
          ...t,
          evaluations: evaluations.filter((e: any) => e.teacherId === t.id)
        })),
        app_users: users,
        kopSettings
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(["/api/mysql/sync-batch", "/api/backup/import"], async (req, res) => {
    try {
      const { schools, teachers, users, app_users, kopSettings } = req.body;
      const userList = users || app_users || [];
      const local = readLocalDb();

      if (Array.isArray(schools)) local.schools = schools;
      if (Array.isArray(teachers)) local.teachers = teachers;
      if (Array.isArray(userList)) local.users = userList;
      if (kopSettings) local.kopSettings = kopSettings;
      writeLocalDb(local);

      let schoolsCount = 0;
      let teachersCount = 0;
      let usersCount = 0;

      try {
        const pool = getDbPool();
        if (Array.isArray(schools)) {
          for (const s of schools) {
            const sId = s.id || s.npsn;
            if (sId && s.npsn && s.name) {
              await pool.query(`
                INSERT INTO \`schools\` (id, npsn, name, city, address, principalName, principalNip, principalStatus)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  npsn = VALUES(npsn), name = VALUES(name), city = VALUES(city),
                  address = VALUES(address), principalName = VALUES(principalName),
                  principalNip = VALUES(principalNip), principalStatus = VALUES(principalStatus)
              `, [
                sId, s.npsn, s.name, s.city || null, s.address || null,
                s.principalName || null, s.principalNip || null, s.principalStatus || 'definitif'
              ]);
              schoolsCount++;
            }
          }
        }

        if (Array.isArray(teachers)) {
          for (const t of teachers) {
            if (t.id && t.name && t.nip) {
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
                t.id, t.name, t.nip, t.school || '', t.currentGolongan || 'III/c', t.targetGolongan || 'III/d',
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
              teachersCount++;
            }
          }
        }

        if (Array.isArray(userList)) {
          for (const u of userList) {
            if (u.username && u.password) {
              await pool.query(`
                INSERT INTO \`app_users\` (username, password, role, school, displayName)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  password = VALUES(password), role = VALUES(role),
                  school = VALUES(school), displayName = VALUES(displayName)
              `, [u.username, u.password, u.role || 'school_admin', u.school || 'ALL', u.displayName || u.username]);
              usersCount++;
            }
          }
        }
      } catch (err: any) {
        console.warn("MySQL sync batch warning:", err.message);
      }

      res.json({ success: true, synced: { schoolsCount, teachersCount, usersCount } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve Vite in development, static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            "**/data/**",
            "**/dist/**",
            "**/.git/**",
            "**/*.sql",
            "**/*.log"
          ]
        }
      },
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
    console.log(`SIPAK-GURU Server running on http://0.0.0.0:${PORT} (MySQL XAMPP Database mode)`);
  });
}

startServer().catch((err) => {
  console.error("Critical server startup crash:", err);
  process.exit(1);
});
