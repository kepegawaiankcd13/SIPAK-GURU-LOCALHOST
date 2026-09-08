import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Key, Users, School, ShieldAlert, Shield, AlertTriangle, RefreshCw, Edit, X, Download, Upload, Database } from "lucide-react";
import { toast, swal } from "../lib/toast";
import { exportDatabaseToJSON, importDatabaseFromJSON, checkAndMigrateLegacyLocalStorage } from "../lib/backupService";
import { saveUserToMysql, deleteUserFromMysql, fetchUsersFromMysql, fetchSchoolsFromMysql } from "../lib/mysqlSync";
import XamppModal from "./XamppModal";

interface AppUser {
  username: string;
  password?: string;
  role: 'super_admin' | 'school_admin';
  school: string;
  displayName: string;
}

export default function UserManagementTab() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // DB Reset states
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  // XAMPP Modal state
  const [xamppModalOpen, setXamppModalOpen] = useState(false);

  // Form states
  const [form, setForm] = useState({
    username: "",
    password: "",
    school: "",
    displayName: "",
    role: "school_admin" as "super_admin" | "school_admin"
  });

  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({
    newUsername: "",
    password: "",
    school: "",
    displayName: "",
    role: "school_admin" as "super_admin" | "school_admin"
  });
  const [editErrorMsg, setEditErrorMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, sList] = await Promise.all([
        fetchUsersFromMysql(),
        fetchSchoolsFromMysql()
      ]);

      if (sList && sList.length > 0) {
        const mappedSchools = sList.map((s: any) => ({
          id: s.id || s.npsn,
          name: s.name || ""
        }));
        mappedSchools.sort((a: any, b: any) => a.name.localeCompare(b.name));
        setSchools(mappedSchools);
      }

      if (uList && uList.length > 0) {
        const mappedUsers: AppUser[] = uList.map((u: any) => ({
          username: u.username,
          password: u.password || "",
          role: u.role || "school_admin",
          school: u.school || "",
          displayName: u.displayName || u.username
        }));
        mappedUsers.sort((a, b) => {
          if (a.role !== b.role) {
            return a.role === "super_admin" ? -1 : 1;
          }
          return a.username.localeCompare(b.username);
        });
        setUsers(mappedUsers);
      }
    } catch (e) {
      console.warn("Gagal memuat data pengguna/sekolah:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const uName = form.username.trim().toLowerCase().replace(/\s+/g, "");
    if (!uName || !form.password || !form.displayName || !form.school) {
      setErrorMsg("Semua field wajib diisi!");
      return;
    }

    // Prevent duplicate username
    if (users.some(u => u.username === uName)) {
      setErrorMsg("Username sudah digunakan! Pilih username lain.");
      return;
    }

    try {
      const payload = {
        username: uName,
        password: form.password,
        school: form.role === 'super_admin' ? 'ALL' : form.school.toUpperCase().trim(),
        role: form.role,
        displayName: form.displayName,
      };

      await saveUserToMysql(payload);
      setUsers((prev) => {
        const next = [...prev.filter(u => u.username !== uName), payload];
        next.sort((a, b) => (a.role === 'super_admin' ? -1 : 1));
        return next;
      });

      swal.fire({
        title: "Pendaftaran Operator Berhasil!",
        text: `Akun operator baru "${form.displayName}" (${form.username}) telah resmi didaftarkan di database MySQL XAMPP!`,
        icon: "success",
        confirmButtonText: "Selesai"
      });
      // Reset
      setIsAddingUser(false);
      setForm({
        username: "",
        password: "",
        school: "",
        displayName: "",
        role: "school_admin"
      });
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal mendaftarkan akun ke database: " + String(err));
    }
  };

  const startEditUser = (u: AppUser) => {
    setEditingUser(u);
    setEditForm({
      newUsername: u.username,
      password: u.password || "",
      school: u.school,
      displayName: u.displayName,
      role: u.role
    });
    setEditErrorMsg("");
    setIsAddingUser(false);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditErrorMsg("");

    const newUName = editForm.newUsername.trim().toLowerCase().replace(/\s+/g, "");
    if (!newUName || !editForm.password || !editForm.displayName || (editForm.role === 'school_admin' && !editForm.school)) {
      setEditErrorMsg("Semua field wajib diisi!");
      return;
    }

    if (newUName !== editingUser.username && users.some(u => u.username === newUName)) {
      setEditErrorMsg("Username baru sudah digunakan! Pilih username lain.");
      return;
    }

    try {
      const payload = {
        username: newUName,
        password: editForm.password,
        school: editForm.role === 'super_admin' ? 'ALL' : editForm.school.toUpperCase().trim(),
        role: editForm.role,
        displayName: editForm.displayName,
      };

      if (newUName !== editingUser.username) {
        if (editingUser.username !== "admin") {
          await deleteUserFromMysql(editingUser.username);
        }
      }
      await saveUserToMysql(payload);

      setUsers((prev) => {
        const filtered = prev.filter(u => u.username !== editingUser.username && u.username !== newUName);
        const next = [...filtered, payload];
        next.sort((a, b) => (a.role === 'super_admin' ? -1 : 1));
        return next;
      });

      swal.fire({
        title: "Akun Berhasil Diperbarui!",
        text: `Akun operator "${editForm.displayName}" (${newUName}) telah berhasil diubah di database MySQL XAMPP!`,
        icon: "success",
        confirmButtonText: "Selesai"
      });
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      setEditErrorMsg("Gagal memperbarui akun: " + String(err));
    }
  };

  const [pendingDelete, setPendingDelete] = useState<{username: string, displayName: string} | null>(null);

  const handleDeleteUser = (username: string, displayName: string) => {
    if (username === "admin") {
      toast.warning("Akun Super Admin Utama (admin) tidak dapat dihapus demi keamanan sistem!");
      return;
    }
    setPendingDelete({ username, displayName });
  };

  const executeDeleteUser = async () => {
    if (!pendingDelete) return;
    const { username } = pendingDelete;
    try {
      await deleteUserFromMysql(username);
      setUsers((prev) => prev.filter(u => u.username !== username));
      swal.fire({
        title: "Operator Dihapus!",
        text: `Akun operator "${pendingDelete.displayName}" ditiadakan dari sistem dan database MySQL XAMPP secara permanen.`,
        icon: "success",
        confirmButtonText: "Selesai"
      });
    } catch (err) {
      swal.fire({
        title: "Gagal Menghapus!",
        text: "Gagal menghapus akun: " + String(err),
        icon: "error"
      });
    } finally {
      setPendingDelete(null);
    }
  };

  const handleResetDatabase = async () => {
    if (confirmPassword !== "KONFIRMASI") {
      toast.warning("Harap ketik 'KONFIRMASI' untuk memverifikasi proses reset!");
      return;
    }

    setIsResetting(true);
    try {
      for (const u of users) {
        if (u.username !== "admin" && u.username !== "admin123") {
          await deleteUserFromMysql(u.username);
        }
      }
      await loadData();
      setResetModalOpen(false);
      setConfirmPassword("");
      swal.fire({
        title: "Database Dikosongkan!",
        text: "Sistem berhasil dikembalikan ke kondisi awal (Fresh Start) pada database MySQL XAMPP.",
        icon: "success",
        confirmButtonText: "Selesai"
      });
    } catch (err: any) {
      swal.fire({
        title: "Gagal Mengosongkan Database!",
        text: "Terjadi gangguan sistem saat mengosongkan data: " + String(err.message || err),
        icon: "error"
      });
    } finally {
      setIsResetting(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMigratingLocal, setIsMigratingLocal] = useState(false);

  const handleScanLocalStorage = async () => {
    setIsMigratingLocal(true);
    await checkAndMigrateLegacyLocalStorage();
    setIsMigratingLocal(false);
    swal.fire({
      title: "Pemeriksaan Selesai",
      text: "Seluruh cache lokal browser telah dibersihkan sehingga sistem murni menggunakan MySQL XAMPP.",
      icon: "info"
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = await importDatabaseFromJSON(null, content);
        if (ok) {
          await loadData();
        }
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="user-management-tab" className="space-y-6">
      
      {/* Overview Block */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase text-teal-650 tracking-wider">SIPAK-GURU Otoritas</span>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Manajemen Akun & Keamanan Data</h2>
          <p className="text-xs text-slate-500">
            Daftarkan username & password khusus tiap sekolah. Tiap sekolah hanya memiliki akses eksklusif ke datanya sendiri, sementara Anda melacak semuanya.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setXamppModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all cursor-pointer shadow-xs select-none"
            title="Panduan Database MySQL XAMPP di Mac & Unduh File database.sql"
          >
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            DATABASE XAMPP (MAC)
          </button>

          <button
            type="button"
            onClick={handleScanLocalStorage}
            disabled={isMigratingLocal}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all cursor-pointer shadow-xs select-none"
            title="Pindai data lama dari penyimpanan browser"
          >
            <Database className="w-3.5 h-3.5" />
            {isMigratingLocal ? "MEMINDAI..." : "PULIHKAN DARI BROWSER"}
          </button>

          <button
            type="button"
            onClick={() => exportDatabaseToJSON()}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-all cursor-pointer shadow-xs select-none"
            title="Unduh file backup seluruh database"
          >
            <Download className="w-3.5 h-3.5" /> CADANGKAN (.JSON)
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-xl border border-amber-200 transition-all cursor-pointer shadow-xs select-none"
            title="Pulihkan data dari file backup JSON"
          >
            <Upload className="w-3.5 h-3.5" /> PULIHKAN (.JSON)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => setIsAddingUser(!isAddingUser)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm select-none"
          >
            <Plus className="w-4 h-4" /> DAFTARKAN AKUN BARU
          </button>
        </div>
      </div>

      {/* Adding account form */}
      {isAddingUser && (
        <form onSubmit={handleCreateUser} className="bg-white border-2 border-teal-500 p-6 rounded-2xl shadow-md space-y-4 animate-slideDown">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" /> Registrasi Akun Pengguna Baru
            </h3>
            <button 
              type="button" 
              onClick={() => { setIsAddingUser(false); setErrorMsg(""); }}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              Batal
            </button>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-lg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">USERNAME (HURUF KECIL, TANPA SPASI)</label>
              <input
                type="text"
                placeholder="Contoh: sman3ciamis"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, "") })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-slate-500">PASSWORD MANDIRI</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, password: "tetapsemangat" })}
                  className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                >
                  ⚡ Reset Default: tetapsemangat
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Contoh: ciamis3pass"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 pl-9 focus:outline-teal-500 font-mono"
                  required
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">NAMA OPERATOR / PENGELOLA</label>
              <input
                type="text"
                placeholder="Contoh: Admin SMAN 3 CIAMIS"
                value={form.displayName}
                onChange={e => setForm({ ...form, displayName: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">HAK AKSES / ROLE</label>
              <select
                value={form.role}
                onChange={e => {
                  const r = e.target.value as "super_admin" | "school_admin";
                  setForm({ ...form, role: r, school: r === 'super_admin' ? 'ALL' : "" });
                }}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
              >
                <option value="school_admin">Operator Sekolah (Akses Terisolasi)</option>
                <option value="super_admin">Super Admin (Akses Global Kedinasan)</option>
              </select>
            </div>

            {form.role === "school_admin" && (
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">UNIT KERJA SEKOLAH (PILIH DARI DATA SEKOLAH MASTER)</label>
                <div className="relative">
                  <select
                    value={form.school}
                    onChange={e => setForm({ ...form, school: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 pl-9 focus:outline-teal-500 text-slate-800"
                    required={form.role === 'school_admin'}
                  >
                    <option value="">-- PILIH UNIT KERJA SEKOLAH --</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.name}>{s.name} (NPSN: {s.id})</option>
                    ))}
                  </select>
                  <School className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                {schools.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    ⚠️ Belum ada instansi sekolah terdaftar di database. Silakan daftarkan di menu MASTER DATA SEKOLAH terlebih dahulu.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs transition-colors"
            >
              SIMPAN AKUN BARU
            </button>
          </div>
        </form>
      )}

      {/* Edit account form */}
      {editingUser && (
        <form onSubmit={handleUpdateUser} className="bg-white border-2 border-amber-500 p-6 rounded-2xl shadow-md space-y-4 animate-slideDown">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
              <Edit className="w-4 h-4 text-amber-600" /> EDIT & RESET AKUN: <span className="text-amber-700 font-mono">{editingUser.username}</span>
            </h3>
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-4 h-4" /> Batal
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">USERNAME (HURUF KECIL, TANPA SPASI)</label>
              <input
                type="text"
                placeholder="Contoh: sman3ciamis"
                disabled={editingUser.username === 'admin'}
                value={editForm.newUsername}
                onChange={e => setEditForm({ ...editForm, newUsername: e.target.value.toLowerCase().replace(/\s+/g, "") })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-amber-500 disabled:bg-slate-100 disabled:text-slate-400 font-mono"
                required
              />
              {editingUser.username === 'admin' && (
                <span className="text-[9px] text-rose-500 font-bold">Username super admin utama tidak dapat diubah</span>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-slate-500">PASSWORD / RESET PASSWORD</label>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, password: "tetapsemangat" })}
                  className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                >
                  ⚡ Reset Default: tetapsemangat
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Contoh: tetapsemangat / password baru..."
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 pl-9 focus:outline-amber-500 font-mono text-slate-800 font-bold"
                  required
                />
                <Key className="w-4 h-4 text-amber-500 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">NAMA OPERATOR / PENGELOLA</label>
              <input
                type="text"
                placeholder="Contoh: Admin SMAN 3 CIAMIS"
                value={editForm.displayName}
                onChange={e => setEditForm({ ...editForm, displayName: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-amber-500 text-slate-800 font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">HAK AKSES / ROLE</label>
              <select
                disabled={editingUser.username === 'admin'}
                value={editForm.role}
                onChange={e => {
                  const r = e.target.value as "super_admin" | "school_admin";
                  setEditForm({ ...editForm, role: r, school: r === 'super_admin' ? 'ALL' : "" });
                }}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-amber-500 font-bold disabled:bg-slate-100"
              >
                <option value="school_admin">Operator Sekolah (Akses Terisolasi)</option>
                <option value="super_admin">Super Admin (Akses Global Kedinasan)</option>
              </select>
            </div>

            {editForm.role === "school_admin" && (
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">UNIT KERJA SEKOLAH</label>
                <select
                  value={editForm.school}
                  onChange={e => setEditForm({ ...editForm, school: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-amber-500 font-bold uppercase"
                  required={editForm.role === "school_admin"}
                >
                  <option value="">-- PILIH SEKOLAH MASTER --</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.name}>{s.name} (NPSN: {s.id})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {editErrorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {editErrorMsg}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
            >
              BATAL
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs transition-colors"
            >
              SIMPAN PERUBAHAN AKUN
            </button>
          </div>
        </form>
      )}

      {/* Accounts tabular view */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-xs font-black text-slate-900 uppercase">Daftar Akun Otoritas Portal</h3>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 uppercase font-bold animate-pulse">
            Memuat database kredensial...
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Belum ada akun terdaftar di database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-400 uppercase font-black text-[9px] border-b border-slate-100 select-none">
                  <th className="p-4">Username</th>
                  <th className="p-4">Nama Operator</th>
                  <th className="p-4">Sekolah Klien</th>
                  <th className="p-4">Password</th>
                  <th className="p-4 text-center">Hak Akses</th>
                  <th className="p-4 text-right">Opsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {users.map(u => (
                  <tr key={u.username} className="hover:bg-slate-50/50">
                    <td className="p-4 font-bold text-slate-900 font-mono">
                      {u.username}
                    </td>
                    <td className="p-4 text-slate-700">
                      {u.displayName}
                    </td>
                    <td className="p-4 text-slate-500 font-semibold uppercase">
                      {u.school === 'ALL' ? (
                        <span className="text-teal-605">Seluruh Sekolah (KCD XIII)</span>
                      ) : (
                        u.school
                      )}
                    </td>
                    <td className="p-4 text-slate-400 font-mono tracking-widest bg-slate-50/40">
                      {u.password}
                    </td>
                    <td className="p-4 text-center">
                      {u.role === 'super_admin' ? (
                        <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-800 font-black text-[9px] px-2 py-0.5 rounded border border-teal-200 uppercase">
                          <Shield className="w-2.5 h-2.5" /> SUPER ADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-650 font-bold text-[9px] px-2 py-0.5 rounded border border-slate-200 uppercase">
                          <School className="w-2.5 h-2.5" /> SEKOLAH
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right select-none flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEditUser(u)}
                        title="Edit Akun & Reset Password"
                        className="p-1.5 rounded transition-colors text-slate-500 hover:bg-amber-50 hover:text-amber-600 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.username, u.displayName)}
                        disabled={u.username === 'admin'}
                        title={u.username === 'admin' ? "Tidak bisa menghapus super admin" : "Hapus akun"}
                        className={`p-1.5 rounded transition-colors ${u.username === 'admin' ? 'text-slate-200 cursor-not-allowed' : 'text-slate-450 hover:bg-rose-50 hover:text-rose-600 cursor-pointer'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger Zone: Reset Database */}
      <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-rose-900 uppercase">Zona Bahaya / Pengosongan Database</h3>
            <p className="text-xs text-rose-700 font-medium">
              Fitur ini akan menghapus **SELURUH DATA** (Semua data Sekolah master, semua data Guru PNS, semua berkas Riwayat Penilaian SKP/Konversi, serta semua akun Operator Sekolah klien), kecuali akun administrator utama (**admin**). Gunakan hanya jika Anda ingin memulai dari nol untuk rilis kantor baru.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-start">
          <button
            type="button"
            onClick={() => {
              setConfirmPassword("");
              setResetModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-750 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-xs select-none uppercase"
          >
            <RefreshCw className="w-4 h-4 animate-spin-slow" /> BERSIHKAN / RESET DATABASE
          </button>
        </div>
      </div>

      {/* Custom Delete User Confirmation Modal */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fadeIn text-slate-100">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-100 uppercase tracking-tight">Hapus Akun Pengguna</h3>
              <p className="text-xs text-slate-400">
                Apakah Anda yakin ingin menghapus akun operator <strong className="text-white">"{pendingDelete.displayName}" ({pendingDelete.username})</strong>?
                Sekolah yang bersangkutan tidak akan memiliki akses pendaftaran lagi jika akun ini dihapus.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold text-xs rounded-xl border border-slate-705 cursor-pointer transition-colors"
              >
                BATAL
              </button>
              <button
                type="button"
                onClick={executeDeleteUser}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl border border-rose-500 cursor-pointer transition-colors"
              >
                YA, HAPUS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Global DB Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fadeIn text-slate-100">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-2 text-center">
              <h3 className="text-base font-black text-slate-100 uppercase tracking-tight text-rose-500">Konfirmasi Pembersihan Database</h3>
              <p className="text-xs text-slate-400">
                Tindakan ini **TIDAK DAPAT DIURUNKAN ATAU DIKEMBALIKAN**. Semua data instansi, guru, penilaian SKP, dan akun operator sekolah klien di cloud database akan dihapus permanen.
              </p>
              <p className="text-xs text-rose-400 font-semibold uppercase">
                Ketik kata <strong className="text-white underline">KONFIRMASI</strong> di bawah ini untuk menyetujui:
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="PROSES KONFIRMASI"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-center text-xs border border-slate-700 bg-slate-950/60 text-white font-black rounded-lg p-3 uppercase tracking-widest focus:outline-rose-500"
                disabled={isResetting}
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setResetModalOpen(false);
                    setConfirmPassword("");
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold text-xs rounded-xl border border-slate-705 cursor-pointer transition-colors"
                  disabled={isResetting}
                >
                  BATAL
                </button>
                <button
                  type="button"
                  onClick={handleResetDatabase}
                  disabled={confirmPassword !== "KONFIRMASI" || isResetting}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950 disabled:text-rose-800 text-white font-black text-xs rounded-xl border border-rose-500 disabled:border-rose-950 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      MEMPROSES...
                    </>
                  ) : (
                    "YA, RESET TOTAL"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* XAMPP MySQL Configuration Modal */}
      <XamppModal isOpen={xamppModalOpen} onClose={() => setXamppModalOpen(false)} />

    </div>
  );
}
