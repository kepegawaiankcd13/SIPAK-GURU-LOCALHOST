import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pool: mysql.Pool | null = null;
let dbInitialized = false;

export const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sipak_guru_db',
};

/**
 * Initializes and returns a MySQL connection pool.
 */
export function getDbPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      database: DB_CONFIG.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 2000
    });
  }
  return pool;
}

export interface DbStatusResponse {
  connected: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  message: string;
  tables?: string[];
  tablesCount?: number;
  timestamp: string;
}

/**
 * Ensures MySQL database and all required tables exist.
 * Automatically runs DDL on server startup if MySQL is reachable.
 */
export async function autoInitializeMysql(): Promise<boolean> {
  if (dbInitialized) return true;
  try {
    // 1. Connect to MySQL server without database first to ensure database exists
    const rootConnection = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      connectTimeout: 2000
    });

    await rootConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await rootConnection.end();

    // 2. Connect to the specific database pool and create tables
    const p = getDbPool();

    // Table: app_users
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`app_users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(100) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`role\` ENUM('super_admin', 'school_admin') NOT NULL DEFAULT 'school_admin',
        \`school\` VARCHAR(255) NOT NULL DEFAULT 'ALL',
        \`displayName\` VARCHAR(255) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Table: schools
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`schools\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`npsn\` VARCHAR(30) NOT NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`address\` TEXT NULL,
        \`city\` VARCHAR(100) NULL,
        \`principalName\` VARCHAR(255) NULL,
        \`principalNip\` VARCHAR(50) NULL,
        \`principalStatus\` ENUM('definitif', 'plt', 'plh') DEFAULT 'definitif',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Table: teachers
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`teachers\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`nip\` VARCHAR(50) NOT NULL,
        \`school\` VARCHAR(255) NOT NULL,
        \`currentGolongan\` VARCHAR(20) NOT NULL DEFAULT 'III/c',
        \`targetGolongan\` VARCHAR(20) NOT NULL DEFAULT 'III/d',
        \`baseAK\` DECIMAL(10, 3) DEFAULT 0.000,
        \`akIntegrasi2022\` DECIMAL(10, 3) DEFAULT 0.000,
        \`akPendidikan\` DECIMAL(10, 3) DEFAULT 0.000,
        \`ratingSKP\` VARCHAR(50) DEFAULT 'Baik',
        \`workDurationYears\` INT DEFAULT 0,
        \`karpegNumber\` VARCHAR(100) NULL,
        \`birthPlaceDate\` VARCHAR(255) NULL,
        \`gender\` ENUM('Laki-Laki', 'Perempuan') DEFAULT 'Laki-Laki',
        \`tmtCurrentPangkat\` VARCHAR(50) NULL,
        \`tmtCurrentJabatan\` VARCHAR(50) NULL,
        \`unitKerja\` VARCHAR(255) NULL,
        \`instansiBiro\` VARCHAR(255) NULL,
        \`nomorSuratKonversi\` VARCHAR(255) NULL,
        \`nomorSuratAkumulasi\` VARCHAR(255) NULL,
        \`nomorSuratPenetapan\` VARCHAR(255) NULL,
        \`tempatDitetapkan\` VARCHAR(100) NULL,
        \`tanggalPenetapan\` VARCHAR(100) NULL,
        \`pejabatPenilaiTitle\` VARCHAR(255) NULL,
        \`pejabatPenilaiInstansi\` VARCHAR(255) NULL,
        \`pejabatPenilaiNama\` VARCHAR(255) NULL,
        \`pejabatPenilaiNip\` VARCHAR(50) NULL,
        \`pejabatPenilaiGolongan\` VARCHAR(100) NULL,
        \`pejabatPenilaiStatus\` ENUM('definitif', 'plt', 'plh') DEFAULT 'definitif',
        \`signatureType\` VARCHAR(50) DEFAULT 'ttd_basah',
        \`ttdBasahType\` VARCHAR(50) DEFAULT 'blank',
        \`ttdBasahImageUrl\` TEXT NULL,
        \`ttdBasahImageBase64\` LONGTEXT NULL,
        \`ttdBasahHeight\` INT DEFAULT 64,
        \`tteLogoType\` VARCHAR(50) DEFAULT 'default',
        \`tteLogoUrl\` TEXT NULL,
        \`tteLogoBase64\` LONGTEXT NULL,
        \`tteTextHeader\` VARCHAR(255) DEFAULT 'Ditandatangani secara elektronik oleh :',
        \`tteTextJabatan1\` VARCHAR(255) NULL,
        \`tteTextJabatan2\` VARCHAR(255) NULL,
        \`skPangkatFileLink\` TEXT NULL,
        \`pakIntegrasiFileLink\` TEXT NULL,
        \`ijazahFileLink\` TEXT NULL,
        \`additionalFileLink\` TEXT NULL,
        \`createdBy\` VARCHAR(100) DEFAULT 'admin',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Table: evaluations
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`evaluations\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`teacherId\` VARCHAR(64) NOT NULL,
        \`year\` INT NOT NULL,
        \`period\` VARCHAR(100) DEFAULT 'Tahunan',
        \`rating\` VARCHAR(50) NOT NULL DEFAULT 'Baik',
        \`level\` VARCHAR(50) NOT NULL DEFAULT 'Ahli Muda',
        \`coefficient\` DECIMAL(10, 3) DEFAULT 25.000,
        \`multiplier\` DECIMAL(5, 2) DEFAULT 1.00,
        \`creditEarned\` DECIMAL(10, 3) DEFAULT 25.000,
        \`akPendidikan\` DECIMAL(10, 3) DEFAULT 0.000,
        \`notes\` TEXT NULL,
        \`startDate\` VARCHAR(50) NULL,
        \`endDate\` VARCHAR(50) NULL,
        \`isCustomRange\` TINYINT(1) DEFAULT 0,
        \`customMonths\` INT DEFAULT 12,
        \`skpFileLink\` TEXT NULL,
        \`evidenceFileLink\` TEXT NULL,
        \`overrideData\` LONGTEXT NULL,
        \`createdBy\` VARCHAR(100) DEFAULT 'admin',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Table: kop_settings
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`kop_settings\` (
        \`id\` VARCHAR(32) PRIMARY KEY DEFAULT 'default',
        \`logoType\` VARCHAR(50) DEFAULT 'svg-jabar',
        \`customLogoUrl\` TEXT NULL,
        \`row1\` VARCHAR(255) DEFAULT 'PEMERINTAH DAERAH PROVINSI JAWA BARAT',
        \`row2\` VARCHAR(255) DEFAULT 'DINAS PENDIDIKAN',
        \`row3\` VARCHAR(255) DEFAULT 'CABANG DINAS PENDIDIKAN WILAYAH XIII',
        \`row4\` VARCHAR(255) DEFAULT 'Jalan Sukasenang No. 34 Telp./Fax (0265) 773123 Ciamis',
        \`row5\` VARCHAR(255) DEFAULT 'e-mail: cabdinwil13@gmail.com',
        \`row6\` VARCHAR(255) DEFAULT 'CIAMIS - 46211',
        \`signatureType\` VARCHAR(50) DEFAULT 'ttd_basah',
        \`ttdBasahType\` VARCHAR(50) DEFAULT 'blank',
        \`ttdBasahImageUrl\` TEXT NULL,
        \`ttdBasahImageBase64\` LONGTEXT NULL,
        \`ttdBasahHeight\` INT DEFAULT 64,
        \`tteLogoType\` VARCHAR(50) DEFAULT 'default',
        \`tteLogoUrl\` TEXT NULL,
        \`tteLogoBase64\` LONGTEXT NULL,
        \`tteTextHeader\` VARCHAR(255) DEFAULT 'Ditandatangani secara elektronik oleh :',
        \`tteTextJabatan1\` VARCHAR(255) DEFAULT 'KEPALA CABANG DINAS PENDIDIKAN WILAYAH XIII',
        \`tteTextJabatan2\` VARCHAR(255) DEFAULT 'DINAS PENDIDIKAN PROVINSI JAWA BARAT',
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Table: system_logs
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`system_logs\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`timestamp\` VARCHAR(50) NOT NULL,
        \`error\` TEXT NOT NULL,
        \`operationType\` VARCHAR(50) DEFAULT 'general',
        \`path\` TEXT NULL,
        \`userId\` VARCHAR(100) NULL,
        \`email\` VARCHAR(100) NULL,
        \`browser\` TEXT NULL,
        \`severity\` ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
        \`resolved\` TINYINT(1) DEFAULT 0,
        \`resolutionNotes\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default admin accounts if empty
    const [userCount] = await p.query<any[]>('SELECT COUNT(*) as count FROM `app_users`');
    if (userCount[0].count === 0) {
      await p.query(`
        INSERT INTO \`app_users\` (username, password, role, school, displayName) VALUES
        ('admin', 'adminpaskonversi', 'super_admin', 'ALL', 'Super Admin Dinas Pendidikan KCD XIII'),
        ('admin123', 'admin123', 'super_admin', 'ALL', 'Admin Utama'),
        ('sman2ciamis', 'sman2ciamis123', 'school_admin', 'SMAN 2 CIAMIS', 'Operator SMAN 2 Ciamis'),
        ('sman1ciamis', 'sman1ciamis123', 'school_admin', 'SMAN 1 CIAMIS', 'Operator SMAN 1 Ciamis')
      `);
      console.log('Seeded initial app_users in MySQL.');
    }

    // Seed default schools if empty
    const [schoolCount] = await p.query<any[]>('SELECT COUNT(*) as count FROM `schools`');
    if (schoolCount[0].count === 0) {
      await p.query(`
        INSERT INTO \`schools\` (id, npsn, name, city, address, principalName, principalNip, principalStatus) VALUES
        ('20211516', '20211516', 'SMAN 1 CIAMIS', 'Kabupaten Ciamis', 'Jl. Gunung Galunggung No. 37 Ciamis', 'Drs. H. Suarman Marks, M.Pd.', '196504121990031008', 'definitif'),
        ('20211517', '20211517', 'SMAN 2 CIAMIS', 'Kabupaten Ciamis', 'Jl. K.H. Ahmad Dahlan No. 2 Ciamis', 'Drs. H. Wawan Suwandi, M.Pd.', '196705151992031005', 'definitif'),
        ('20211518', '20211518', 'SMAN 1 BANJAR', 'Kota Banjar', 'Jl. K.H. Mustofa No. 1 Banjar', 'H. Agus Surtiawan, S.Pd., M.Pd.', '196811201994031004', 'definitif'),
        ('20211519', '20211519', 'SMAN 1 PANGANDARAN', 'Kabupaten Pangandaran', 'Jl. Babakan Pangandaran', 'Drs. H. Sukirman, M.Pd.', '196608101991031010', 'definitif')
      `);
      console.log('Seeded initial schools in MySQL.');
    }

    // Seed default KOP if empty
    const [kopCount] = await p.query<any[]>('SELECT COUNT(*) as count FROM `kop_settings`');
    if (kopCount[0].count === 0) {
      await p.query(`
        INSERT INTO \`kop_settings\` (id, logoType, row1, row2, row3, row4, row5, row6, tteTextJabatan1, tteTextJabatan2)
        VALUES ('default', 'svg-jabar', 'PEMERINTAH DAERAH PROVINSI JAWA BARAT', 'DINAS PENDIDIKAN', 'CABANG DINAS PENDIDIKAN WILAYAH XIII', 'Jalan Sukasenang No. 34 Telp./Fax (0265) 773123 Ciamis', 'e-mail: cabdinwil13@gmail.com', 'CIAMIS - 46211', 'KEPALA CABANG DINAS PENDIDIKAN WILAYAH XIII', 'DINAS PENDIDIKAN PROVINSI JAWA BARAT')
      `);
    }

    dbInitialized = true;
    console.log('MySQL sipak_guru_db auto-initialized successfully.');
    return true;
  } catch (err: any) {
    console.warn('Auto MySQL initialization skipped (MySQL might not be running yet):', err.message);
    return false;
  }
}

