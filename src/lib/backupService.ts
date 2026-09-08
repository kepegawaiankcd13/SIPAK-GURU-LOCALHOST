import { collection, getDocs, doc, setDoc, writeBatch } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
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
 * Automatically checks browser local storage for any legacy data (from previous offline/prototype sessions)
 * and migrates them safely to the active Firebase Cloud Firestore.
 */
export async function checkAndMigrateLegacyLocalStorage(db: Firestore): Promise<number> {
  let migratedCount = 0;
  try {
    // 1. Check legacy teachers
    const legacyTeachersStr = localStorage.getItem("sipak_teachers") || localStorage.getItem("sipak_teachers_list") || localStorage.getItem("teachers");
    if (legacyTeachersStr) {
      try {
        const teachersList = JSON.parse(legacyTeachersStr);
        if (Array.isArray(teachersList) && teachersList.length > 0) {
          for (const teacher of teachersList) {
            const teacherId = teacher.id || teacher.nip || `teacher_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const { evaluations, ...profileData } = teacher;
            const tDocRef = doc(db, "teachers", teacherId);
            await setDoc(tDocRef, profileData, { merge: true });
            migratedCount++;

            // Migrate evaluations if present
            if (Array.isArray(evaluations) && evaluations.length > 0) {
              for (let i = 0; i < evaluations.length; i++) {
                const evalItem = evaluations[i];
                const evalId = evalItem.id || `eval_${evalItem.year || 2024}_${i}`;
                const eDocRef = doc(db, "teachers", teacherId, "evaluations", evalId);
                await setDoc(eDocRef, evalItem, { merge: true });
              }
            }
          }
        }
      } catch (e) {
        console.warn("Failed parsing legacy teachers from localStorage:", e);
      }
    }

    // 2. Check legacy schools
    const legacySchoolsStr = localStorage.getItem("sipak_schools") || localStorage.getItem("schools");
    if (legacySchoolsStr) {
      try {
        const schoolsList = JSON.parse(legacySchoolsStr);
        if (Array.isArray(schoolsList) && schoolsList.length > 0) {
          for (const school of schoolsList) {
            const schoolId = school.id || school.npsn || `school_${Date.now()}`;
            const sDocRef = doc(db, "schools", schoolId);
            await setDoc(sDocRef, school, { merge: true });
            migratedCount++;
          }
        }
      } catch (e) {
        console.warn("Failed parsing legacy schools from localStorage:", e);
      }
    }

    // 3. Check legacy users
    const legacyUsersStr = localStorage.getItem("sipak_users") || localStorage.getItem("sipak_app_users") || localStorage.getItem("users");
    if (legacyUsersStr) {
      try {
        const usersList = JSON.parse(legacyUsersStr);
        if (Array.isArray(usersList) && usersList.length > 0) {
          for (const u of usersList) {
            if (u.username) {
              const uDocRef = doc(db, "app_users", u.username);
              await setDoc(uDocRef, u, { merge: true });
              migratedCount++;
            }
          }
        }
      } catch (e) {
        console.warn("Failed parsing legacy users from localStorage:", e);
      }
    }
  } catch (err) {
    console.warn("Migration scanner error:", err);
  }

  return migratedCount;
}

/**
 * Exports complete cloud database to a downloadable JSON file
 */
export async function exportDatabaseToJSON(db: Firestore, exportedBy: string = "admin"): Promise<void> {
  try {
    toast.info("Mengumpulkan seluruh data database cloud...");

    // 1. Fetch schools
    const schoolsSnap = await getDocs(collection(db, "schools"));
    const schools: any[] = [];
    schoolsSnap.forEach((docSnap) => {
      schools.push({ id: docSnap.id, ...docSnap.data() });
    });

    // 2. Fetch app_users
    const usersSnap = await getDocs(collection(db, "app_users"));
    const app_users: any[] = [];
    usersSnap.forEach((docSnap) => {
      app_users.push({ username: docSnap.id, ...docSnap.data() });
    });

    // 3. Fetch teachers and subcollections
    const teachersSnap = await getDocs(collection(db, "teachers"));
    const teachers: any[] = [];
    for (const tDoc of teachersSnap.docs) {
      const teacherData = { id: tDoc.id, ...tDoc.data() } as any;
      const evalsSnap = await getDocs(collection(db, "teachers", tDoc.id, "evaluations"));
      const evalsList: any[] = [];
      evalsSnap.forEach((eDoc) => {
        evalsList.push({ id: eDoc.id, ...eDoc.data() });
      });
      teacherData.evaluations = evalsList;
      teachers.push(teacherData);
    }

    const backupPayload: BackupData = {
      version: "2.0-permepan-rb-1-2023",
      timestamp: new Date().toISOString(),
      exportedBy,
      schools,
      app_users,
      teachers
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("download", `SIPAK_BACKUP_DATA_JABAR_${dateStamp}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    swal.fire({
      title: "Pencadangan Berhasil!",
      text: `File cadangan berisi ${schools.length} sekolah, ${app_users.length} akun operator, dan ${teachers.length} guru PNS berhasil diunduh. Simpan berkas JSON ini dengan aman.`,
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
 * Restores cloud database from a JSON backup file
 */
export async function importDatabaseFromJSON(db: Firestore, jsonString: string): Promise<boolean> {
  try {
    const backup: BackupData = JSON.parse(jsonString);
    if (!backup.schools && !backup.teachers && !backup.app_users) {
      throw new Error("Format berkas JSON tidak valid. Pastikan ini adalah file backup resmi SIPAK.");
    }

    let schoolCount = 0;
    let userCount = 0;
    let teacherCount = 0;

    // 1. Restore schools
    if (Array.isArray(backup.schools)) {
      for (const s of backup.schools) {
        const sId = s.id || s.npsn;
        if (sId) {
          await setDoc(doc(db, "schools", sId), s, { merge: true });
          schoolCount++;
        }
      }
    }

    // 2. Restore app_users
    if (Array.isArray(backup.app_users)) {
      for (const u of backup.app_users) {
        const uId = u.username;
        if (uId) {
          await setDoc(doc(db, "app_users", uId), u, { merge: true });
          userCount++;
        }
      }
    }

    // 3. Restore teachers & evaluations
    if (Array.isArray(backup.teachers)) {
      for (const t of backup.teachers) {
        const tId = t.id || t.nip;
        if (tId) {
          const { evaluations, ...profileData } = t;
          await setDoc(doc(db, "teachers", tId), profileData, { merge: true });
          teacherCount++;

          if (Array.isArray(evaluations)) {
            for (let i = 0; i < evaluations.length; i++) {
              const evalItem = evaluations[i];
              const evalId = evalItem.id || `eval_${evalItem.year || 2024}_${i}`;
              await setDoc(doc(db, "teachers", tId, "evaluations", evalId), evalItem, { merge: true });
            }
          }
        }
      }
    }

    swal.fire({
      title: "Pemulihan Data Berhasil!",
      text: `Berhasil memulihkan ${schoolCount} data sekolah master, ${userCount} akun operator, dan ${teacherCount} data guru PNS beserta seluruh riwayat penilaian SKP ke Cloud Database Firestore!`,
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
