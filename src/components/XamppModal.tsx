import React, { useState, useEffect } from "react";
import { 
  Database, 
  Download, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Terminal, 
  ExternalLink, 
  Copy, 
  Check, 
  Server, 
  FileCode, 
  Key, 
  X,
  AlertCircle,
  HelpCircle,
  Laptop
} from "lucide-react";
import { toast } from "../lib/toast";

interface XamppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DbStatus {
  connected: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  message: string;
  tables?: string[];
  tablesCount?: number;
}

export default function XamppModal({ isOpen, onClose }: XamppModalProps) {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'guide' | 'tables' | 'config'>('guide');

  const checkStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/db-status");
      const data = await res.json();
      setDbStatus(data);
    } catch (err: any) {
      setDbStatus({
        connected: false,
        host: "localhost",
        port: 3306,
        database: "sipak_guru_db",
        user: "root",
        message: "Tidak dapat menghubungi server backend: " + (err.message || String(err)),
        tables: [],
        tablesCount: 0
      });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    toast.success("Perintah berhasil disalin ke clipboard!");
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const handleDownloadSql = () => {
    window.location.href = "/api/download-sql";
    toast.success("File database.sql sedang diunduh...");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">Konfigurasi Database XAMPP di macOS</h2>
                <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-400/30 uppercase">
                  MySQL / MariaDB
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Panduan instalasi offline di MacBook/Mac menggunakan XAMPP & skema <code className="text-amber-300 font-mono">database.sql</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          
          {/* Status Bar & Action Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Status Card */}
            <div className="md:col-span-2 p-4 rounded-2xl border bg-slate-50 border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-slate-600" /> Status Koneksi MySQL
                  </span>
                  <button
                    onClick={checkStatus}
                    disabled={loadingStatus}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingStatus ? "animate-spin" : ""}`} /> Uji Ulang
                  </button>
                </div>

                {loadingStatus ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium py-1 animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                    Sedang memeriksa koneksi ke MySQL port 3306...
                  </div>
                ) : dbStatus?.connected ? (
                  <div className="flex items-start gap-2.5 text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                    <div className="text-xs">
                      <p className="font-bold">Terhubung ke MySQL XAMPP!</p>
                      <p className="text-[11px] text-emerald-600">
                        Database: <strong className="font-mono">{dbStatus.database}</strong> ({dbStatus.tablesCount || 0} tabel terdeteksi di {dbStatus.host}:{dbStatus.port})
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                    <div className="text-xs">
                      <p className="font-bold">MySQL XAMPP Belum Aktif di Localhost</p>
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        Saat menjalankan di Mac Anda, buka aplikasi XAMPP dan tekan <strong>Start</strong> pada MySQL Database. (Di mode cloud preview, database terhubung via Cloud).
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Target DB Spec */}
              <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium">
                <div>Host: <span className="font-mono font-bold text-slate-800">localhost:3306</span></div>
                <div>User: <span className="font-mono font-bold text-slate-800">root</span></div>
                <div>Pass: <span className="font-mono text-slate-400 font-semibold">(kosong)</span></div>
                <div>Database: <span className="font-mono font-bold text-indigo-700">sipak_guru_db</span></div>
              </div>
            </div>

            {/* Quick Download Card */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col justify-between text-center">
              <div>
                <div className="w-10 h-10 mx-auto bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md mb-2">
                  <FileCode className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-black text-indigo-950 uppercase tracking-tight">File Skema SQL</h4>
                <p className="text-[11px] text-indigo-700 font-medium mt-0.5">
                  Berisi perintah CREATE DATABASE, 6 tabel lengkap, dan data bawaan.
                </p>
              </div>

              <button
                onClick={handleDownloadSql}
                className="mt-3 w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer select-none"
              >
                <Download className="w-4 h-4" /> UNDUH database.sql
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveTab('guide')}
              className={`pb-2.5 px-4 cursor-pointer border-b-2 transition-colors ${
                activeTab === 'guide'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              1. Langkah XAMPP di Mac
            </button>
            <button
              onClick={() => setActiveTab('tables')}
              className={`pb-2.5 px-4 cursor-pointer border-b-2 transition-colors ${
                activeTab === 'tables'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              2. Daftar Tabel & Struktur (.sql)
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`pb-2.5 px-4 cursor-pointer border-b-2 transition-colors ${
                activeTab === 'config'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              3. Perintah Terminal Mac & .env
            </button>
          </div>

          {/* Tab 1: Panduan XAMPP */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-black text-slate-900 uppercase flex items-center gap-2 text-xs">
                  <Laptop className="w-4 h-4 text-indigo-600" /> 4 Langkah Menyiapkan XAMPP di MacBook / Mac:
                </h4>
                
                <ol className="space-y-3 list-decimal list-inside text-slate-600 font-medium">
                  <li className="pl-1">
                    <strong className="text-slate-900">Buka XAMPP di Mac:</strong> Masuk ke tab <em>Manage Servers</em>, lalu pastikan <strong>MySQL Database</strong> dan <strong>Apache Web Server</strong> sudah berwarna hijau (<em>Running</em>).
                  </li>
                  <li className="pl-1">
                    <strong className="text-slate-900">Buka phpMyAdmin:</strong> Buka Safari atau Google Chrome di Mac Anda, lalu buka tautan:
                    <div className="mt-1 flex items-center gap-2">
                      <code className="bg-white border border-slate-300 font-mono text-[11px] px-2 py-1 rounded text-indigo-700 select-all">
                        http://localhost/phpmyadmin
                      </code>
                    </div>
                  </li>
                  <li className="pl-1">
                    <strong className="text-slate-900">Impor File database.sql:</strong>
                    <div className="mt-1 space-y-1 text-slate-600 pl-4 list-disc">
                      <p>• Di menu atas phpMyAdmin, klik tab <strong>Import</strong> (Impor).</p>
                      <p>• Klik <strong>Choose File</strong> / <strong>Pilih File</strong>, lalu pilih file <code className="font-mono text-indigo-700">database.sql</code> yang telah Anda unduh.</p>
                      <p>• Klik tombol <strong>Import</strong> / <strong>Kirim</strong> di bagian bawah halaman.</p>
                      <p className="text-emerald-700 font-bold">
                        ✓ Skrip SQL otomatis membuat database <span className="font-mono underline">sipak_guru_db</span>, 6 tabel lengkap, indeks, serta data akun awal!
                      </p>
                    </div>
                  </li>
                  <li className="pl-1">
                    <strong className="text-slate-900">Jalankan Aplikasi di Terminal:</strong> Ikuti instruksi pada Tab 3 untuk menjalankan server lokal.
                  </li>
                </ol>
              </div>

              {/* Login info */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl">
                <h5 className="font-black text-amber-950 uppercase text-xs flex items-center gap-2 mb-2">
                  <Key className="w-3.5 h-3.5 text-amber-600" /> Akun Login Default Setelah Impor:
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="bg-white/80 border border-amber-200 p-2 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Super Admin Dinas:</span>
                    User: <strong className="text-slate-900">admin</strong> | Pass: <strong className="text-slate-900">adminpaskonversi</strong>
                  </div>
                  <div className="bg-white/80 border border-amber-200 p-2 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Operator SMAN 1 Ciamis:</span>
                    User: <strong className="text-slate-900">sman1ciamis</strong> | Pass: <strong className="text-slate-900">sman1ciamis123</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Tabel & Struktur */}
          {activeTab === 'tables' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <p className="text-slate-600 font-medium">
                  Database <strong className="text-indigo-700 font-mono">sipak_guru_db</strong> terdiri atas 6 tabel berikut:
                </p>
                <button
                  onClick={handleDownloadSql}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh .sql
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] border-b border-slate-200">
                      <th className="p-3">Nama Tabel</th>
                      <th className="p-3">Primary Key / Relasi</th>
                      <th className="p-3">Fungsi & Data yang Disimpan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">app_users</td>
                      <td className="p-3 font-mono text-slate-500">username (UNIQUE)</td>
                      <td className="p-3 text-slate-600">Akun login super_admin & operator sekolah klien</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">schools</td>
                      <td className="p-3 font-mono text-slate-500">id, npsn (UNIQUE)</td>
                      <td className="p-3 text-slate-600">Master Data Unit Kerja / Sekolah, Kepala Sekolah, NIP</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">teachers</td>
                      <td className="p-3 font-mono text-slate-500">id, nip</td>
                      <td className="p-3 text-slate-600">Profil Guru PNS, Pangkat/Golongan, SK PAK, TTD/TTE</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">evaluations</td>
                      <td className="p-3 font-mono text-slate-500">id, FK: teacherId</td>
                      <td className="p-3 text-slate-600">Riwayat konversi predikat SKP 2023, 2024, 2025 ke Angka Kredit</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">kop_settings</td>
                      <td className="p-3 font-mono text-slate-500">id</td>
                      <td className="p-3 text-slate-600">Pengaturan KOP surat Pemprov Jabar / Wilayah XIII</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">system_logs</td>
                      <td className="p-3 font-mono text-slate-500">id</td>
                      <td className="p-3 text-slate-600">Catatan audit log sistem dan riwayat operasional</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Terminal & Config */}
          {activeTab === 'config' && (
            <div className="space-y-4 text-xs">
              <div>
                <h5 className="font-black text-slate-900 uppercase text-xs mb-1.5 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-indigo-600" /> Perintah Terminal di macOS:
                </h5>
                <p className="text-slate-500 mb-2">Buka aplikasi Terminal di Mac, arahkan ke folder proyek, lalu jalankan:</p>
                
                <div className="bg-slate-950 text-slate-200 p-3.5 rounded-2xl font-mono text-[11px] space-y-2 border border-slate-800 relative group">
                  <p className="text-slate-400"># 1. Masuk ke direktori aplikasi</p>
                  <p className="text-emerald-400 font-bold">cd /path/ke/folder/sipak-guru</p>
                  <p className="text-slate-400 mt-2"># 2. Pasang semua dependensi</p>
                  <p className="text-amber-300 font-bold">npm install</p>
                  <p className="text-slate-400 mt-2"># 3. Jalankan aplikasi di localhost</p>
                  <p className="text-cyan-300 font-bold">npm run dev</p>

                  <button
                    onClick={() => copyToClipboard("npm install && npm run dev", "npm_cmd")}
                    className="absolute top-3 right-3 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedCmd === "npm_cmd" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCmd === "npm_cmd" ? "Tersalin" : "Salin"}
                  </button>
                </div>
              </div>

              <div>
                <h5 className="font-black text-slate-900 uppercase text-xs mb-1.5">
                  Pengaturan File <code className="font-mono text-indigo-700">.env</code> di Mac:
                </h5>
                <div className="bg-slate-900 text-slate-200 p-3 rounded-2xl font-mono text-[11px] border border-slate-800 relative">
                  <pre className="overflow-x-auto text-[11px] leading-relaxed">
{`PORT=3000
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="root"
DB_PASSWORD=""
DB_NAME="sipak_guru_db"`}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(`PORT=3000\nDB_HOST="localhost"\nDB_PORT="3306"\nDB_USER="root"\nDB_PASSWORD=""\nDB_NAME="sipak_guru_db"`, "env_cfg")}
                    className="absolute top-3 right-3 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedCmd === "env_cfg" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCmd === "env_cfg" ? "Tersalin" : "Salin"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-medium text-center sm:text-left">
            💡 File panduan lengkap juga tersimpan di <code className="font-mono text-indigo-700 font-bold">PANDUAN_XAMPP_MAC.md</code>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleDownloadSql}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" /> Unduh database.sql
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
