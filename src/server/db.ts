import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pool: mysql.Pool | null = null;
let isPoolInitialized = false;

/**
 * Initializes and returns a MySQL connection pool using environment variables.
 * Defaults to XAMPP standard parameters on Mac/Localhost.
 */
export function getDbPool(): mysql.Pool {
  if (!pool) {
    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT) || 3306;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'sipak_guru_db';

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
    isPoolInitialized = true;
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
 * Tests MySQL connectivity without crashing the server if the database is currently unreachable.
 */
export async function checkDbConnection(): Promise<DbStatusResponse> {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const database = process.env.DB_NAME || 'sipak_guru_db';

  try {
    const p = getDbPool();
    // Test basic query
    const [rows] = await p.query<any[]>('SELECT 1 + 1 AS solution');
    
    // Check tables in database
    const [tableRows] = await p.query<any[]>(
      'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ?',
      [database]
    );
    const tables = Array.isArray(tableRows) ? tableRows.map((r: any) => r.TABLE_NAME || r.table_name) : [];

    return {
      connected: true,
      host,
      port,
      database,
      user,
      message: 'Koneksi ke MySQL database XAMPP berhasil terhubung dengan lancar.',
      tables,
      tablesCount: tables.length,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      connected: false,
      host,
      port,
      database,
      user,
      message: `Belum terhubung ke MySQL XAMPP: ${error.message || error}. Pastikan modul MySQL di XAMPP berstatus Running.`,
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