/**
 * Tests MySQL connectivity without crashing the server.
 */
export async function checkDbConnection(): Promise<DbStatusResponse> {
  try {
    const p = getDbPool();
    const [rows] = await p.query<any[]>('SELECT 1 + 1 AS solution');

    const [tableRows] = await p.query<any[]>(
      'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ?',
      [DB_CONFIG.database]
    );
    const tables = Array.isArray(tableRows) ? tableRows.map((r: any) => r.TABLE_NAME || r.table_name) : [];

    // Also trigger table auto-init if empty
    if (tables.length === 0) {
      await autoInitializeMysql();
    }

    return {
      connected: true,
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      database: DB_CONFIG.database,
      user: DB_CONFIG.user,
      message: 'Koneksi ke MySQL database XAMPP berhasil terhubung dengan lancar.',
      tables,
      tablesCount: tables.length,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      connected: false,
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      database: DB_CONFIG.database,
      user: DB_CONFIG.user,
      message: `Belum terhubung ke MySQL XAMPP: ${error.message || error}. Pastikan modul MySQL di aplikasi XAMPP berstatus Running.`,
      tables: [],
      tablesCount: 0,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Reads and returns the contents of database.sql for direct download / backup.
 */
export function getDatabaseSqlContent(): string {
  try {
    const filePath = path.join(process.cwd(), 'database.sql');
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (e) {
    console.error('Error reading database.sql:', e);
  }
  return '-- database.sql not found';
}
