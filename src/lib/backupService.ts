import { toast, swal } from "./toast";
import type { TeacherProfile, SKPEvaluation } from "../types";

export interface BackupData {
  version: string;
  timestamp: string;
  exportedBy?: string;
  schools: Array<{ id: string; npsn: string; name: string; [key: string]: any }>;
  app_users: Array<{ username: string; displayName: string; role: string; school: string; password?: string }>;
  teachers: Array<TeacherProfile & { id: string; evaluations?: SKPEvaluation[] }>;
}

/**
 * Clean up legacy localStorage caches so they do not conflict with MySQL.
 */
export async function checkAndMigrateLegacyLocalStorage(): Promise<number> {
  try {
    // Clear obsolete legacy prototype keys that cause stale data
    localStorage.removeItem("sipak_teachers");
    localStorage.removeItem("sipak_teachers_list");
    localStorage.removeItem("teachers");
    localStorage.removeItem("sipak_schools");
    localStorage.removeItem("schools");
    localStorage.removeItem("sipak_users");
    localStorage.removeItem("users");
  } catch (e) {}
  return 0;
}

/**
 * Exports complete MySQL database to a downloadable JSON file
 */
export async function exportDatabaseToJSON(dbArg?: any, exportedBy: string = "admin"): Promise<void> {
  try {
    toast.info("Mengumpulkan seluruh data dari database MySQL XAMPP...");

    const res = await fetch('/api/backup/export');
    let backupPayload: any;
    if (res.ok) {
      backupPayload = await res.json();
    } else {
      throw new Error("Gagal mengambil data dari server");
    }

    const schoolsCount = backupPayload.schools?.length || 0;
    const usersCount = backupPayload.app_users?.length || 0;
    const teachersCount = backupPayload.teachers?.length || 0;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("download", `SIPAK_BACKUP_MYSQL_XAMPP_${dateStamp}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    swal.fire({
      title: "Pencadangan Berhasil!",
      text: `File cadangan berisi ${schoolsCount} sekolah, ${usersCount} akun operator, dan ${teachersCount} guru PNS berhasil diunduh langsung dari database MySQL XAMPP.`,
      icon: "success"
    });
  } catch (err: any) {
    console.error("Export backup error:", err);
    swal.fire({
      title: "Gagal Mencadangkan Data!",
      text: "Terjadi gangguan saat membuat berkas cadangan: " + (err.message || String(err)),
      icon: "error"
    });
  }
}

/**
 * Restores MySQL database from a JSON backup file
 */
export async function importDatabaseFromJSON(dbArg: any, jsonString: string): Promise<boolean> {
  try {
    const backup: BackupData = JSON.parse(jsonString);
    if (!backup.schools && !backup.teachers && !backup.app_users) {
      throw new Error("Format berkas JSON tidak valid. Pastikan ini adalah file backup resmi SIPAK.");
    }

    toast.info("Mengimpor data ke database MySQL XAMPP...");
    const res = await fetch('/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backup)
    });

    if (!res.ok) {
      throw new Error("Server gagal memproses pemulihan data");
    }

    const schoolCount = backup.schools?.length || 0;
    const userCount = backup.app_users?.length || 0;
    const teacherCount = backup.teachers?.length || 0;

    swal.fire({
      title: "Pemulihan Data Berhasil!",
      text: `Berhasil memulihkan ${schoolCount} data sekolah master, ${userCount} akun operator, dan ${teacherCount} data guru PNS beserta riwayat SKP ke Database MySQL XAMPP!`,
      icon: "success",
      confirmButtonText: "Selesai"
    });

    return true;
  } catch (err: any) {
    console.error("Import backup error:", err);
    swal.fire({
      title: "Gagal Memulihkan Data!",
      text: "Berkas tidak dapat diproses: " + (err.message || String(err)),
      icon: "error"
    });
    return false;
  }
}
