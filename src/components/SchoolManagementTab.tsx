import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit, Building, MapPin, Search, LayoutGrid, List, Filter, Database, RefreshCw, CheckCircle2, Upload, Download } from "lucide-react";
import { toast, swal } from "../lib/toast";
import { 
  saveSchoolToMysql,
  saveSchoolToMysqlDetailed,
  deleteSchoolFromMysql, 
  fetchSchoolsFromMysql, 
  checkMysqlConnection, 
  syncBatchToMysql 
} from "../lib/mysqlSync";

export interface School {
  id: string; // NPSN is used as ID
  npsn: string;
  name: string;
  address?: string;
  city?: string;
  principalName?: string;
  principalNip?: string;
  principalStatus?: "definitif" | "plt" | "plh";
}

interface SchoolManagementTabProps {
  userRole?: string;
  userSchool?: string;
  onSchoolsUpdated?: () => void;
}

export default function SchoolManagementTab({ userRole, userSchool, onSchoolsUpdated }: SchoolManagementTabProps) {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingSchool, setIsAddingSchool] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('sipak_school_view_mode') as 'grid' | 'list') || 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('sipak_school_view_mode', mode);
  };

  const [filterCity, setFilterCity] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  const uniqueCities = React.useMemo(() => {
    const citiesSet = new Set<string>();
    schools.forEach(s => {
      if (s.city && s.city.trim()) {
        citiesSet.add(s.city.toUpperCase().trim());
      }
    });
    return Array.from(citiesSet).sort();
  }, [schools]);

  const [form, setForm] = useState({
    npsn: "",
    name: "",
    address: "",
    city: "",
    principalName: "",
    principalNip: "",
    principalStatus: "definitif" as "definitif" | "plt" | "plh"
  });

  const [isMysqlConnected, setIsMysqlConnected] = useState<boolean>(false);
  const [isSyncingMysql, setIsSyncingMysql] = useState<boolean>(false);
  const [isImportingSchools, setIsImportingSchools] = useState<boolean>(false);
  const [isImportingProcessing, setIsImportingProcessing] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const loadSchoolsFromDb = async () => {
    setLoading(true);
    try {
      const mysqlList = await fetchSchoolsFromMysql();
      if (mysqlList && mysqlList.length > 0) {
        const mapped = mysqlList.map((s: any) => ({
          id: s.id || s.npsn,
          npsn: s.npsn || s.id,
          name: s.name || "",
          address: s.address || "",
          city: s.city || "",
          principalName: s.principalName || "",
          principalNip: s.principalNip || "",
          principalStatus: s.principalStatus || "definitif"
        }));
        mapped.sort((a: School, b: School) => a.name.localeCompare(b.name));
        setSchools(mapped);
      }
    } catch (e) {
      console.warn("Gagal memuat data sekolah:", e);
    } finally {
      setLoading(false);
    }
  };

  // Check MySQL XAMPP status and load data on mount
  useEffect(() => {
    checkMysqlConnection().then((status) => {
      setIsMysqlConnected(status.connected);
    });
    loadSchoolsFromDb();
  }, []);

  const handleManualSyncToMysql = async () => {
    setIsSyncingMysql(true);
    try {
      const res = await syncBatchToMysql({ schools });
      if (res.success) {
        setIsMysqlConnected(true);
        swal.fire({
          title: "Sinkronisasi Berhasil!",
          text: `Sebanyak ${schools.length} instansi/sekolah berhasil disinkronkan ke database MySQL XAMPP (tabel \`schools\`)!`,
          icon: "success",
          confirmButtonText: "Bagus"
        });
      } else {
        swal.fire({
          title: "Gagal Menghubungi MySQL XAMPP",
          text: "Pastikan modul MySQL di aplikasi XAMPP Mac Anda sudah berstatus Running dan database \`sipak_guru_db\` sudah dibuat.",
          icon: "warning",
          confirmButtonText: "Cek Panduan"
        });
      }
    } catch (e: any) {
      toast.error("Sinkronisasi gagal: " + (e.message || String(e)));
    } finally {
      setIsSyncingMysql(false);
    }
  };

  const handleCreateOrUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const npsnTrimmed = form.npsn.trim();
    const nameTrimmed = form.name.toUpperCase().trim();

    if (!npsnTrimmed || !nameTrimmed) {
      setErrorMsg("NPSN dan Nama Sekolah wajib diisi!");
      return;
    }

    if (!/^\d+$/.test(npsnTrimmed) || npsnTrimmed.length < 4 || npsnTrimmed.length > 12) {
      setErrorMsg("NPSN harus berupa angka (4 hingga 12 digit)!");
      return;
    }

    try {
      const schoolId = editingSchool ? editingSchool.id : npsnTrimmed;
      const payload = {
        npsn: npsnTrimmed,
        name: nameTrimmed,
        address: form.address.trim(),
        city: form.city.trim(),
        principalName: form.principalName.trim(),
        principalNip: form.principalNip.trim(),
        principalStatus: form.principalStatus
      };

      const newSchoolObj: School = {
        id: schoolId,
        ...payload
      };

      if (!editingSchool) {
        const existingSchool = schools.find((s) => s.npsn === npsnTrimmed);
        if (existingSchool) {
          setErrorMsg(`NPSN ${npsnTrimmed} sudah terdaftar untuk "${existingSchool.name}". Setiap sekolah memiliki NPSN 8-digit unik dari Kemendikbud.`);
          swal.fire({
            title: "NPSN Sudah Terdaftar!",
            text: `Nomor NPSN "${npsnTrimmed}" saat ini sudah terdaftar sebagai "${existingSchool.name}". Mohon periksa kembali nomor NPSN resmi sekolah yang ingin Anda daftarkan.`,
            icon: "warning",
            confirmButtonText: "Mengerti"
          });
          return;
        }
      }

      // 1. UPDATE LOCAL STATE IMMEDIATELY
      setSchools((prev) => {
        const filtered = prev.filter((s) => s.id !== schoolId && s.npsn !== npsnTrimmed);
        return [...filtered, newSchoolObj].sort((a, b) => a.name.localeCompare(b.name));
      });

      // 2. SAVE DIRECTLY TO MYSQL (Localhost / cPanel Database)
      const saveRes = await saveSchoolToMysqlDetailed(newSchoolObj);
      if (saveRes.ok) {
        setIsMysqlConnected(true);
      } else {
        throw new Error(saveRes.error || "Gagal menyimpan data sekolah ke database server.");
      }

      onSchoolsUpdated?.();

      swal.fire({
        title: editingSchool ? "Data Unit Kerja Diperbarui!" : "Sekolah Baru Terdaftar!",
        text: `Instansi "${nameTrimmed}" (NPSN: ${npsnTrimmed}) berhasil disimpan di Database MySQL (tabel \`schools\`)!`,
        icon: "success",
        confirmButtonText: "Selesai"
      });

      setIsAddingSchool(false);
      setEditingSchool(null);
      setForm({
        npsn: "",
        name: "",
        address: "",
        city: "",
        principalName: "",
        principalNip: "",
        principalStatus: "definitif"
      });
    } catch (err: any) {
      setErrorMsg("Gagal menyimpan data sekolah: " + (err.message || String(err)));
    }
  };

  const startEdit = (school: School) => {
    setEditingSchool(school);
    setForm({
      npsn: school.npsn,
      name: school.name,
      address: school.address || "",
      city: school.city || "",
      principalName: school.principalName || "",
      principalNip: school.principalNip || "",
      principalStatus: school.principalStatus || "definitif"
    });
    setIsAddingSchool(true);
    setErrorMsg("");
  };

  const [pendingDelete, setPendingDelete] = useState<School | null>(null);

  const handleDeleteSchool = (school: School) => {
    setPendingDelete(school);
  };

  const executeDeleteSchool = async () => {
    if (!pendingDelete) return;
    try {
      // 1. Delete from local state immediately
      setSchools((prev) => prev.filter((s) => s.id !== pendingDelete.id && s.npsn !== pendingDelete.npsn));

      // 2. Delete from MySQL
      await deleteSchoolFromMysql(pendingDelete.id);
      onSchoolsUpdated?.();

      swal.fire({
        title: "Instansi Dihapus!",
        text: `Sekolah "${pendingDelete.name}" beserta master data pendukungnya berhasil dihapus dari database MySQL.`,
        icon: "success",
        confirmButtonText: "Selesai"
      });
    } catch (err: any) {
      swal.fire({
        title: "Gagal Menghapus!",
        text: "Gagal menghapus data instansi: " + (err.message || String(err)),
        icon: "error"
      });
    } finally {
      setPendingDelete(null);
    }
  };

  // Export Master Schools to CSV
  const handleExportSchoolsToCSV = () => {
    const headers = [
      "NPSN",
      "Nama Sekolah",
      "Kabupaten / Kota",
      "Alamat Lengkap",
      "Nama Kepala Sekolah",
      "NIP Kepala Sekolah",
      "Status Kepala Sekolah"
    ];

    const rows = filteredSchools.map(s => [
      s.npsn || "",
      s.name || "",
      s.city || "",
      s.address || "",
      s.principalName || "",
      s.principalNip || "",
      (s.principalStatus || "definitif").toUpperCase()
    ]);

    const csvBody = [
      headers.map(h => `"${h}"`).join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvBody], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sikapita_master_sekolah_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Download CSV Import Template for Master Schools
  const handleDownloadSchoolTemplateCSV = () => {
    const headers = [
      "NPSN",
      "Nama Sekolah",
      "Kabupaten / Kota",
      "Alamat Lengkap",
      "Nama Kepala Sekolah",
      "NIP Kepala Sekolah",
      "Status Kepala Sekolah"
    ];

    const sampleRows = [
      [
        "20211512",
        "SMAN 1 CIAMIS",
        "KABUPATEN CIAMIS",
        "Jl. Gunung Galuh No. 37 Ciamis",
        "Dr. H. SOLIHIN, M.Pd.",
        "197005121995121001",
        "DEFINITIF"
      ],
      [
        "20211567",
        "SMKN 1 KAWALI",
        "KABUPATEN CIAMIS",
        "Jl. Talagasari No. 35 Kawali",
        "Dra. Hj. SITI NURJANAH, M.M.",
        "197208141998022002",
        "PLT"
      ]
    ];

    const csvBody = [
      headers.map(h => `"${h}"`).join(","),
      ...sampleRows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvBody], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_import_sekolah_sikapita.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // RFC-4180 CSV parser supporting comma (,), semicolon (;) from Excel ID, and tab (\t)
  const parseSchoolCSV = (rawText: string): string[][] => {
    const text = rawText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const firstNonEmptyLine = text.split("\n").find(l => l.trim().length > 0) || "";
    if (!firstNonEmptyLine) return [];

    let commaCount = 0;
    let semiCount = 0;
    let tabCount = 0;
    let inQuoteDetect = false;
    for (let i = 0; i < firstNonEmptyLine.length; i++) {
      const ch = firstNonEmptyLine[i];
      if (ch === '"') inQuoteDetect = !inQuoteDetect;
      else if (!inQuoteDetect) {
        if (ch === ',') commaCount++;
        else if (ch === ';') semiCount++;
        else if (ch === '\t') tabCount++;
      }
    }
    const delimiter = semiCount > commaCount && semiCount >= tabCount
      ? ';'
      : tabCount > commaCount
        ? '\t'
        : ',';

    const allRows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let insideQuote = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (insideQuote) {
        if (ch === '"' && next === '"') {
          currentField += '"';
          i++;
        } else if (ch === '"') {
          insideQuote = false;
        } else {
          currentField += ch;
        }
      } else {
        if (ch === '"' && currentField.trim() === "") {
          insideQuote = true;
          currentField = "";
        } else if (ch === delimiter) {
          currentRow.push(currentField.trim());
          currentField = "";
        } else if (ch === '\n') {
          currentRow.push(currentField.trim());
          if (currentRow.some(cell => cell.length > 0)) {
            allRows.push(currentRow);
          }
          currentRow = [];
          currentField = "";
        } else {
          currentField += ch;
        }
      }
    }

    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      allRows.push(currentRow);
    }

    if (allRows.length === 0) return [];

    const firstCol = (allRows[0][0] || "").toLowerCase();
    const secondCol = (allRows[0][1] || "").toLowerCase();
    const looksLikeHeader =
      firstCol.includes("npsn") ||
      secondCol.includes("sekolah") ||
      secondCol.includes("nama") ||
      firstCol === "no";

    return looksLikeHeader ? allRows.slice(1) : allRows;
  };

  // Bulk Import Schools from CSV
  const handleImportSchoolsCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = event.target;
    const file = inputEl.files?.[0];
    if (!file) return;

    inputEl.value = "";

    if (file.size > 5 * 1024 * 1024) {
      swal.fire({
        title: "File Terlalu Besar!",
        text: "Ukuran maksimal file CSV adalah 5MB.",
        icon: "warning"
      });
      return;
    }

    setIsImportingProcessing(true);
    setImportProgress(null);

    const reader = new FileReader();
    reader.onerror = () => {
      setIsImportingProcessing(false);
      setImportProgress(null);
      swal.fire({
        title: "Gagal Membaca File!",
        text: "Browser gagal membaca file CSV yang dipilih. Pastikan file tidak rusak atau terkunci.",
        icon: "error"
      });
    };

    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setIsImportingProcessing(false);
        return;
      }

      try {
        const rows = parseSchoolCSV(text);
        if (rows.length === 0) {
          swal.fire({
            title: "File Kosong / Format Tidak Dikenali!",
            text: "Tidak ada baris data sekolah yang terbaca dari file CSV tersebut. Pastikan menggunakan template CSV dengan kolom NPSN dan Nama Sekolah.",
            icon: "warning"
          });
          return;
        }

        let importCount = 0;
        let skippedCount = 0;
        let failCount = 0;
        const skipReasons: string[] = [];
        const errorReasons: string[] = [];

        setImportProgress({ current: 0, total: rows.length });

        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          setImportProgress({ current: idx + 1, total: rows.length });

          const npsn = (row[0] || "").trim().replace(/^'+/, "").replace(/\s+/g, "");
          const name = (row[1] || "").trim().toUpperCase();

          if (/e\+/i.test(npsn)) {
            skippedCount++;
            if (skipReasons.length < 3) skipReasons.push(`Baris ${idx + 2}: NPSN terbaca notasi ilmiah (${npsn}). Format kolom NPSN sebagai Text.`);
            continue;
          }

          if (!/^\d{4,12}$/.test(npsn)) {
            skippedCount++;
            if (skipReasons.length < 3) skipReasons.push(`Baris ${idx + 2}: NPSN tidak valid (${npsn || "kosong"}, harus 4-12 digit angka)`);
            continue;
          }

          if (!name) {
            skippedCount++;
            if (skipReasons.length < 3) skipReasons.push(`Baris ${idx + 2} (NPSN ${npsn}): Nama Sekolah kosong`);
            continue;
          }

          const city = (row[2] || "").trim().toUpperCase();
          const address = (row[3] || "").trim();
          const principalName = (row[4] || "").trim();
          const principalNip = (row[5] || "").trim().replace(/^'+/, "").replace(/\s+/g, "");

          if (principalNip && /e\+/i.test(principalNip)) {
            skippedCount++;
            if (skipReasons.length < 3) skipReasons.push(`Baris ${idx + 2} (${name}): NIP Kepala Sekolah terbaca notasi ilmiah (${principalNip}).`);
            continue;
          }

          const rawStatus = (row[6] || "").trim().toLowerCase();
          const principalStatus: "definitif" | "plt" | "plh" =
            rawStatus.includes("plt")
              ? "plt"
              : rawStatus.includes("plh")
              ? "plh"
              : "definitif";

          const existingSchool = schools.find((s) => s.npsn === npsn);
          const schoolId = existingSchool?.id || npsn;

          const schoolObj: School = {
            id: schoolId,
            npsn,
            name,
            city,
            address,
            principalName,
            principalNip,
            principalStatus
          };

          const saveResult = await saveSchoolToMysqlDetailed(schoolObj);
          if (saveResult.ok) {
            importCount++;
          } else {
            failCount++;
            if (errorReasons.length < 3) {
              errorReasons.push(`${name}: ${saveResult.error || "Gagal menyimpan ke server"}`);
            }
          }
        }

        await loadSchoolsFromDb();
        onSchoolsUpdated?.();

        if (importCount > 0 && failCount === 0) {
          setIsMysqlConnected(true);
          swal.fire({
            title: "Impor Sekolah Berhasil!",
            text: `Berhasil mengimpor ${importCount} master data sekolah ke database MySQL.${skippedCount > 0 ? ` (${skippedCount} baris dilewati: ${skipReasons.join("; ")})` : ""}`,
            icon: "success",
            confirmButtonText: "Selesai"
          });
          setIsImportingSchools(false);
        } else if (importCount > 0 && failCount > 0) {
          swal.fire({
            title: "Impor Sebagian Berhasil",
            text: `${importCount} data sekolah berhasil disimpan, namun ${failCount} data gagal disimpan (${errorReasons.join(" | ")}).${skippedCount > 0 ? ` ${skippedCount} baris dilewati.` : ""}`,
            icon: "warning",
            confirmButtonText: "Mengerti"
          });
        } else {
          const detailParts = [
            failCount > 0 ? `${failCount} gagal disimpan ke server (${errorReasons.join(" | ")})` : "",
            skippedCount > 0 ? `${skippedCount} baris dilewati (${skipReasons.join(" | ")})` : ""
          ].filter(Boolean);
          swal.fire({
            title: "Impor Sekolah Gagal!",
            text: `Tidak ada data sekolah yang berhasil disimpan ke database. ${detailParts.join(". ")}`,
            icon: "error",
            confirmButtonText: "Tutup"
          });
        }
      } catch (err: any) {
        swal.fire({
          title: "Impor Gagal!",
          text: "Terjadi kesalahan saat memproses CSV sekolah: " + (err.message || String(err)),
          icon: "error"
        });
      } finally {
        setIsImportingProcessing(false);
        setImportProgress(null);
      }
    };
    reader.readAsText(file);
  };

  const filteredSchools = schools.filter((s) => {
    if (userRole === "school_admin" && userSchool) {
      return s.name.toUpperCase().trim() === userSchool.toUpperCase().trim();
    }
    if (filterCity && s.city?.toUpperCase().trim() !== filterCity) {
      return false;
    }
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.npsn.includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q)
    );
  });

  const isSchoolAdmin = userRole === "school_admin";

  return (
    <div id="school-management-tab" className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase text-teal-650 tracking-wider">Si-KAPITA Hub</span>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            {isSchoolAdmin ? "Informasi & Data Sekolah Anda" : "Master Data Sekolah"}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {isSchoolAdmin 
              ? "Sesuaikan detail penandatangan, alamat, kota, dan status PLT/PLH kepala sekolah penilai kinerja untuk unit kerja Anda."
              : "Kelola pendaftaran sekolah, unit kerja, NPSN, dan nama kepala sekolah penilai kinerja untuk otomatisasi tanda tangan."
            }
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const status = await checkMysqlConnection(true);
              setIsMysqlConnected(status.connected);
              if (status.connected) {
                swal.fire({
                  title: "MySQL XAMPP Terhubung!",
                  text: `Koneksi ke database "${status.database}" di ${status.host}:${status.port} berhasil! Tabel terdeteksi: ${status.tables?.join(", ") || 'Belum ada tabel'}. Setiap perubahan data sekolah akan langsung tersimpan ke tabel MySQL \`schools\`.`,
                  icon: "success",
                  confirmButtonText: "Bagus"
                });
              } else {
                swal.fire({
                  title: "MySQL XAMPP Belum Terhubung",
                  text: `Status: ${status.message}. Pastikan XAMPP di Mac Anda sedang running (lampu hijau pada modul MySQL Database di tab 'Manage Servers' XAMPP).`,
                  icon: "warning",
                  confirmButtonText: "Tutup"
                });
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              isMysqlConnected 
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" 
                : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
            }`}
            title="Klik untuk tes status koneksi database MySQL XAMPP"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isMysqlConnected ? "MySQL XAMPP Aktif" : "Cek MySQL XAMPP"}</span>
          </button>

          <button
            type="button"
            onClick={handleManualSyncToMysql}
            disabled={isSyncingMysql}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Kirim semua data sekolah saat ini ke tabel `schools` MySQL XAMPP"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMysql ? 'animate-spin' : ''}`} />
            <span>{isSyncingMysql ? "Menyinkronkan..." : "Sinkron ke MySQL"}</span>
          </button>

          {!isSchoolAdmin && (userRole === "super_admin" || userRole === "admin") && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingSchool(null);
                  setForm({
                    npsn: "",
                    name: "",
                    address: "",
                    city: "",
                    principalName: "",
                    principalNip: "",
                    principalStatus: "definitif"
                  });
                  setIsAddingSchool(!isAddingSchool);
                  setIsImportingSchools(false);
                  setErrorMsg("");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm select-none"
              >
                <Plus className="w-4 h-4" /> TAMBAH SEKOLAH MASTER
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsImportingSchools(!isImportingSchools);
                  setIsAddingSchool(false);
                  setErrorMsg("");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm select-none"
              >
                <Upload className="w-4 h-4" /> IMPORT SEKOLAH (.CSV)
              </button>

              <button
                type="button"
                onClick={handleExportSchoolsToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm select-none"
              >
                <Download className="w-4 h-4" /> EKSPORT (.CSV)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collapsible Import Master Sekolah CSV Panel */}
      {isImportingSchools && !isSchoolAdmin && (
        <div className="bg-white border-2 border-emerald-500 p-6 rounded-2xl shadow-md space-y-4 animate-slideDown text-slate-800">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase">Impor Massal Master Data Sekolah (.CSV)</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsImportingSchools(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
            >
              Batal
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Unggah file Excel/CSV berisi daftar sekolah untuk mempercepat pengisian Master Data (mendukung pemisah koma <code className="px-1 bg-slate-100 rounded">,</code> atau titik koma <code className="px-1 bg-slate-100 rounded">;</code> dari Excel Indonesia).
                Pastikan kolom <strong>NPSN</strong> dan <strong>NIP Kepala Sekolah</strong> diformat sebagai <strong>Text</strong> agar tidak berubah menjadi format ilmiah Excel.
              </p>
              <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono">
                Kolom: NPSN | Nama Sekolah | Kab/Kota | Alamat | Nama Kepsek | NIP Kepsek | Status (DEFINITIF/PLT/PLH)
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadSchoolTemplateCSV}
                  disabled={isImportingProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-teal-600" /> Download Template CSV Sekolah
                </button>
              </div>
            </div>

            <div className="border border-dashed border-emerald-300 bg-emerald-50/20 p-6 rounded-xl text-center space-y-3 relative hover:bg-emerald-50/50 transition-colors">
              {isImportingProcessing ? (
                <>
                  <RefreshCw className="w-8 h-8 text-emerald-600 mx-auto animate-spin" />
                  <div>
                    <span className="text-xs font-bold text-emerald-700 block">
                      Sedang Mengimpor Master Sekolah{importProgress ? ` (${importProgress.current}/${importProgress.total})` : "..."}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Mohon tunggu hingga proses sinkronisasi MySQL selesai</span>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-emerald-500 mx-auto animate-bounce" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Pilih File CSV Master Sekolah</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Maksimal ukuran 5MB (.csv)</span>
                  </div>
                </>
              )}
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={isImportingProcessing}
                onChange={handleImportSchoolsCSV}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      )}

      {isAddingSchool && (
        <form onSubmit={handleCreateOrUpdateSchool} className="bg-white border-2 border-teal-500 p-6 rounded-2xl shadow-md space-y-4 animate-slideDown text-slate-800">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
              <Building className="w-4 h-4 text-teal-600" />
              {isSchoolAdmin 
                ? "Sesuaikan Detail Kepala Sekolah & Kop Unit Kerja" 
                : (editingSchool ? "Hubungkan Ulang / Edit Sekolah Master" : "Daftarkan Instansi Sekolah Baru")
              }
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsAddingSchool(false);
                setEditingSchool(null);
                setErrorMsg("");
              }}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              Batal
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-550 mb-1">
                NOMOR NPSN SEKOLAH (8 DIGIT)* {isSchoolAdmin && <span className="text-rose-500">(Kunci Admin)</span>}
              </label>
              <input
                type="text"
                maxLength={12}
                placeholder="Contoh: 20219182"
                disabled={editingSchool !== null || isSchoolAdmin}
                value={form.npsn}
                onChange={(e) => setForm({ ...form, npsn: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500 disabled:bg-slate-100 disabled:text-slate-500 font-mono text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-550 mb-1">
                NAMA LENGKAP SEKOLAH* {isSchoolAdmin && <span className="text-rose-500">(Kunci Admin)</span>}
              </label>
              <input
                type="text"
                placeholder="Contoh: SMAN 1 BANDUNG"
                disabled={isSchoolAdmin}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500 uppercase text-slate-850 disabled:bg-slate-100 disabled:text-slate-500 font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-550 mb-1">NAMA KEPALA SEKOLAH PENILAI</label>
              <input
                type="text"
                placeholder="Contoh: Dr. H. Dadang, M.Pd."
                value={form.principalName}
                onChange={(e) => setForm({ ...form, principalName: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-550 mb-1">STATUS JABATAN KEPALA SEKOLAH</label>
              <select
                value={form.principalStatus || "definitif"}
                onChange={(e) => setForm({ ...form, principalStatus: e.target.value as "definitif" | "plt" | "plh" })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500 font-bold text-slate-700 bg-white"
              >
                <option value="definitif">DEFINITIF (Biasa)</option>
                <option value="plt">PLT (Pelaksana Tugas)</option>
                <option value="plh">PLH (Pelaksana Harian)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-550 mb-1">NIP KEPALA SEKOLAH</label>
              <input
                type="text"
                placeholder="Contoh: 197412121998011001"
                value={form.principalNip}
                onChange={(e) => setForm({ ...form, principalNip: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500 font-mono text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-550 mb-1">KOTA / KABUPATEN</label>
              <input
                type="text"
                placeholder="Contoh: KOTA BANDUNG"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500 uppercase text-slate-800"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-550 mb-1">ALAMAT LENGKAP SEKOLAH</label>
              <input
                type="text"
                placeholder="Contoh: Jl. Dr. Radjiman No. 6"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500 text-slate-800"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-150 text-rose-700 text-xs font-semibold rounded-lg">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsAddingSchool(false);
                setEditingSchool(null);
                setErrorMsg("");
              }}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
            >
              BATAL
            </button>
            <button
              type="submit"
              className="py-2.5 px-5 bg-teal-600 hover:bg-teal-550 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs animate-pulse"
            >
              {editingSchool ? "SIMPAN PERUBAHAN DATA ➔" : "DAFTARKAN MASTER ➔"}
            </button>
          </div>
        </form>
      )}

      {/* Search & View Toggle Panel */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari nama sekolah, NPSN, atau alamat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-teal-500 focus:bg-white text-slate-800 font-bold"
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-teal-500 focus:bg-white text-slate-800 font-bold"
            >
              <option value="">Semua Kabupaten / Kota ({uniqueCities.length})</option>
              {uniqueCities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider hidden lg:inline">
            TAMPILAN:
          </span>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Kartu / Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>GRID / KARTU</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Tabel / List"
            >
              <List className="w-3.5 h-3.5" />
              <span>TABEL / LIST</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-400 uppercase font-black text-[9px] border-b border-slate-100 select-none">
                  <th className="p-4">NPSN</th>
                  <th className="p-4">Nama Sekolah</th>
                  <th className="p-4">Alamat & Kota</th>
                  <th className="p-4">Kepala Sekolah Penilai</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Opsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredSchools.map((school) => {
                  const matchedSchoolName = userSchool ? userSchool.toUpperCase().trim() : "";
                  const isThisSchoolUser = isSchoolAdmin && school.name.toUpperCase().trim() === matchedSchoolName;
                  const canUserEdit = userRole === "super_admin" || userRole === "admin" || isThisSchoolUser;

                  return (
                    <tr key={school.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-mono font-bold text-teal-700">
                        {school.npsn}
                      </td>
                      <td className="p-4 font-bold text-slate-900 uppercase">
                        <div className="flex items-center gap-1.5">
                          <span>{school.name}</span>
                          {isThisSchoolUser && (
                            <span className="bg-teal-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase font-sans animate-pulse">
                              SAYA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">
                        {school.address || "-"}
                        {school.city && <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">{school.city}</div>}
                      </td>
                      <td className="p-4 text-slate-700">
                        <div className="font-bold">
                          {school.principalName
                            ? `${
                                school.principalStatus === "plt"
                                  ? "Plt. "
                                  : school.principalStatus === "plh"
                                  ? "Plh. "
                                  : ""
                              }${school.principalName}`
                            : "-"}
                        </div>
                        {school.principalNip && <div className="text-[10px] text-slate-400 font-mono">NIP: {school.principalNip}</div>}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          school.principalStatus === "plt" || school.principalStatus === "plh"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-teal-50 text-teal-800 border border-teal-200"
                        }`}>
                          {school.principalStatus || "definitif"}
                        </span>
                      </td>
                      <td className="p-4 text-right select-none">
                        {canUserEdit && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(school)}
                              className="p-1.5 rounded transition-colors text-slate-500 hover:bg-teal-50 hover:text-teal-600 cursor-pointer"
                              title="Sesuaikan Data Sekolah"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {(userRole === "super_admin" || userRole === "admin") && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSchool(school)}
                                className="p-1.5 rounded transition-colors text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                title="Hapus Data Sekolah"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredSchools.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic font-medium">
                      Sekolah tidak ditemukan...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid of schools list */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSchools.map((school) => {
          const matchedSchoolName = userSchool ? userSchool.toUpperCase().trim() : "";
          const isThisSchoolUser = isSchoolAdmin && school.name.toUpperCase().trim() === matchedSchoolName;
          const canUserEdit = userRole === "super_admin" || userRole === "admin" || isThisSchoolUser;

          return (
            <div
              key={school.id}
              className={`bg-white rounded-xl border p-5 space-y-3 hover:shadow-xs transition-all relative flex flex-col justify-between ${
                isThisSchoolUser ? "border-teal-500 ring-2 ring-teal-50" : "border-slate-205 hover:border-teal-500"
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex justify-between items-start gap-1">
                  <span className="bg-teal-50 border border-teal-100 text-teal-800 text-[9px] font-black uppercase px-2 py-0.5 rounded font-mono">
                    NPSN: {school.npsn}
                  </span>

                  {canUserEdit && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(school)}
                        className="text-slate-500 hover:text-teal-600 border border-slate-200 hover:border-teal-300 rounded px-2 py-1 text-[10px] font-bold flex items-center gap-1 transition-colors bg-white hover:bg-teal-50 cursor-pointer"
                        title="Sesuaikan Data Sekolah"
                      >
                        <Edit className="w-3 h-3 text-teal-650" />
                        {isThisSchoolUser ? "SESUAIKAN DATA" : "EDIT"}
                      </button>
                      {(userRole === "super_admin" || userRole === "admin") && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSchool(school)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                          title="Hapus Data Sekolah"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="font-extrabold text-xs text-slate-900 tracking-tight uppercase flex items-center gap-1.5 animate-fadeIn">
                    <span>{school.name}</span>
                    {isThisSchoolUser && (
                      <span className="bg-teal-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase font-sans animate-pulse">
                        SAYA
                      </span>
                    )}
                  </h4>
                  {school.address && (
                    <p className="text-[11px] text-slate-500 flex items-start gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                      <span>{school.address}{school.city ? `, ${school.city}` : ""}</span>
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-105 space-y-1 text-[11px] text-slate-650">
                  <p className="font-bold text-slate-600 border-b border-dashed border-slate-205 pb-1 mb-1 uppercase tracking-tight flex justify-between items-center">
                    <span>Kepala Sekolah Penilai Penandatangan</span>
                    {school.principalStatus && school.principalStatus !== "definitif" && (
                      <span className="bg-amber-100 text-amber-805 border border-amber-200 text-[8px] font-black uppercase px-1 py-0.5 rounded">
                        {school.principalStatus}
                      </span>
                    )}
                  </p>
                  <p>
                    <strong>Nama:</strong>{" "}
                    {school.principalName
                      ? `${
                          school.principalStatus === "plt"
                            ? "Plt. "
                            : school.principalStatus === "plh"
                            ? "Plh. "
                            : ""
                        }${school.principalName}`
                      : "-"}
                  </p>
                  <p><strong>NIP:</strong> {school.principalNip || "-"}</p>
                </div>
              </div>
            </div>
          );
        })}
        {filteredSchools.length === 0 && !loading && (
          <div className="col-span-full bg-white p-10 border border-slate-200 rounded-xl text-center space-y-2 max-w-sm mx-auto">
            <Building className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-xs font-black text-slate-850 uppercase">Sekolah Tidak Ditemukan</h4>
            <p className="text-[11px] text-slate-500">Pencarian untuk "{searchQuery}" tidak menemukan kecocokan.</p>
          </div>
        )}
      </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fadeIn text-slate-100">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-100 uppercase tracking-tight">Hapus Data Sekolah Master</h3>
              <p className="text-xs text-slate-400">
                Apakah Anda yakin ingin menghapus data sekolah <strong className="text-white">"{pendingDelete.name}" (NPSN: {pendingDelete.npsn})</strong>?
                Data ini akan dilepaskan sepenuhnya.
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
                onClick={executeDeleteSchool}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl border border-rose-500 cursor-pointer transition-colors"
              >
                YA, HAPUS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
