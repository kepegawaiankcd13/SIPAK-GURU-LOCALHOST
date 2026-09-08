/**
 * Client-Side MySQL / XAMPP Synchronization Bridge
 * Enables offline and local MySQL database operations in tandem with Firestore.
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
    // Backend API unreachable or running standalone client
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

/**
 * Saves or updates a school in MySQL XAMPP
 */
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

/**
 * Deletes a school from MySQL XAMPP
 */
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

/**
 * Fetches schools list directly from MySQL XAMPP
 */
export async function fetchSchoolsFromMysql(): Promise<any[]> {
  try {
    const res = await fetch('/api/mysql/schools');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Gagal mengambil data sekolah dari MySQL:', err);
  }
  return [];
}

/**
 * Saves or updates a teacher in MySQL XAMPP
 */
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

/**
 * Deletes a teacher from MySQL XAMPP
 */
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

/**
 * Fetches teachers list from MySQL XAMPP
 */
export async function fetchTeachersFromMysql(): Promise<any[]> {
  try {
    const res = await fetch('/api/mysql/teachers');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Gagal mengambil data guru dari MySQL:', err);
  }
  return [];
}

/**
 * Saves an evaluation in MySQL XAMPP
 */
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

/**
 * Deletes an evaluation from MySQL XAMPP
 */
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

/**
 * Saves user in MySQL XAMPP
 */
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

/**
 * Deletes user from MySQL XAMPP
 */
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

/**
 * Saves KOP settings in MySQL XAMPP
 */
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

/**
 * Batch synchronizes data into MySQL XAMPP
 */
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
