/**
 * Client-Side MySQL / XAMPP API Bridge
 * Direct pure REST communication with Node Express backend and MySQL database.
 * Completely replaces Firebase Firestore.
 */

export interface DbStatusInfo {
  connected: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  message: string;
  tables?: string[];
  tablesCount?: number;
}

let cachedStatus: { status: DbStatusInfo; timestamp: number } | null = null;

export async function checkMysqlConnection(forceRefresh = false): Promise<DbStatusInfo> {
  const now = Date.now();
  if (!forceRefresh && cachedStatus && (now - cachedStatus.timestamp < 10000)) {
    return cachedStatus.status;
  }
  try {
    const res = await fetch('/api/db-status');
    if (res.ok) {
      const data: DbStatusInfo = await res.json();
      cachedStatus = { status: data, timestamp: now };
      return data;
    }
  } catch (e) {
    // Backend API unreachable
  }
  return {
    connected: false,
    host: 'localhost',
    port: 3306,
    database: 'sipak_guru_db',
    user: 'root',
    message: 'Server backend /api/db-status belum dapat dihubungi.',
    tables: [],
    tablesCount: 0
  };
}

// ============================================================================
// SCHOOLS
// ============================================================================
export async function fetchSchoolsFromMysql(): Promise<any[]> {
  try {
    const res = await fetch('/api/mysql/schools');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Gagal mengambil data sekolah dari API:', err);
  }
  return [];
}

export async function saveSchoolToMysql(school: {
  id?: string;
  npsn: string;
  name: string;
  address?: string;
  city?: string;
  principalName?: string;
  principalNip?: string;
  principalStatus?: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/mysql/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: school.id || school.npsn,
        npsn: school.npsn,
        name: school.name,
        address: school.address || '',
        city: school.city || '',
        principalName: school.principalName || '',
        principalNip: school.principalNip || '',
        principalStatus: school.principalStatus || 'definitif'
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Gagal menyimpan sekolah ke MySQL:', err);
    return false;
  }
}

export async function deleteSchoolFromMysql(schoolIdOrNpsn: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mysql/schools/${encodeURIComponent(schoolIdOrNpsn)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.warn('Gagal menghapus sekolah dari MySQL:', err);
    return false;
  }
}

// ============================================================================
// TEACHERS
// ============================================================================
export async function fetchTeachersFromMysql(): Promise<any[]> {
  try {
    const res = await fetch('/api/mysql/teachers');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Gagal mengambil data guru dari API:', err);
  }
  return [];
}

export async function saveTeacherToMysql(teacher: any): Promise<boolean> {
  try {
    const res = await fetch('/api/mysql/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teacher)
    });
    return res.ok;
  } catch (err) {
    console.warn('Gagal menyimpan guru ke MySQL:', err);
    return false;
  }
}

export async function deleteTeacherFromMysql(teacherId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mysql/teachers/${encodeURIComponent(teacherId)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.warn('Gagal menghapus guru dari MySQL:', err);
    return false;
  }
}

// ============================================================================
// EVALUATIONS
// ============================================================================
export async function fetchEvaluationsFromMysql(teacherId: string): Promise<any[]> {
  try {
    const res = await fetch(`/api/mysql/teachers/${encodeURIComponent(teacherId)}/evaluations`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Gagal mengambil evaluasi guru dari API:', err);
  }
  return [];
}

export async function saveEvaluationToMysql(teacherId: string, evaluation: any): Promise<boolean> {
  try {
    const res = await fetch(`/api/mysql/teachers/${encodeURIComponent(teacherId)}/evaluations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evaluation)
    });
    return res.ok;
  } catch (err) {
    console.warn('Gagal menyimpan evaluasi ke MySQL:', err);
    return false;
  }
}

export async function deleteEvaluationFromMysql(evalId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mysql/evaluations/${encodeURIComponent(evalId)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.warn('Gagal menghapus evaluasi dari MySQL:', err);
    return false;
  }
}

// ============================================================================
// APP USERS & AUTHENTICATION
// ============================================================================
export async function fetchUsersFromMysql(): Promise<any[]> {
  try {
    const res = await fetch('/api/mysql/users');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Gagal mengambil daftar pengguna dari API:', err);
  }
  return [];
}

export async function saveUserToMysql(user: any): Promise<boolean> {
  try {
    const res = await fetch('/api/mysql/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    return res.ok;
  } catch (err) {
    console.warn('Gagal menyimpan user ke MySQL:', err);
    return false;
  }
}

export async function deleteUserFromMysql(username: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mysql/users/${encodeURIComponent(username)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.warn('Gagal menghapus user dari MySQL:', err);
    return false;
  }
}

export async function loginWithMysql(username: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error || 'Login gagal' };
  } catch (err: any) {
    return { success: false, error: 'Tidak dapat terhubung ke server backend' };
  }
}

// ============================================================================
// KOP SETTINGS
// ============================================================================
export async function fetchKopFromMysql(): Promise<any | null> {
  try {
    const res = await fetch('/api/mysql/settings/kop');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Gagal mengambil KOP dari API:', err);
  }
  return null;
}

export async function saveKopToMysql(kopSettings: any): Promise<boolean> {
  try {
    const res = await fetch('/api/mysql/settings/kop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kopSettings)
    });
    return res.ok;
  } catch (err) {
    console.warn('Gagal menyimpan KOP ke MySQL:', err);
    return false;
  }
}

// ============================================================================
// LOGS
// ============================================================================
export async function fetchLogsFromMysql(): Promise<any[]> {
  try {
    const res = await fetch('/api/mysql/logs');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Gagal mengambil log dari API:', err);
  }
  return [];
}

export async function saveLogToMysql(log: any): Promise<boolean> {
  try {
    const res = await fetch('/api/mysql/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function clearLogsInMysql(): Promise<boolean> {
  try {
    const res = await fetch('/api/mysql/logs', { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    return false;
  }
}

// ============================================================================
// BATCH SYNC & EXPORT
// ============================================================================
export async function syncBatchToMysql(data: {
  schools?: any[];
  teachers?: any[];
  users?: any[];
  kopSettings?: any;
}): Promise<{ success: boolean; synced?: any }> {
  try {
    const res = await fetch('/api/mysql/sync-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Gagal batch sync ke MySQL:', err);
  }
  return { success: false };
}
