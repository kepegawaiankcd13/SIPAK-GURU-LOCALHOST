/**
 * Audit and Logging Service
 * Pure MySQL / Local server backend logging.
 * Firebase Firestore completely removed.
 */

import { fetchLogsFromMysql, saveLogToMysql, clearLogsInMysql } from './mysqlSync';

export interface SystemLog {
  id: string;
  timestamp: string;
  error: string;
  operationType?: string;
  path?: string | null;
  userId?: string | null;
  email?: string | null;
  browser: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  resolved?: boolean;
  resolutionNotes?: string;
  synced?: boolean;
}

const LOCAL_LOGS_KEY = 'sipak_system_logs_v1';

function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  let tem;
  let M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
  if (/trident/i.test(M[1])) {
    tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
    return 'IE ' + (tem[1] || '');
  }
  if (M[1] === 'Chrome') {
    tem = ua.match(/\b(OPR|Edge)\/(\d+)/);
    if (tem != null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
  }
  M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
  if ((tem = ua.match(/version\/(\d+)/i)) != null) M.splice(1, 1, tem[1]);
  return M.join(' ');
}

export function getLocalLogs(): SystemLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalLogs(logs: SystemLog[]): void {
  try {
    const sliced = logs.slice(-200);
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(sliced));
  } catch (e) {}
}

export async function logEvent(
  error: string,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'error',
  operationType?: string,
  path?: string | null
): Promise<SystemLog> {
  let sessionUser: any = null;
  try {
    const rawUser = localStorage.getItem('sipak_current_user');
    if (rawUser) sessionUser = JSON.parse(rawUser);
  } catch (e) {}

  const logItem: SystemLog = {
    id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    timestamp: new Date().toISOString(),
    error,
    operationType,
    path: path || null,
    userId: sessionUser?.username || 'anonymous',
    email: sessionUser?.displayName || 'anonymous',
    browser: getBrowserInfo(),
    severity,
    resolved: false,
    resolutionNotes: '',
    synced: true
  };

  // Keep in local cache for instant UI
  const currentLogs = getLocalLogs();
  currentLogs.unshift(logItem);
  saveLocalLogs(currentLogs);

  // Send to backend / MySQL
  saveLogToMysql(logItem).catch(() => {});

  return logItem;
}

export async function syncOfflineLogs(): Promise<number> {
  return 0;
}

export function clearLocalLogs(): void {
  localStorage.removeItem(LOCAL_LOGS_KEY);
  clearLogsInMysql().catch(() => {});
}

export async function fetchRemoteLogs(limitCount: number = 100): Promise<SystemLog[]> {
  try {
    const logs = await fetchLogsFromMysql();
    if (logs && logs.length > 0) {
      saveLocalLogs(logs);
      return logs;
    }
  } catch (e) {}
  return getLocalLogs();
}

export async function resolveLog(logId: string, notes: string): Promise<void> {
  const localLogs = getLocalLogs();
  const idx = localLogs.findIndex(l => l.id === logId);
  if (idx !== -1) {
    localLogs[idx].resolved = true;
    localLogs[idx].resolutionNotes = notes;
    saveLocalLogs(localLogs);
    saveLogToMysql(localLogs[idx]).catch(() => {});
  }
}

export async function deleteLog(logId: string): Promise<void> {
  const localLogs = getLocalLogs();
  const filtered = localLogs.filter(l => l.id !== logId);
  saveLocalLogs(filtered);
}
