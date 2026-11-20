import React, { useState, useEffect, useMemo } from "react";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Calculator, 
  BookOpen, 
  Printer, 
  RefreshCw, 
  FileText, 
  Clock,
  User,
  Search,
  Plus,
  Trash2,
  LogOut,
  Sparkles,
  Award,
  AlertCircle,
  GraduationCap,
  Settings,
  Users,
  School,
  Building,
  Upload,
  Download,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Terminal,
  Database,
  Camera,
  Sliders,
  Sun,
  Moon,
  Maximize,
  Minimize
} from "lucide-react";
import { TeacherProfile, SKPEvaluation, GolonganID, KopSettings, JabatanFungsionalType } from "./types";
import { GOLONGAN_LIST, getTeacherLevel, GOLONGAN_BASE_VALS, getMinimalPangkat, getMinimalJenjang } from "./data/golonganData";
import DashboardTab from "./components/DashboardTab";
import ActivityLogTab from "./components/ActivityLogTab";
import CalculatorTab from "./components/CalculatorTab";
import RegulationsTab from "./components/RegulationsTab";
import OfficialPAKReport from "./components/OfficialPAKReport";
import KopAdminTab from "./components/KopAdminTab";
import UserManagementTab from "./components/UserManagementTab";
import SchoolManagementTab from "./components/SchoolManagementTab";
import SearchableSchoolSelect from "./components/SearchableSchoolSelect";
import LoggingManagementTab from "./components/LoggingManagementTab";
import XamppModal from "./components/XamppModal";
import { toast, swal } from "./lib/toast";
import { checkAndMigrateLegacyLocalStorage } from "./lib/backupService";
import { 
  saveTeacherToMysql, 
  saveTeacherToMysqlDetailed,
  deleteTeacherFromMysql, 
  saveEvaluationToMysql, 
  deleteEvaluationFromMysql, 
  saveKopToMysql, 
  fetchKopFromMysql,
  fetchTeachersFromMysql,
  fetchEvaluationsFromMysql,
  fetchSchoolsFromMysql,
  loginWithMysql
} from "./lib/mysqlSync";
import { parseAKNumber, roundAK, sumAK, subtractAK, isAKGreaterOrEqual } from "./lib/akUtils";

// Helper to safely parse decimal values in Indonesian/International format (comma, dot, thousands)
export const parseFloatValue = (val: any): number => {
  return parseAKNumber(val);
};


export interface AppUser {
  username: string;
  password?: string;
  role: 'super_admin' | 'school_admin';
  school: string;
  displayName: string;
}

const DEFAULT_EVALUATIONS: Omit<SKPEvaluation, 'id'>[] = [
  {
    year: 2023,
    period: "September s.d Desember",
    rating: "Baik",
    level: "Ahli Muda",
    coefficient: 25,
    multiplier: 1.0,
    creditEarned: 8.333,
    notes: "September s.d Desember",
    startDate: "2023-09-01",
    endDate: "2023-12-31",
    isCustomRange: true,
    customMonths: 4
  },
  {
    year: 2024,
    period: "Tahunan",
    rating: "Baik",
    level: "Ahli Muda",
    coefficient: 25,
    multiplier: 1.0,
    creditEarned: 25.0,
    notes: "Januari s.d Desember",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    isCustomRange: false,
    customMonths: 12
  },
  {
    year: 2025,
    period: "Tahunan",
    rating: "Baik",
    level: "Ahli Muda",
    coefficient: 25,
    multiplier: 1.0,
    creditEarned: 25.0,
    notes: "Januari s.d Desember",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    isCustomRange: false,
    customMonths: 12
  }
];

const DEFAULT_APP_LOGO = "https://upload.wikimedia.org/wikipedia/commons/9/99/Coat_of_arms_of_West_Java.svg";

export default function App() {
  // Authentication states (custom database sessions)
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem("sipak_current_user");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(false);
  
  // Login input states
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLogining, setIsLogining] = useState(false);

  // Multi-teacher registry states
  const [teachers, setTeachers] = useState<(TeacherProfile & { id: string, evaluationsCount?: number })[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);

  // Form states for new teacher
  const [newTeacherForm, setNewTeacherForm] = useState({
    name: "",
    nip: "",
    jabatanFungsional: "Guru" as JabatanFungsionalType,
    school: "",
    currentGolongan: "III/c" as GolonganID,
    targetGolongan: "III/d" as GolonganID,
    baseAK: 200,
    akIntegrasi2022: 25,
    akPendidikan: 0,
    karpegNumber: "",
    gender: "Laki-Laki" as "Laki-Laki" | "Perempuan"
  });

  const [isImporting, setIsImporting] = useState(false);
  const [isImportingProcessing, setIsImportingProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [teacherEvalsCache, setTeacherEvalsCache] = useState<Record<string, number>>({});
  const [teacherPendCache, setTeacherPendCache] = useState<Record<string, number>>({});

  // Layout View Mode & Pagination states (especially for admin/super_admin view toggling)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Filters and Sorting states for teacher database
  const [filterSchool, setFilterSchool] = useState<string>("");
  const [filterJabatan, setFilterJabatan] = useState<string>("");
  const [filterGolongan, setFilterGolongan] = useState<string>("");
  const [filterEligibility, setFilterEligibility] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("name_asc");

  // Selected teacher states
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [evaluations, setEvaluations] = useState<SKPEvaluation[]>([]);
  const [selectedEvalIdForPrint, setSelectedEvalIdForPrint] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<"dashboard" | "activities" | "calculator" | "regulations" | "pak_report" | "kop_admin" | "user_management">("dashboard");
  const [adminView, setAdminView] = useState<"teachers" | "users" | "kop" | "calculator" | "regulations" | "schools" | "logs">("teachers");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [schoolsList, setSchoolsList] = useState<{ id: string, name: string, npsn: string, principalName?: string, principalNip?: string, principalStatus?: 'definitif' | 'plt' | 'plh' }[]>([]);

  // Custom confirmation dialog states
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<{ id: string, name: string } | null>(null);
  const [xamppModalOpen, setXamppModalOpen] = useState(false);
  const [dbErrorWarning, setDbErrorWarning] = useState<string | null>(null);

  // Elegant Toast notifications state
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }[]>([]);
  // SweetAlert modal state
  const [activeSwal, setActiveSwal] = useState<{ id: string; title: string; text: string; icon: 'success' | 'error' | 'info' | 'warning'; confirmButtonText?: string } | null>(null);

  // Listen to sipak_toast events
  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: 'success' | 'error' | 'info' | 'warning' }>;
      const { message, type } = customEvent.detail;
      const id = Math.random().toString(36).substring(2, 9);
      
      setToasts(prev => [...prev, { id, message, type }]);

      // Auto remove after 4 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    };

    const handleSwalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ title: string; text: string; icon: 'success' | 'error' | 'info' | 'warning'; confirmButtonText?: string }>;
      const { title, text, icon, confirmButtonText } = customEvent.detail;
      setActiveSwal({
        id: Math.random().toString(36).substring(2, 9),
        title,
        text,
        icon,
        confirmButtonText: confirmButtonText || "OK, Selesai"
      });
    };

    window.addEventListener('sipak_toast', handleToastEvent);
    window.addEventListener('sipak_swal', handleSwalEvent);

    // Global Error and Promise Rejection logging
    const handleGlobalError = (event: ErrorEvent) => {
      if (event.message?.includes('websocket') || event.message?.includes('HMR')) return;
      import('./lib/logger').then(({ logEvent }) => {
        logEvent(`Runtime Error: ${event.message} at ${event.filename}:${event.lineno}`, 'error').catch(() => {});
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const errorMsg = reason instanceof Error ? reason.message : String(reason);
      if (errorMsg.includes('websocket') || errorMsg.includes('HMR')) return;
      import('./lib/logger').then(({ logEvent }) => {
        logEvent(`Unhandled Promise Rejection: ${errorMsg}`, 'error').catch(() => {});
      });
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('sipak_toast', handleToastEvent);
      window.removeEventListener('sipak_swal', handleSwalEvent);
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Admin Kop & Logo settings
  const [appLogo, setAppLogo] = useState<string>(() => {
    return localStorage.getItem('simpak_app_logo') || DEFAULT_APP_LOGO;
  });
  const [loginLogoHeight, setLoginLogoHeight] = useState<number>(() => {
    const saved = localStorage.getItem('simpak_login_logo_height');
    return saved ? Number(saved) : 120; // Default 120px
  });
  const [sidebarLogoHeight, setSidebarLogoHeight] = useState<number>(() => {
    const saved = localStorage.getItem('simpak_sidebar_logo_height');
    return saved ? Number(saved) : 64; // Default 64px
  });

  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [customLogoUrlInput, setCustomLogoUrlInput] = useState('');
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [tempLoginLogoHeight, setTempLoginLogoHeight] = useState<number>(loginLogoHeight);
  const [tempSidebarLogoHeight, setTempSidebarLogoHeight] = useState<number>(sidebarLogoHeight);

  // Dynamically sync browser Favicon with active appLogo
  useEffect(() => {
    try {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = appLogo || DEFAULT_APP_LOGO;
    } catch (e) {
      console.warn("Gagal memperbarui favicon browser:", e);
    }
  }, [appLogo]);

  // Theme (Dark / Light) Mode state & toggle
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("sikapita_theme");
    if (saved === "light" || saved === "dark") return saved;
    return "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("sikapita_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  // Fullscreen state & toggle
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(active);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle error:", err);
    }
  };

  const [kopSettings, setKopSettings] = useState<KopSettings>(() => {
    const saved = localStorage.getItem('sipak_kop_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      logoType: 'svg-jabar' as 'svg-jabar' | 'url',
      customLogoUrl: '',
      row1: 'PEMERINTAH DAERAH PROVINSI JAWA BARAT',
      row2: 'DINAS PENDIDIKAN',
      row3: 'Jalan. Dr. Radjiman No. 6 Telp (022) 4264813 Fax. (022) 4264881',
      row4: 'Website : disdik.jabarprov.go.id',
      row5: 'e-mail: disdik@jabar.prov.go.id / sekretariatdisdikjabar@gmail.com',
      row6: 'BANDUNG - 40171',
      tteLogoType: 'default',
      tteLogoUrl: '',
      tteLogoBase64: '',
      tteTextHeader: 'Ditandatangani secara elektronik oleh :',
      loginLogoHeight: 120,
      sidebarLogoHeight: 64
    };
  });

  // Load session & configuration on Mount
  useEffect(() => {
    // Auto-check and clean legacy cache
    checkAndMigrateLegacyLocalStorage().catch(() => {});
    setAuthLoading(false);

    // Initial load of Kop & Logo from MySQL
    fetchKopFromMysql().then(data => {
      if (data) {
        setKopSettings(prev => ({ ...prev, ...data }));
        if (data.appLogoUrl) {
          setAppLogo(data.appLogoUrl);
          localStorage.setItem('simpak_app_logo', data.appLogoUrl);
        }
        if (data.loginLogoHeight) {
          setLoginLogoHeight(Number(data.loginLogoHeight));
          localStorage.setItem('simpak_login_logo_height', String(data.loginLogoHeight));
        }
        if (data.sidebarLogoHeight) {
          setSidebarLogoHeight(Number(data.sidebarLogoHeight));
          localStorage.setItem('simpak_sidebar_logo_height', String(data.sidebarLogoHeight));
        }
      }
    }).catch(() => {});
  }, []);

  // Load settings from MySQL on Login
  useEffect(() => {
    if (!user) return;
    fetchKopFromMysql().then(data => {
      if (data) {
        setKopSettings(prev => ({ ...prev, ...data }));
        if (data.appLogoUrl) {
          setAppLogo(data.appLogoUrl);
          localStorage.setItem('simpak_app_logo', data.appLogoUrl);
        }
        if (data.loginLogoHeight) {
          setLoginLogoHeight(Number(data.loginLogoHeight));
          localStorage.setItem('simpak_login_logo_height', String(data.loginLogoHeight));
        }
        if (data.sidebarLogoHeight) {
          setSidebarLogoHeight(Number(data.sidebarLogoHeight));
          localStorage.setItem('simpak_sidebar_logo_height', String(data.sidebarLogoHeight));
        }
      }
    }).catch(err => {
      console.warn("Gagal memuat KOP dari MySQL:", err);
    });
  }, [user]);

  // Handler to save and persist app logo and sizes
  const handleSaveAppLogo = async (newLogoUrl?: string, newLoginH?: number, newSidebarH?: number) => {
    const finalLogo = newLogoUrl !== undefined ? newLogoUrl : (logoPreviewUrl || appLogo);
    const finalLoginH = newLoginH !== undefined ? newLoginH : tempLoginLogoHeight;
    const finalSidebarH = newSidebarH !== undefined ? newSidebarH : tempSidebarLogoHeight;

    setAppLogo(finalLogo);
    setLoginLogoHeight(finalLoginH);
    setSidebarLogoHeight(finalSidebarH);

    localStorage.setItem('simpak_app_logo', finalLogo);
    localStorage.setItem('simpak_login_logo_height', String(finalLoginH));
    localStorage.setItem('simpak_sidebar_logo_height', String(finalSidebarH));

    setLogoPreviewUrl(null);
    setLogoModalOpen(false);

    const updatedKop: KopSettings = {
      ...kopSettings,
      appLogoUrl: finalLogo,
      loginLogoHeight: finalLoginH,
      sidebarLogoHeight: finalSidebarH
    };
    setKopSettings(updatedKop);

    try {
      await saveKopToMysql(updatedKop);
    } catch (err) {
      console.warn("Gagal mencadangkan logo ke MySQL:", err);
    }

    toast.success("Logo dan ukuran tampilan berhasil disimpan! Perubahan langsung aktif di Login dan Dashboard.");
  };

  const handleResetAppLogo = () => {
    setTempLoginLogoHeight(120);
    setTempSidebarLogoHeight(64);
    handleSaveAppLogo(DEFAULT_APP_LOGO, 120, 64);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploadError(null);

    if (!file.type.match(/^image\/(png|jpeg|jpg|webp|svg\+xml)$/)) {
      setLogoUploadError("File harus berupa format gambar (PNG, JPG, WebP, atau SVG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (file.type.includes('svg')) {
        setLogoPreviewUrl(result);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 600;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/png');
          setLogoPreviewUrl(compressed);
        } else {
          setLogoPreviewUrl(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // Save settings to MySQL and LocalStorage
  useEffect(() => {
    localStorage.setItem('sipak_kop_settings', JSON.stringify(kopSettings));
    if (!user) return;

    const timer = setTimeout(() => {
      saveKopToMysql(kopSettings).catch(err => {
        console.warn("Gagal mencadangkan KOP ke MySQL:", err);
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [kopSettings, user]);

  // Load schools list from MySQL
  const loadSchools = async () => {
    try {
      const list = await fetchSchoolsFromMysql();
      if (list && Array.isArray(list)) {
        const sorted = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setSchoolsList(sorted);
      }
    } catch (err) {
      console.warn("Gagal memuat list sekolah master:", err);
    }
  };

  useEffect(() => {
    loadSchools();
  }, [user]);

  // Load teachers list from MySQL
  const loadTeachers = async () => {
    if (!user) {
      setTeachers([]);
      setLoadingTeachers(false);
      return;
    }

    setLoadingTeachers(true);
    try {
      // Check database health and status
      fetch('/api/db-status')
        .then(res => res.json())
        .then(st => {
          if (st && st.connected === false) {
            setDbErrorWarning(st.message || 'Koneksi database MySQL gagal.');
          } else {
            setDbErrorWarning(null);
          }
        })
        .catch(() => {});

      const list = await fetchTeachersFromMysql();
      if (list && Array.isArray(list)) {
        const userSchool = (user.school || "").trim().toUpperCase();
        const filtered = user.role === 'school_admin'
          ? list.filter((item: any) => (item.school || "").trim().toUpperCase() === userSchool)
          : list;

        const mapped = filtered.map((data: any) => ({
          id: data.id,
          name: data.name || "",
          nip: data.nip || "",
          jabatanFungsional: (data.jabatanFungsional === 'Pengawas Sekolah' ? 'Pengawas Sekolah' : 'Guru') as JabatanFungsionalType,
          school: data.school || "",
          currentGolongan: data.currentGolongan || "III/c",
          targetGolongan: data.targetGolongan || "III/d",
          baseAK: roundAK(parseFloatValue(data.baseAK)),
          akIntegrasi2022: roundAK(parseFloatValue(data.akIntegrasi2022)),
          akPendidikan: roundAK(parseFloatValue(data.akPendidikan)),
          ratingSKP: data.ratingSKP || "Baik",
          workDurationYears: parseFloatValue(data.workDurationYears) || 1,
          karpegNumber: data.karpegNumber || "",
          birthPlaceDate: data.birthPlaceDate || "",
          gender: data.gender || "Laki-Laki",
          tmtCurrentPangkat: data.tmtCurrentPangkat || "",
          tmtCurrentJabatan: data.tmtCurrentJabatan || "",
          unitKerja: data.unitKerja || "",
          instansiBiro: data.instansiBiro || "PEMERINTAH PROVINSI JAWA BARAT",
          nomorSuratKonversi: data.nomorSuratKonversi || "",
          nomorSuratAkumulasi: data.nomorSuratAkumulasi || "",
          nomorSuratPenetapan: data.nomorSuratPenetapan || "",
          tempatDitetapkan: data.tempatDitetapkan || "Bandung",
          tanggalPenetapan: data.tanggalPenetapan || "",
          pejabatPenilaiTitle: data.pejabatPenilaiTitle || "",
          pejabatPenilaiInstansi: data.pejabatPenilaiInstansi || "PROVINSI JAWA BARAT",
          pejabatPenilaiNama: data.pejabatPenilaiNama || "",
          pejabatPenilaiNip: data.pejabatPenilaiNip || "",
          pejabatPenilaiGolongan: data.pejabatPenilaiGolongan || "",
          pejabatPenilaiStatus: data.pejabatPenilaiStatus || "definitif",
          skPangkatFileLink: data.skPangkatFileLink || "",
          pakIntegrasiFileLink: data.pakIntegrasiFileLink || "",
          ijazahFileLink: data.ijazahFileLink || "",
          additionalFileLink: data.additionalFileLink || ""
        }));
        setTeachers(mapped);
      }
    } catch (err) {
      console.warn("Gagal memuat list guru dari MySQL:", err);
    } finally {
      setLoadingTeachers(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, [user]);

  // Load evaluations for active selected teacher from MySQL
  const loadEvaluations = async (teacherId: string) => {
    try {
      const rows = await fetchEvaluationsFromMysql(teacherId);
      if (rows && Array.isArray(rows)) {
        const evalsList: SKPEvaluation[] = rows.map((evalData: any) => ({
          id: evalData.id,
          year: Number(evalData.year) || new Date().getFullYear(),
          period: evalData.period || "Tahunan",
          rating: evalData.rating || "Baik",
          level: evalData.level || "Ahli Muda",
          coefficient: roundAK(parseFloatValue(evalData.coefficient)),
          multiplier: Number(parseFloatValue(evalData.multiplier).toFixed(2)),
          creditEarned: roundAK(parseFloatValue(evalData.creditEarned)),
          akPendidikan: roundAK(parseFloatValue(evalData.akPendidikan)),
          notes: evalData.notes || "",
          startDate: evalData.startDate || "",
          endDate: evalData.endDate || "",
          isCustomRange: Boolean(evalData.isCustomRange),
          customMonths: Number(evalData.customMonths) || 12,
          skpFileLink: evalData.skpFileLink || "",
          evidenceFileLink: evalData.evidenceFileLink || "",
          overrideData: evalData.overrideData || undefined
        }));
        evalsList.sort((a, b) => (b.year - a.year) || b.period.localeCompare(a.period));
        setEvaluations(evalsList);

        const totalAK = sumAK(...evalsList.map(item => item.creditEarned || 0));
        const totalPend = sumAK(...evalsList.map(item => item.akPendidikan || 0));
        setTeacherEvalsCache(prev => ({ ...prev, [teacherId]: totalAK }));
        setTeacherPendCache(prev => ({ ...prev, [teacherId]: totalPend }));
      }
    } catch (err) {
      console.warn("Gagal memuat evaluasi dari MySQL:", err);
    }
  };

  useEffect(() => {
    if (!selectedTeacherId) {
      setEvaluations([]);
      return;
    }
    loadEvaluations(selectedTeacherId);
  }, [selectedTeacherId]);

  // Load evaluations sum cache in list/dashboard fungsional view
  const teachersIdsKey = teachers.map(t => t.id).join(",");
  useEffect(() => {
    if (teachers.length === 0) return;
    
    teachers.forEach(t => {
      if (!t.id) return;
      fetchEvaluationsFromMysql(t.id).then(rows => {
        if (rows && Array.isArray(rows)) {
          const totalAK = sumAK(...rows.map((val: any) => parseFloatValue(val.creditEarned)));
          const totalPend = sumAK(...rows.map((val: any) => parseFloatValue(val.akPendidikan)));
          setTeacherEvalsCache(prev => ({ ...prev, [t.id]: totalAK }));
          setTeacherPendCache(prev => ({ ...prev, [t.id]: totalPend }));
        }
      }).catch(() => {});
    });
  }, [teachersIdsKey]);

  // Reset pagination page when search or itemsPerPage or filters are modified
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage, filterSchool, filterJabatan, filterGolongan, filterEligibility, sortBy]);

  // Handle User login (Username / Password Verification with local fallback)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLogining(true);

    const uName = loginUsername.trim().toLowerCase();
    const pWord = loginPassword.trim();

    if (!uName || !pWord) {
      setLoginError("Harap isi seluruh kolom login!");
      setIsLogining(false);
      return;
    }

    // Modern local hardcoded fallback profiles (provides instant offline testing in VSCODE)
    const defaultAccounts = [
      {
        username: "admin",
        password: "adminpaskonversi",
        school: "ALL",
        role: "super_admin" as const,
        displayName: "Super Admin Dinas Pendidikan"
      },
      {
        username: "sman2ciamis",
        password: "sman2ciamis123",
        school: "SMAN 2 CIAMIS",
        role: "school_admin" as const,
        displayName: "Admin SMAN 2 Ciamis"
      },
      {
        username: "sman1ciamis",
        password: "sman1ciamis123",
        school: "SMAN 1 CIAMIS",
        role: "school_admin" as const,
        displayName: "Admin SMAN 1 Ciamis"
      }
    ];

    try {
      // 1. Authenticate with MySQL backend
      const res = await loginWithMysql(uName, pWord);
      let sessionUser: AppUser | null = null;

      if (res.success && res.user) {
        sessionUser = {
          username: res.user.username,
          displayName: res.user.displayName || res.user.username,
          role: res.user.role || "school_admin",
          school: res.user.school || ""
        };
      } else if (res.error === "Kombinasi password yang dimasukkan salah!") {
        setLoginError(res.error);
        setIsLogining(false);
        return;
      } else {
        // 2. Offline Fallback Check (if offline or database still starting)
        const matchedLocal = defaultAccounts.find(acc => acc.username === uName && acc.password === pWord);
        if (matchedLocal) {
          sessionUser = {
            username: matchedLocal.username,
            displayName: matchedLocal.displayName,
            role: matchedLocal.role,
            school: matchedLocal.school
          };
        }
      }

      // 3. Final authentication verdict
      if (sessionUser) {
        setUser(sessionUser);
        localStorage.setItem("sipak_current_user", JSON.stringify(sessionUser));
        setActiveTab("dashboard");
        setLoginUsername("");
        setLoginPassword("");
        swal.fire({
          title: "Login Berhasil!",
          text: `Selamat datang kembali, ${sessionUser.displayName}! Anda berhasil masuk sebagai ${sessionUser.role === 'super_admin' ? 'Super Admin KCD XIII' : 'Admin Unit Kerja'}.`,
          icon: "success",
          confirmButtonText: "Masuk ke Dashboard"
        });
      } else {
        if (!loginError) {
          const errText = res.error || "Akun Pengguna tidak ditemukan! Hubungi Super Admin KCD XIII Dinas Pendidikan.";
          setLoginError(errText);
          swal.fire({
            title: "Gagal Masuk!",
            text: errText,
            icon: "error",
            confirmButtonText: "Coba Lagi"
          });
        }
      }
    } catch (err) {
      console.error(err);
      const errText = "Terjadi kesalahan sistem saat menghubungi database MySQL!";
      setLoginError(errText);
      swal.fire({
        title: "Kesalahan Sistem!",
        text: errText,
        icon: "error"
      });
    } finally {
      setIsLogining(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    setLogoutConfirmOpen(true);
  };

  // Actual Logout Action (bypasses window.confirm sandbox issues)
  const executeLogout = () => {
    const oldName = user?.displayName || "Pengguna";
    setUser(null);
    setSelectedTeacherId(null);
    setProfile(null);
    setEvaluations([]);
    setAdminView("teachers");
    localStorage.removeItem("sipak_current_user");
    localStorage.removeItem("sipak_kop_settings");
    setKopSettings({
      logoType: 'svg-jabar',
      customLogoUrl: '',
      row1: 'PEMERINTAH DAERAH PROVINSI JAWA BARAT',
      row2: 'DINAS PENDIDIKAN',
      row3: 'Jalan. Dr. Radjiman No. 6 Telp (022) 4264813 Fax. (022) 4264881',
      row4: 'Website : disdik.jabarprov.go.id',
      row5: 'e-mail: disdik@jabar.prov.go.id / sekretariatdisdikjabar@gmail.com',
      row6: 'BANDUNG - 40171'
    });
    setLogoutConfirmOpen(false);
    swal.fire({
      title: "Keluar Berhasil!",
      text: `Sampai jumpa kembali, ${oldName}! Anda telah berhasil keluar dari Si-KAPITA dengan aman.`,
      icon: "info",
      confirmButtonText: "Kembali ke Beranda"
    });
  };

  // Add new teacher profile to database
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newTeacherForm.name || !newTeacherForm.nip) {
      toast.warning("Harap lengkapi Nama Lengkap dan NIP Pegawai PNS!");
      return;
    }

    const isPengawas = newTeacherForm.jabatanFungsional === 'Pengawas Sekolah';
    const rawAssignedSchool = user.role === 'school_admin'
      ? user.school
      : (newTeacherForm.school.trim() || (isPengawas ? "CABANG DINAS PENDIDIKAN WILAYAH XIII" : ""));
    const assignedSchoolUpper = rawAssignedSchool.toUpperCase().trim();

    // Fast-lookup principal details from schoolsList master data
    const matchedSchool = schoolsList.find(s => s.name.toUpperCase().trim() === assignedSchoolUpper);
    const principalName = matchedSchool?.principalName || "";
    const principalNip = matchedSchool?.principalNip || "";

    try {
      const teacherId = `teacher_${Date.now()}`;
      const data = {
        id: teacherId,
        name: newTeacherForm.name.toUpperCase().trim(),
        nip: newTeacherForm.nip.replace(/\s+/g, ""),
        jabatanFungsional: newTeacherForm.jabatanFungsional,
        school: assignedSchoolUpper,
        currentGolongan: newTeacherForm.currentGolongan,
        targetGolongan: newTeacherForm.targetGolongan,
        baseAK: roundAK(parseFloatValue(newTeacherForm.baseAK)),
        akIntegrasi2022: roundAK(parseFloatValue(newTeacherForm.akIntegrasi2022)),
        akPendidikan: 0,
        ratingSKP: "Baik" as const,
        workDurationYears: 3,
        karpegNumber: newTeacherForm.karpegNumber.toUpperCase().trim(),
        gender: newTeacherForm.gender,
        birthPlaceDate: "",
        tmtCurrentPangkat: "",
        tmtCurrentJabatan: "",
        unitKerja: matchedSchool
          ? `${assignedSchoolUpper} KABUPATEN CIAMIS CABANG PENDIDIKAN WILAYAH XIII`
          : assignedSchoolUpper || "CABANG DINAS PENDIDIKAN WILAYAH XIII",
        instansiBiro: "PEMERINTAH PROVINSI JAWA BARAT",
        nomorSuratKonversi: "",
        nomorSuratAkumulasi: "",
        nomorSuratPenetapan: "",
        tempatDitetapkan: "Bandung",
        tanggalPenetapan: "",
        pejabatPenilaiTitle: matchedSchool ? "KEPALA SEKOLAH" : "KEPALA CABANG DINAS PENDIDIKAN WILAYAH XIII",
        pejabatPenilaiInstansi: matchedSchool ? assignedSchoolUpper : "PROVINSI JAWA BARAT",
        pejabatPenilaiNama: principalName,
        pejabatPenilaiNip: principalNip,
        pejabatPenilaiGolongan: "",
        pejabatPenilaiStatus: matchedSchool?.principalStatus || "definitif",
        createdBy: user.username
      };

      const saveRes = await saveTeacherToMysqlDetailed(data);
      if (!saveRes.ok) {
        throw new Error(saveRes.error || "Gagal menyimpan data pegawai ke server database.");
      }

      setTeachers(prev => [data, ...prev.filter(t => t.id !== teacherId)]);

      swal.fire({
        title: "Pendaftaran Sukses!",
        text: `${newTeacherForm.jabatanFungsional} PNS "${newTeacherForm.name.toUpperCase().trim()}" berhasil disimpan ke database. Silakan lengkapi angka kredit atau berkas penilaian SKP sekarang!`,
        icon: "success",
        confirmButtonText: "Mulai Lengkapi Data"
      });
      setIsAddingTeacher(false);
      // Reset form
      setNewTeacherForm({
        name: "",
        nip: "",
        jabatanFungsional: "Guru",
        school: "",
        currentGolongan: "III/c",
        targetGolongan: "III/d",
        baseAK: 200,
        akIntegrasi2022: 25,
        akPendidikan: 0,
        karpegNumber: "",
        gender: "Laki-Laki"
      });

      // Instantly open the teacher
      handleSelectTeacher(data);
    } catch (err: any) {
      toast.error("Gagal menambahkan data pegawai: " + (err.message || String(err)));
    }
  };

  // Export Teachers & Supervisors to CSV (using Blob to safely handle #, &, %, and UTF-8 BOM)
  const handleExportTeachersToCSV = () => {
    const headers = [
      "Nama Lengkap",
      "NIP Pegawai",
      "Jenis Kelamin",
      "Golongan Saat Ini",
      "Target Golongan Transisi",
      "AK PAK Integrasi 2022",
      "AK Pondasi Transisi",
      "Nomor Kartu Pegawai (Karpeg)",
      "Unit Kerja / Sekolah",
      "Jabatan Fungsional"
    ];

    const rows = filteredTeachers.map(t => [
      t.name,
      t.nip,
      t.gender || "Laki-Laki",
      t.currentGolongan,
      t.targetGolongan,
      t.akIntegrasi2022 || 0,
      t.baseAK || 0,
      t.karpegNumber || "",
      t.school || "",
      t.jabatanFungsional || "Guru"
    ]);

    const csvBody = [
      headers.map(h => `"${h}"`).join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvBody], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sikapita_guru_pengawas_pns_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Download standard CSV import template
  const handleDownloadTemplateCSV = () => {
    const headers = [
      "Nama Lengkap",
      "NIP Pegawai",
      "Jenis Kelamin",
      "Golongan Saat Ini",
      "Target Golongan Transisi",
      "AK PAK Integrasi 2022",
      "AK Pondasi Transisi",
      "Nomor Kartu Pegawai (Karpeg)",
      "Unit Kerja / Sekolah",
      "Jabatan Fungsional"
    ];

    const sampleRows = [
      [
        "Drs. GURU CONTOH, M.Pd.",
        "198505242010111002",
        "Laki-Laki",
        "III/c",
        "III/d",
        "25.5",
        "200",
        "C45678912",
        user?.school && user.school !== "ALL" ? user.school : "SMAN 1 KAWALI",
        "Guru"
      ],
      [
        "Dr. H. PENGAWAS CONTOH, M.Pd.",
        "197203151997021001",
        "Laki-Laki",
        "IV/b",
        "IV/c",
        "112.5",
        "550",
        "B12345678",
        "CABANG DINAS PENDIDIKAN WILAYAH XIII",
        "Pengawas Sekolah"
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
    link.download = "template_import_guru_pengawas_sikapita.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // RFC-4180 CSV parser supporting UTF-8 BOM, comma (,), semicolon (;) from Excel ID, and tab (\t)
  const parseCSV = (rawText: string): string[][] => {
    const text = rawText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const firstNonEmptyLine = text.split("\n").find(l => l.trim().length > 0) || "";
    if (!firstNonEmptyLine) return [];

    // Auto-detect delimiter outside quotes from header/first line
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

    // Flush trailing field/row
    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      allRows.push(currentRow);
    }

    if (allRows.length === 0) return [];

    // Skip header row if row 0 looks like column headers
    const firstCol = (allRows[0][0] || "").toLowerCase();
    const secondCol = (allRows[0][1] || "").toLowerCase();
    const looksLikeHeader =
      firstCol.includes("nama") ||
      secondCol.includes("nip") ||
      firstCol === "no";

    return looksLikeHeader ? allRows.slice(1) : allRows;
  };

  // Normalize Golongan text (e.g. "iii/c" or "III / C" -> "III/c")
  const normalizeGolongan = (raw: string, fallback: GolonganID): GolonganID => {
    const cleaned = (raw || "").replace(/\s+/g, "").toUpperCase();
    const found = GOLONGAN_LIST.find(g => g.id.toUpperCase() === cleaned);
    return found ? found.id : fallback;
  };

  // Handle CSV import parsing and saving to MySQL (with cPanel PHP & Node support)
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = event.target;
    const file = inputEl.files?.[0];
    if (!file) return;

    // Reset input value so the same file can be re-uploaded after edits
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
        text: "Browser gagal membaca file CSV yang dipilih. Pastikan file tidak rusak atau terkunci aplikasi lain.",
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
        const rows = parseCSV(text);
        if (rows.length === 0) {
          swal.fire({
            title: "File Kosong / Format Tidak Dikenali!",
            text: "Tidak ada baris data guru yang terbaca dari file CSV tersebut. Pastikan menggunakan template CSV dengan pemisah koma (,) atau titik koma (;).",
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

          const name = (row[0] || "").trim();
          const nip = (row[1] || "").trim().replace(/^'+/, "").replace(/\s+/g, "");

          if (!name) {
            skippedCount++;
            if (skipReasons.length < 3) skipReasons.push(`Baris ${idx + 2}: Nama kosong`);
            continue;
          }

          if (/e\+/i.test(nip)) {
            skippedCount++;
            if (skipReasons.length < 3) skipReasons.push(`Baris ${idx + 2} (${name}): NIP terbaca notasi ilmiah Excel (${nip}). Format kolom NIP sebagai Text di Excel.`);
            continue;
          }

          if (nip.length < 10) {
            skippedCount++;
            if (skipReasons.length < 3) skipReasons.push(`Baris ${idx + 2} (${name}): NIP tidak valid/kurang dari 10 karakter`);
            continue;
          }

          const rawGender = (row[2] || "").trim().toLowerCase();
          const gender: "Laki-Laki" | "Perempuan" =
            rawGender === "p" || rawGender.includes("perempuan") || rawGender.includes("wanita") || rawGender === "female"
              ? "Perempuan"
              : "Laki-Laki";

          const currentGolongan = normalizeGolongan(row[3] || "", "III/c");
          const targetGolongan = normalizeGolongan(row[4] || "", "III/d");
          const akIntegrasi2022 = roundAK(parseFloatValue(row[5]));
          const parsedBaseAK = roundAK(parseFloatValue(row[6]));
          const baseAK = parsedBaseAK > 0 ? parsedBaseAK : (GOLONGAN_BASE_VALS[currentGolongan] || 200);
          const karpegNumber = (row[7] || "").trim().replace(/^'+/, "");
          const rawJabatan = (row[9] || "").trim().toLowerCase();
          const jabatanFungsional: JabatanFungsionalType = rawJabatan.includes("pengawas")
            ? "Pengawas Sekolah"
            : "Guru";

          // Tenant protection boundaries
          const defaultUnitKerja = jabatanFungsional === "Pengawas Sekolah"
            ? "CABANG DINAS PENDIDIKAN WILAYAH XIII"
            : "SMAN 1 KAWALI";
          const assignedSchool =
            user?.role === 'school_admin' && user.school && user.school !== 'ALL'
              ? user.school
              : ((row[8] || "").trim() || (user?.school && user.school !== 'ALL' ? user.school : defaultUnitKerja));

          const normalizedSchool = assignedSchool.toUpperCase().trim();
          const matchedSchool = schoolsList.find(s => s.name.toUpperCase().trim() === normalizedSchool);
          const principalName = matchedSchool?.principalName || "";
          const principalNip = matchedSchool?.principalNip || "";

          // Deterministic/existing ID required by api.php and server.ts
          const existingTeacher = teachers.find(t => t.nip.replace(/\s+/g, "") === nip);
          const cleanNipId = nip.replace(/[^a-zA-Z0-9_-]/g, "");
          const teacherId = existingTeacher?.id || (cleanNipId ? `teacher_${cleanNipId.slice(0, 48)}` : `teacher_${Date.now()}_${idx}`);

          const teacherDoc = {
            id: teacherId,
            name: name.toUpperCase(),
            nip,
            jabatanFungsional,
            school: normalizedSchool,
            currentGolongan,
            targetGolongan,
            baseAK,
            akIntegrasi2022,
            akPendidikan: 0,
            ratingSKP: "Baik" as const,
            workDurationYears: 3,
            karpegNumber: karpegNumber.toUpperCase(),
            birthPlaceDate: "",
            gender,
            tmtCurrentPangkat: "",
            tmtCurrentJabatan: "",
            unitKerja: matchedSchool
              ? `${normalizedSchool} KABUPATEN CIAMIS CABANG PENDIDIKAN WILAYAH XIII`
              : normalizedSchool,
            instansiBiro: "PEMERINTAH PROVINSI JAWA BARAT",
            nomorSuratKonversi: "",
            nomorSuratAkumulasi: "",
            nomorSuratPenetapan: "",
            tempatDitetapkan: "Bandung",
            tanggalPenetapan: "",
            pejabatPenilaiTitle: matchedSchool ? "KEPALA SEKOLAH" : "KEPALA CABANG DINAS PENDIDIKAN WILAYAH XIII",
            pejabatPenilaiInstansi: matchedSchool ? normalizedSchool : "PROVINSI JAWA BARAT",
            pejabatPenilaiNama: principalName,
            pejabatPenilaiNip: principalNip,
            pejabatPenilaiGolongan: "",
            pejabatPenilaiStatus: matchedSchool?.principalStatus || ("definitif" as const),
            createdBy: user?.username || "admin"
          };

          const saveResult = await saveTeacherToMysqlDetailed(teacherDoc);
          if (saveResult.ok) {
            importCount++;
          } else {
            failCount++;
            if (errorReasons.length < 3) {
              errorReasons.push(`${name}: ${saveResult.error || "Gagal menyimpan ke server"}`);
            }
          }
        }

        await loadTeachers();

        if (importCount > 0 && failCount === 0) {
          swal.fire({
            title: "Impor Berhasil!",
            text: `Berhasil mengimpor ${importCount} data guru ke database MySQL.${skippedCount > 0 ? ` (${skippedCount} baris dilewati: ${skipReasons.join("; ")})` : ""}`,
            icon: "success",
            confirmButtonText: "Selesai"
          });
          setIsImporting(false);
        } else if (importCount > 0 && failCount > 0) {
          swal.fire({
            title: "Impor Sebagian Berhasil",
            text: `${importCount} data guru berhasil disimpan, namun ${failCount} data gagal disimpan (${errorReasons.join(" | ")}).${skippedCount > 0 ? ` ${skippedCount} baris dilewati.` : ""}`,
            icon: "warning",
            confirmButtonText: "Mengerti"
          });
        } else {
          const detailParts = [
            failCount > 0 ? `${failCount} gagal disimpan ke server (${errorReasons.join(" | ")})` : "",
            skippedCount > 0 ? `${skippedCount} baris dilewati (${skipReasons.join(" | ")})` : ""
          ].filter(Boolean);
          swal.fire({
            title: "Impor Gagal!",
            text: `Tidak ada data guru yang berhasil disimpan ke database. ${detailParts.join(". ")}`,
            icon: "error",
            confirmButtonText: "Tutup"
          });
        }
      } catch (err: any) {
        swal.fire({
          title: "Impor Gagal!",
          text: "Terjadi kesalahan saat memproses data CSV: " + (err.message || String(err)),
          icon: "error"
        });
      } finally {
        setIsImportingProcessing(false);
        setImportProgress(null);
      }
    };
    reader.readAsText(file);
  };

  // Instantiates the default test educator Antan Kustiawan directly inside MySQL
  const handleCreateDemoTeacher = async () => {
    if (!user) return;
    try {
      setLoadingTeachers(true);
      const activeSchool = user.role === 'school_admin' ? user.school : "SMAN 2 CIAMIS";
      const teacherId = "demo_antan_kustiawan";
      
      const teacherDemo = {
        id: teacherId,
        name: "ANTAN KUSTIAWAN, S.Pd, M.Pd.",
        nip: "198606192011011001",
        jabatanFungsional: "Guru" as JabatanFungsionalType,
        school: activeSchool,
        currentGolongan: "III/c" as const,
        targetGolongan: "III/d" as const,
        baseAK: 200.0,
        akIntegrasi2022: 25.0,
        akPendidikan: 0,
        ratingSKP: "Baik" as const,
        workDurationYears: 3,
        karpegNumber: "B03023705",
        birthPlaceDate: "CIAMIS, 19-06-1986",
        gender: "Laki-Laki" as const,
        tmtCurrentPangkat: "01-04-2024",
        tmtCurrentJabatan: "24-08-2023",
        unitKerja: `${activeSchool} KABUPATEN CIAMIS CABANG PENDIDIKAN WILAYAH XIII`,
        instansiBiro: "PEMERINTAH PROVINSI JAWA BARAT",
        nomorSuratKonversi: "1523/KPG.03.03/KCD XIII",
        nomorSuratAkumulasi: "1524/KPG.03.03/KCD XIII",
        nomorSuratPenetapan: "1525/KPG.03.03/KCD XIII",
        tempatDitetapkan: "Bandung",
        tanggalPenetapan: "02 April 2026",
        pejabatPenilaiTitle: "KEPALA CABANG PENDIDIKAN WILAYAH XIII",
        pejabatPenilaiInstansi: "PROVINSI JAWA BARAT",
        pejabatPenilaiNama: "DWI YANTI ESTRININGRUM, S.Sos., M.Pd.",
        pejabatPenilaiNip: "19741212 200212 2 003",
        pejabatPenilaiGolongan: "Pembina Tk.I",
        pejabatPenilaiStatus: "definitif",
        createdBy: user.username
      };

      await saveTeacherToMysql(teacherDemo);

      // Add evaluation logs for Antan
      for (let idx = 0; idx < DEFAULT_EVALUATIONS.length; idx++) {
        const item = DEFAULT_EVALUATIONS[idx];
        await saveEvaluationToMysql(teacherId, {
          ...item,
          id: `eval_${item.year}_${idx}`,
          createdBy: user.username
        });
      }

      await loadTeachers();
      toast.success("Akun Contoh Guru (Antan Kustiawan, S.Pd, M.Pd.) berhasil diinisialisasi ke database MySQL XAMPP!");
    } catch (err) {
      console.error("Creation failed", err);
      toast.error("Gagal melakukan instansiasi akun contoh.");
    } finally {
      setLoadingTeachers(false);
    }
  };

  // Delete a teacher profile and all child structures
  const handleDeleteTeacher = async (id: string, name: string) => {
    setTeacherToDelete({ id, name });
  };

  // Actual Delete Action
  const executeDeleteTeacher = async () => {
    if (!teacherToDelete) return;
    const { id, name } = teacherToDelete;
    try {
      await deleteTeacherFromMysql(id);
      setTeachers(prev => prev.filter(t => t.id !== id));
      if (selectedTeacherId === id) {
        setSelectedTeacherId(null);
        setProfile(null);
        setEvaluations([]);
      }
      toast.success(`Data riwayat Guru "${name}" berhasil dihapus secara permanen dari database MySQL.`);
    } catch (err: any) {
      toast.error("Gagal menghapus data guru: " + (err.message || String(err)));
    } finally {
      setTeacherToDelete(null);
    }
  };

  // Load selected teacher profile into reactive state
  const handleSelectTeacher = (teacher: TeacherProfile & { id: string }) => {
    setSelectedTeacherId(teacher.id);
    setProfile(teacher);
    setActiveTab("dashboard");
  };

  // Update profile in database
  const handleProfileChange = async (updated: TeacherProfile) => {
    if (!selectedTeacherId) return;
    
    // Ensure all numeric values are cleanly parsed and rounded to 3 decimals
    const parsedUpdated: TeacherProfile = {
      ...updated,
      baseAK: roundAK(parseFloatValue(updated.baseAK)),
      akIntegrasi2022: roundAK(parseFloatValue(updated.akIntegrasi2022)),
      akPendidikan: roundAK(parseFloatValue(updated.akPendidikan)),
      workDurationYears: parseFloatValue(updated.workDurationYears) || 1
    };

    // Set local state immediately for instant responsive live view and printing
    setProfile(parsedUpdated);
    setTeachers(prev => prev.map(t => t.id === selectedTeacherId ? { ...t, ...parsedUpdated } : t));

    try {
      const saveRes = await saveTeacherToMysqlDetailed({
        id: selectedTeacherId,
        ...parsedUpdated
      });
      if (!saveRes.ok) {
        throw new Error(saveRes.error || "Gagal menyimpan data pegawai ke server.");
      }
      toast.success("Data pegawai berhasil disimpan ke database.");
    } catch (err: any) {
      console.error("MySQL update failed:", err);
      toast.error("Gagal menyimpan ke MySQL: " + (err.message || String(err)));
    }
  };

  // Add E-SKP evaluation
  const handleAddEvaluation = async (newEval: SKPEvaluation) => {
    if (!selectedTeacherId || !user) return;
    try {
      const evalId = newEval.id || `eval_${newEval.year || 2024}_${Date.now()}`;
      const evalDoc: SKPEvaluation = {
        ...newEval,
        id: evalId,
        year: Number(newEval.year),
        period: newEval.period,
        rating: newEval.rating,
        level: newEval.level,
        coefficient: roundAK(parseFloatValue(newEval.coefficient)),
        multiplier: Number(parseFloatValue(newEval.multiplier).toFixed(2)),
        creditEarned: roundAK(parseFloatValue(newEval.creditEarned)),
        akPendidikan: roundAK(parseFloatValue(newEval.akPendidikan)),
        notes: newEval.notes || "",
        startDate: newEval.startDate || "",
        endDate: newEval.endDate || "",
        isCustomRange: Boolean(newEval.isCustomRange),
        customMonths: Number(newEval.customMonths) || 12,
        skpFileLink: newEval.skpFileLink || "",
        evidenceFileLink: newEval.evidenceFileLink || "",
        overrideData: newEval.overrideData || undefined
      };

      await saveEvaluationToMysql(selectedTeacherId, evalDoc);

      setEvaluations(prev => {
        const next = [evalDoc, ...prev.filter(e => e.id !== evalId)];
        next.sort((a, b) => (b.year - a.year) || b.period.localeCompare(a.period));
        const totalAK = sumAK(...next.map(item => item.creditEarned || 0));
        const totalPend = sumAK(...next.map(item => item.akPendidikan || 0));
        setTeacherEvalsCache(c => ({ ...c, [selectedTeacherId]: totalAK }));
        setTeacherPendCache(c => ({ ...c, [selectedTeacherId]: totalPend }));
        return next;
      });

      toast.success("Penilaian SKP berhasil disimpan ke database MySQL XAMPP.");
    } catch (err: any) {
      toast.error("Gagal menambahkan penilaian: " + (err.message || String(err)));
    }
  };

  // Delete evaluation
  const handleDeleteEvaluation = async (evaluationId: string) => {
    if (!selectedTeacherId) return;
    try {
      await deleteEvaluationFromMysql(evaluationId);
      setEvaluations(prev => prev.filter(e => e.id !== evaluationId));
      loadEvaluations(selectedTeacherId);
      toast.success("Penilaian SKP berhasil dihapus dari database MySQL.");
    } catch (err: any) {
      toast.error("Gagal menghapus penilaian: " + (err.message || String(err)));
    }
  };

  // Update E-SKP evaluation
  const handleUpdateEvaluation = async (updatedEval: SKPEvaluation) => {
    if (!selectedTeacherId || !user) return;
    try {
      const evalDoc: SKPEvaluation = {
        ...updatedEval,
        year: Number(updatedEval.year),
        period: updatedEval.period,
        rating: updatedEval.rating,
        level: updatedEval.level,
        coefficient: roundAK(parseFloatValue(updatedEval.coefficient)),
        multiplier: Number(parseFloatValue(updatedEval.multiplier).toFixed(2)),
        creditEarned: roundAK(parseFloatValue(updatedEval.creditEarned)),
        akPendidikan: roundAK(parseFloatValue(updatedEval.akPendidikan)),
        notes: updatedEval.notes || "",
        startDate: updatedEval.startDate || "",
        endDate: updatedEval.endDate || "",
        isCustomRange: Boolean(updatedEval.isCustomRange),
        customMonths: Number(updatedEval.customMonths) || 12,
        skpFileLink: updatedEval.skpFileLink || "",
        evidenceFileLink: updatedEval.evidenceFileLink || "",
        overrideData: updatedEval.overrideData || undefined
      };

      await saveEvaluationToMysql(selectedTeacherId, evalDoc);
      setEvaluations(prev => prev.map(e => e.id === evalDoc.id ? evalDoc : e));
      loadEvaluations(selectedTeacherId);
      toast.success("Data evaluasi SKP berhasil diperbarui di database MySQL.");
    } catch (err: any) {
      toast.error("Gagal memperbarui evaluasi: " + (err.message || String(err)));
    }
  };

  const handlePrintEvaluation = (evalId: string) => {
    setSelectedEvalIdForPrint(evalId);
    setActiveTab("pak_report");
  };

  const handlePrint = () => {
    setActiveTab("pak_report");
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Combined options for unit kerja filter dropdown (master schools + unit kerja on teachers/supervisors)
  const schoolFilterOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; npsn: string }>();
    schoolsList.forEach(s => {
      const upper = (s.name || "").toUpperCase().trim();
      if (upper) map.set(upper, { id: s.id, name: s.name, npsn: s.npsn || s.id });
    });
    teachers.forEach(t => {
      const upper = (t.school || "").toUpperCase().trim();
      if (upper && !map.has(upper)) {
        map.set(upper, { id: upper, name: upper, npsn: "UNIT" });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [schoolsList, teachers]);

  // Filter & sort teachers based on search query, school filter, jabatan filter, golongan filter, eligibility filter, and sorting choice
  const filteredTeachers = useMemo(() => {
    let list = teachers.filter(t => {
      // 1. Text Search query
      const jfText = (t.jabatanFungsional || "Guru").toLowerCase();
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.nip.includes(searchQuery) ||
        t.school.toLowerCase().includes(searchQuery.toLowerCase()) ||
        jfText.includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 2. School / Unit Kerja Filter
      if (filterSchool && t.school !== filterSchool) return false;

      // 2b. Jabatan Fungsional Filter
      if (filterJabatan) {
        const currentJF = t.jabatanFungsional || "Guru";
        if (currentJF !== filterJabatan) return false;
      }

      // 3. Golongan Filter
      if (filterGolongan && t.currentGolongan !== filterGolongan) return false;

      // 4. Eligibility Filter
      if (filterEligibility) {
        const totalSKP = teacherEvalsCache[t.id] || 0;
        const totalPend = teacherPendCache[t.id] || 0;
        const totalPendidikanAK = sumAK(t.akPendidikan || 0, totalPend);
        const currentTotalAK = sumAK(t.akIntegrasi2022 || 0, totalSKP, totalPendidikanAK);

        const minimalPangkat = getMinimalPangkat(t.currentGolongan);
        const minimalJenjang = getMinimalJenjang(t.currentGolongan);

        const isCrossingJenjang = getTeacherLevel(t.currentGolongan) !== getTeacherLevel(t.targetGolongan);
        const isEligible = isCrossingJenjang 
          ? (isAKGreaterOrEqual(currentTotalAK, minimalPangkat) && isAKGreaterOrEqual(currentTotalAK, minimalJenjang))
          : isAKGreaterOrEqual(currentTotalAK, minimalPangkat);

        if (filterEligibility === "eligible" && !isEligible) return false;
        if (filterEligibility === "not_eligible" && isEligible) return false;
      }

      return true;
    });

    // 5. Sorting choice
    list.sort((a, b) => {
      if (sortBy === "name_asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name_desc") {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === "nip") {
        return a.nip.localeCompare(b.nip);
      }
      if (sortBy === "ak_desc" || sortBy === "ak_asc") {
        const totalAK_A = sumAK(a.akIntegrasi2022 || 0, teacherEvalsCache[a.id] || 0, a.akPendidikan || 0, teacherPendCache[a.id] || 0);
        const totalAK_B = sumAK(b.akIntegrasi2022 || 0, teacherEvalsCache[b.id] || 0, b.akPendidikan || 0, teacherPendCache[b.id] || 0);

        return sortBy === "ak_desc" ? totalAK_B - totalAK_A : totalAK_A - totalAK_B;
      }
      return 0;
    });

    return list;
  }, [teachers, searchQuery, filterSchool, filterJabatan, filterGolongan, filterEligibility, sortBy, teacherEvalsCache, teacherPendCache]);

  const stats = useMemo(() => {
    const total = teachers.length;
    let eligible = 0;
    const totalAKList: number[] = [];

    teachers.forEach(t => {
      const totalPendidikanAK = sumAK(t.akPendidikan || 0, teacherPendCache[t.id] || 0);
      const currentTotalAK = sumAK(t.akIntegrasi2022 || 0, teacherEvalsCache[t.id] || 0, totalPendidikanAK);
      totalAKList.push(currentTotalAK);

      const minimalPangkat = getMinimalPangkat(t.currentGolongan);
      const minimalJenjang = getMinimalJenjang(t.currentGolongan);

      const isCrossingJenjang = getTeacherLevel(t.currentGolongan) !== getTeacherLevel(t.targetGolongan);
      const isEligible = isCrossingJenjang 
        ? (isAKGreaterOrEqual(currentTotalAK, minimalPangkat) && isAKGreaterOrEqual(currentTotalAK, minimalJenjang))
        : isAKGreaterOrEqual(currentTotalAK, minimalPangkat);

      if (isEligible) {
        eligible++;
      }
    });

    const grandTotalAK = sumAK(...totalAKList);

    return {
      total,
      eligible,
      notEligible: total - eligible,
      avgAK: total > 0 ? roundAK(grandTotalAK / total) : 0
    };
  }, [teachers, teacherEvalsCache, teacherPendCache]);

  const hasPagination = !!user;
  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  const indexOfLastItem = safeCurrentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTeachers = hasPagination 
    ? filteredTeachers.slice(indexOfFirstItem, indexOfLastItem)
    : filteredTeachers;
  const activeViewMode = hasPagination ? viewMode : 'grid';

  const maxPageVisible = 5;
  const getPageNumbers = () => {
    const pages = [];
    let startPage = Math.max(1, safeCurrentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxPageVisible - 1);
    
    if (endPage - startPage < maxPageVisible - 1) {
      startPage = Math.max(1, endPage - maxPageVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  // Render Custom confirmation modals
  const renderConfirmModals = () => {
    return (
      <>
        {/* Logout Confirmation Modal */}
        {logoutConfirmOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fadeIn text-slate-100">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-center">
              <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <LogOut className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-100 uppercase tracking-tight font-sans">Konfirmasi Keluar</h3>
                <p className="text-xs text-slate-400 font-sans">
                  Apakah Anda yakin ingin keluar dari portal administrasi Si-KAPITA? Anda perlu masuk kembali menggunakan kredensial Anda untuk melanjutkan pekerjaan.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setLogoutConfirmOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl border border-slate-700/80 cursor-pointer transition-colors font-sans"
                >
                  BATAL
                </button>
                <button
                  type="button"
                  onClick={executeLogout}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl border border-rose-500 cursor-pointer transition-colors font-sans"
                >
                  YA, KELUAR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Teacher Confirmation Modal */}
        {teacherToDelete && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fadeIn text-slate-100">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
              <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-100 uppercase tracking-tight text-rose-500 font-sans font-black">Peringatan Keras Penghapusan</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Apakah Anda yakin ingin menghapus data Guru PNS bernama <strong className="text-white">"{teacherToDelete.name}"</strong>? 
                  Tindakan ini tidak dapat dibatalkan. Seluruh dokumen angka kredit dan riwayat E-SKP yang bersangkutan akan dihapus secara permanen dari server awan (cloud).
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setTeacherToDelete(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold text-xs rounded-xl border border-slate-705 cursor-pointer transition-colors font-sans"
                >
                  BATALKAN
                </button>
                <button
                  type="button"
                  onClick={executeDeleteTeacher}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl border border-rose-500 cursor-pointer transition-colors shadow-lg shadow-rose-950/30 font-sans"
                >
                  YA, HAPUS PERMANEN
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Application Logo Customization Modal - Khusus Super Admin */}
        {logoModalOpen && user.role === 'super_admin' && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fadeIn text-slate-100 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative my-8">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight uppercase">Ganti Logo & Favicon Si-KAPITA</h3>
                    <p className="text-[11px] text-slate-400">Atur logo untuk Tampilan Login, Menu Dashboard, & Favicon Browser</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLogoModalOpen(false);
                    setLogoPreviewUrl(null);
                    setLogoUploadError(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Logo Previews (Current / Proposed) */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  Pratinjau Logo & Ukuran Tampilan:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center text-center space-y-2 min-h-[140px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tampilan Login</span>
                    <div 
                      style={{ height: `${Math.min(tempLoginLogoHeight, 140)}px` }}
                      className="flex items-center justify-center transition-all duration-200"
                    >
                      <img 
                        src={logoPreviewUrl || appLogo || "/logo.png"} 
                        alt="Pratinjau Login" 
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = DEFAULT_APP_LOGO;
                        }}
                        style={{ height: `${Math.min(tempLoginLogoHeight, 140)}px`, width: 'auto' }}
                        className="max-w-full object-contain"
                      />
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">{tempLoginLogoHeight} px</span>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center text-center space-y-2 min-h-[140px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tampilan Sidebar</span>
                    <div 
                      style={{ height: `${tempSidebarLogoHeight}px` }}
                      className="flex items-center justify-center transition-all duration-200"
                    >
                      <img 
                        src={logoPreviewUrl || appLogo || "/logo.png"} 
                        alt="Pratinjau Sidebar" 
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = DEFAULT_APP_LOGO;
                        }}
                        style={{ height: `${tempSidebarLogoHeight}px`, width: 'auto' }}
                        className="max-w-full object-contain"
                      />
                    </div>
                    <span className="text-[10px] text-teal-400 font-mono font-bold">{tempSidebarLogoHeight} px</span>
                  </div>
                </div>
              </div>

              {/* Setting Ukuran Logo Controls */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                      Pengaturan Ukuran Logo
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setTempLoginLogoHeight(90);
                        setTempSidebarLogoHeight(50);
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    >
                      Kecil
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempLoginLogoHeight(125);
                        setTempSidebarLogoHeight(64);
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/40 transition-colors cursor-pointer"
                    >
                      Proporsional
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempLoginLogoHeight(150);
                        setTempSidebarLogoHeight(76);
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                    >
                      Besar ⭐
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempLoginLogoHeight(180);
                        setTempSidebarLogoHeight(88);
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    >
                      Ekstra Besar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Slider Login */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium">Ukuran Logo Login:</span>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                        {tempLoginLogoHeight} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={70}
                      max={190}
                      step={5}
                      value={tempLoginLogoHeight}
                      onChange={(e) => setTempLoginLogoHeight(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>70px</span>
                      <span>125px (Standar)</span>
                      <span>190px</span>
                    </div>
                  </div>

                  {/* Slider Sidebar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium">Ukuran Logo Sidebar:</span>
                      <span className="font-mono font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/40">
                        {tempSidebarLogoHeight} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={95}
                      step={4}
                      value={tempSidebarLogoHeight}
                      onChange={(e) => setTempSidebarLogoHeight(Number(e.target.value))}
                      className="w-full accent-teal-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>40px</span>
                      <span>64px (Standar)</span>
                      <span>95px</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Option 1: File from Computer / Phone */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase text-emerald-400 tracking-wider">
                  Cara 1: Unggah File Logo dari Komputer / HP
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-4 text-center transition-colors bg-slate-950/40">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                    id="simpak_logo_input"
                    className="hidden"
                    onChange={handleLogoFileUpload}
                  />
                  <label htmlFor="simpak_logo_input" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="w-6 h-6 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Klik di sini untuk memilih file gambar logo
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Mendukung PNG, JPG, WebP, SVG (Contoh: LOGO CABANG DINAS-13.png)
                    </span>
                  </label>
                </div>
                {logoUploadError && (
                  <p className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {logoUploadError}
                  </p>
                )}
              </div>

              {/* Upload Option 2: cPanel File Manager instructions */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-teal-400 tracking-wider">
                    Cara 2: Lewat File Manager cPanel (Tanpa Login)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreviewUrl("/logo.png");
                    }}
                    className="text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    Gunakan /logo.png
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Cukup upload file gambar logo Anda ke File Manager cPanel di folder <strong className="text-white">public_html</strong> dan beri nama file <strong className="text-emerald-300">logo.png</strong>. Sistem otomatis membaca file tersebut!
                </p>
              </div>

              {/* Upload Option 3: Image URL input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  Cara 3: Masukkan Link / URL Gambar Online
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://... atau /logo.png"
                    value={customLogoUrlInput}
                    onChange={(e) => setCustomLogoUrlInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customLogoUrlInput.trim()) {
                        setLogoPreviewUrl(customLogoUrlInput.trim());
                      }
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                  >
                    Cek
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleResetAppLogo}
                  className="w-full sm:w-auto px-4 py-2 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors font-bold cursor-pointer"
                >
                  Reset Logo Bawaan
                </button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setLogoModalOpen(false);
                      setLogoPreviewUrl(null);
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const finalLogo = logoPreviewUrl || (customLogoUrlInput.trim() ? customLogoUrlInput.trim() : appLogo);
                      handleSaveAppLogo(finalLogo, tempLoginLogoHeight, tempSidebarLogoHeight);
                    }}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-900/30 cursor-pointer"
                  >
                    SIMPAN LOGO & UKURAN
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
        {/* XAMPP MySQL Configuration Modal - Khusus Super Admin */}
        {user.role === 'super_admin' && (
          <XamppModal isOpen={xamppModalOpen} onClose={() => setXamppModalOpen(false)} />
        )}
      </>
    );
  };

  // Authenticating Loader
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center font-sans text-white select-none">
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl flex flex-col items-center max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full border-t-4 border-l-4 border-teal-500 animate-spin"></div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">Memuat Portal Si-KAPITA</h3>
            <p className="text-xs text-slate-450 mt-1">Menghubungkan ke secure cloud service...</p>
          </div>
        </div>
      </div>
    );
  }

  // --- UNAUTHENTICATED LOGIN VIEW (Username & Password Portal) ---
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans flex flex-col justify-between text-slate-100 select-none relative overflow-hidden">
        <style>{`
          @keyframes floatBlob1 {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(40px, -60px) scale(1.15); }
            66% { transform: translate(-30px, 30px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          @keyframes floatBlob2 {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(-50px, 40px) scale(0.85); }
            66% { transform: translate(40px, -30px) scale(1.1); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          @keyframes floatBlob3 {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(35px, 35px) scale(1.1); }
            66% { transform: translate(-40px, -40px) scale(0.85); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob1 {
            animation: floatBlob1 20s infinite alternate ease-in-out;
          }
          .animate-blob2 {
            animation: floatBlob2 25s infinite alternate ease-in-out;
          }
          .animate-blob3 {
            animation: floatBlob3 18s infinite alternate ease-in-out;
          }
        `}</style>

        {/* Ambient Animated Abstract Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] animate-blob1"></div>
          <div className="absolute top-1/2 left-1/4 w-[450px] h-[450px] bg-teal-500/10 rounded-full blur-[120px] animate-blob2"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-[110px] animate-blob3"></div>
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-500/5 rounded-full blur-[90px] animate-blob1"></div>
        </div>

        {/* Decorative Top header */}
        <div className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800/40 py-3 text-center text-[10px] tracking-widest font-mono text-teal-400 z-10 relative">
          SISTEM KEAMANAN TERINTEGRASI • CABANG DINAS PENDIDIKAN WILAYAH XIII
        </div>

        {/* Floating Quick Controls on Login: Theme & Fullscreen (Icon Only) */}
        <div className="absolute top-2.5 right-3.5 z-30 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 p-1 rounded-xl shadow-lg">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? "Mode Terang (Light Mode)" : "Mode Gelap (Dark Mode)"}
            className="p-1.5 text-slate-300 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Keluar Layar Penuh (Esc)" : "Layar Penuh (Fullscreen)"}
            className="p-1.5 text-slate-300 hover:text-teal-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4 text-teal-400" /> : <Maximize className="w-4 h-4 text-slate-300" />}
          </button>
        </div>
 
        {/* Login main frame */}
        <div className="max-w-md w-full mx-auto px-4 py-12 flex-1 flex flex-col justify-center z-10 relative">
          <div className="bg-slate-900/60 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative overflow-hidden space-y-6">
            
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500"></div>
 
            {/* Shield & Crest Header */}
            <div className="flex flex-col items-center space-y-3">
              <div 
                style={{ height: `${loginLogoHeight}px` }}
                className="flex items-center justify-center filter drop-shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300"
              >
                <img 
                  src={appLogo || "/logo.png"} 
                  alt="Logo Si-KAPITA" 
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (target.src !== DEFAULT_APP_LOGO) {
                      target.src = DEFAULT_APP_LOGO;
                    }
                  }}
                  style={{ height: `${loginLogoHeight}px`, width: 'auto', maxHeight: '200px' }}
                  className="max-w-[280px] object-contain transition-all duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>
 
              <div className="text-center">
                <span className="block text-[9px] font-black tracking-widest text-emerald-400 uppercase">PORTAL ADMINISTRASI KEPEGAWAIAN</span>
                <h1 className="text-2xl font-black text-white uppercase tracking-tight">Si-KAPITA</h1>
                <p className="text-[11px] text-slate-300 leading-relaxed mt-1 font-medium">
                  Sistem Informasi Konversi Angka Kredit Pendidik & Tenaga Kependidikan<br />
                  <span className="text-emerald-400/90 text-[10px]">Cabang Dinas Pendidikan Wilayah XIII Dinas Pendidikan Provinsi Jawa Barat</span>
                </p>
              </div>
            </div>

            <div className="border-t border-slate-800/50 my-1"></div>

            {/* Login control form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="bg-rose-950/30 backdrop-blur-md border border-rose-800/50 text-rose-200 text-xs p-3 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Akun (Username)</label>
                <input
                  type="text"
                  placeholder="Contoh: admin atau sman2ciamis"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-xl p-3 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-all font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kata Sandi (Password)</label>
                <input
                  type="password"
                  placeholder="Masukkan password akun Anda"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-xl p-3 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-all font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLogining}
                className={`w-full py-3 px-4 bg-teal-600 hover:bg-teal-505 active:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-lg hover:shadow-teal-900/20 cursor-pointer transition-all border border-teal-500 select-none ${isLogining ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLogining ? "MEMVERIFIKASI AUTENTIKASI..." : "MASUK KE PORTAL Si-KAPITA"}
              </button>
            </form>

            {/* Security disclaimer */}
            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/60 text-[10px] text-slate-400 leading-relaxed font-sans space-y-1">
              <span className="font-bold text-emerald-400 block uppercase">Catatan Verifikasi Otoritas:</span>
              <p>Masing-masing pendaftaran sekolah diatur tersendiri untuk mengelola guru instansinya. Super Admin KCD XIII memegang kendali rekapitulasi data global.</p>
            </div>
 
          </div>
        </div>
 
        {/* Clean footer */}
        <div className="bg-slate-900/30 border-t border-slate-900/40 py-4 text-center text-[10px] text-slate-500 font-mono z-10 relative">
          © 2026 CABANG DINAS PENDIDIKAN WILAYAH XIII PROVINSI JAWA BARAT • PERMENPAN RB NO. 1/2023
        </div>
 
      </div>
    );
  }
 
  // --- AUTHENTICATED: GURU PNS REGISTRY / LISTING VIEW ---
  if (selectedTeacherId === null || profile === null) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row relative">
        
        {/* Mobile Header Bar (Only visible on mobile) */}
        <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center text-white z-20 print:hidden select-none w-full">
          <div className="flex items-center gap-2">
            <img 
              src={appLogo || "/logo.png"} 
              alt="Logo Si-KAPITA" 
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (target.src !== DEFAULT_APP_LOGO) {
                  target.src = DEFAULT_APP_LOGO;
                }
              }}
              style={{ height: `${Math.min(sidebarLogoHeight, 48)}px`, width: 'auto' }}
              className="object-contain"
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="block text-[8px] font-black text-emerald-400 tracking-wider">
                Si-KAPITA {user.role === 'school_admin' && user.school ? `• ${user.school}` : ''}
              </span>
              <span className="block text-[10px] font-bold text-slate-300">CABIN DISDIK JABAR XIII</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Theme Toggle Button (Icon Only) */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? "Mode Terang (Light Mode)" : "Mode Gelap (Dark Mode)"}
              className="p-1.5 text-slate-300 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
            </button>

            {/* Fullscreen Toggle Button (Icon Only) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
              className="p-1.5 text-slate-300 hover:text-teal-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize className="w-4 h-4 text-teal-400" /> : <Maximize className="w-4 h-4 text-slate-300" />}
            </button>

            <button 
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="p-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg focus:outline-none cursor-pointer"
              title="Buka Menu"
            >
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Sidebar Overlay/Drawer */}
        {mobileSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden transition-all duration-300 print:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar Component (Persistent on Desktop, Drawer on Mobile) */}
        <aside className={`
          fixed md:sticky top-0 left-0 bottom-0 z-50 md:z-10
          w-72 bg-slate-900 border-r border-slate-850 text-slate-200 
          flex flex-col shrink-0 h-screen transition-transform duration-300 ease-in-out print:hidden
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}>
          {/* Sidebar Top Brand Header */}
          <div className="p-4 border-b border-slate-850 bg-slate-950/40 space-y-3">
            {/* Row 1: Logo & Application Title (Full width, completely unblocked) */}
            <div className="flex items-center gap-3">
              <div 
                style={{ height: `${Math.min(sidebarLogoHeight, 52)}px` }}
                className="flex items-center justify-center shrink-0 transition-all duration-300"
              >
                <img 
                  src={appLogo || "/logo.png"} 
                  alt="Logo Si-KAPITA" 
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (target.src !== DEFAULT_APP_LOGO) {
                      target.src = DEFAULT_APP_LOGO;
                    }
                  }}
                  style={{ height: `${Math.min(sidebarLogoHeight, 52)}px`, width: 'auto' }}
                  className="max-w-[56px] object-contain transition-all duration-300 drop-shadow-md"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[8px] font-black tracking-widest text-emerald-400 uppercase">
                  PORTAL ADMINISTRASI
                </span>
                <h2 className="text-base font-black text-white tracking-tight uppercase leading-tight">
                  Si-KAPITA
                </h2>
                <span className="block text-[9px] text-slate-400 font-medium leading-tight">
                  CDP WILAYAH XIII JABAR
                </span>
              </div>
            </div>

            {/* Row 2: Quick Control Strip (Icon-Only buttons, clearly separated without crowding the title) */}
            <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800/80 rounded-xl px-2.5 py-1.5 shadow-inner">
              <span className="text-[9px] font-mono font-bold text-slate-400 tracking-wider">
                AKSES CEPAT
              </span>
              <div className="flex items-center gap-1.5">
                {/* Theme Toggle Button (Icon Only) */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={theme === 'dark' ? "Mode Terang (Light Mode)" : "Mode Gelap (Dark Mode)"}
                  className="p-1.5 text-slate-300 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  aria-label="Toggle Theme"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
                </button>

                {/* Fullscreen Toggle Button (Icon Only) */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Keluar Layar Penuh (Esc)" : "Layar Penuh (Fullscreen)"}
                  className="p-1.5 text-slate-300 hover:text-teal-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  aria-label="Toggle Fullscreen"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4 text-teal-400" /> : <Maximize className="w-4 h-4 text-slate-300" />}
                </button>

                {/* Atur Logo Button (Super Admin Khusus - Icon Only) */}
                {user.role === 'super_admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreviewUrl(null);
                      setLogoUploadError(null);
                      setCustomLogoUrlInput('');
                      setTempLoginLogoHeight(loginLogoHeight);
                      setTempSidebarLogoHeight(sidebarLogoHeight);
                      setLogoModalOpen(true);
                    }}
                    title="Atur Logo & Ukuran Si-KAPITA"
                    className="p-1.5 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    aria-label="Atur Logo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* User Profile Info section in Sidebar */}
          <div className="p-4 mx-4 my-4 bg-slate-950/45 rounded-xl border border-slate-850/80 space-y-2.5 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-500/35 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="truncate min-w-0 flex-1">
                <span className="block text-[9px] font-black text-slate-500 uppercase tracking-wider">AKTIF PETUGAS</span>
                <p className="text-xs font-bold text-slate-200 truncate leading-tight">{user.displayName || user.username}</p>
              </div>
            </div>

            {/* Unit Kerja / Nama Sekolah Aktif */}
            {user.role === 'school_admin' && (
              <div className="bg-emerald-950/50 border border-emerald-500/35 rounded-xl p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Building className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-wider">UNIT KERJA / SEKOLAH:</span>
                </div>
                <p className="text-xs font-black text-white uppercase tracking-tight leading-snug pl-5 break-words">
                  {user.school || "SEKOLAH INDUK"}
                </p>
              </div>
            )}
            {user.role === 'super_admin' && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2 space-y-0.5">
                <div className="flex items-center gap-1.5 text-teal-400">
                  <Building className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-wider">WILAYAH TUGAS:</span>
                </div>
                <p className="text-[10px] font-bold text-slate-300 leading-snug pl-5">
                  KCD Wilayah XIII Jabar (Semua Sekolah)
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-850/40">
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-900 px-2 py-0.5 rounded-md uppercase">
                {user.role === 'super_admin' ? 'SUPER ADMIN' : 'OPERATOR SEKOLAH'}
              </span>
              <div className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
                <Clock className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span>ONLINE</span>
              </div>
            </div>
          </div>

          {/* Sidebar Navigation Items */}
          <nav className="flex-1 px-4 space-y-1.5 py-2 overflow-y-auto">
            <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest px-3 mb-2.5">WORKSPACE MENU</span>
            
            {/* 1. Pangkalan Guru PNS */}
            <button
              onClick={() => {
                setAdminView("teachers");
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-left ${
                adminView === "teachers"
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-950/20"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className={`w-4 h-4 ${adminView === "teachers" ? "text-white" : "text-emerald-500"}`} />
                <span>PANGKALAN GURU & PENGAWAS</span>
              </div>
            </button>

            {/* 2. Manajemen Akun Sekolah (Super Admin only) */}
            {user.role === "super_admin" && (
              <button
                onClick={() => {
                  setAdminView("users");
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-left ${
                  adminView === "users"
                    ? "bg-teal-600 text-white shadow-lg shadow-teal-950/20"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className={`w-4 h-4 ${adminView === "users" ? "text-white" : "text-teal-400"}`} />
                  <span>MANAJEMEN AKUN</span>
                </div>
                <span className="bg-teal-950 text-teal-300 text-[8px] font-black px-1.5 py-0.5 rounded-md border border-teal-850 uppercase">
                  SUPER
                </span>
              </button>
            )}

            {/* 3. Informasi / Master Data Sekolah */}
            <button
              onClick={() => {
                setAdminView("schools");
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-left ${
                adminView === "schools"
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-950/20"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <School className={`w-4 h-4 ${adminView === "schools" ? "text-white" : "text-emerald-500"}`} />
                <span>{user.role === 'school_admin' ? "INFORMASI SEKOLAH" : "MASTER DATA SEKOLAH"}</span>
              </div>
            </button>

            {/* 4. Atur Kop & Logo Surat */}
            <button
              onClick={() => {
                setAdminView("kop");
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-left ${
                adminView === "kop"
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-950/20"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className={`w-4 h-4 ${adminView === "kop" ? "text-white" : "text-blue-500"}`} />
                <span>KOP & LOGO SURAT</span>
              </div>
              <span className="bg-amber-950 text-amber-405 text-[8px] font-black px-1.5 py-0.5 rounded-md border border-amber-900 uppercase">
                ADMIN
              </span>
            </button>

            {/* 5. Simulasi Kalkulator */}
            <button
              onClick={() => {
                setAdminView("calculator");
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-left ${
                adminView === "calculator"
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-950/20"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Calculator className={`w-4 h-4 ${adminView === "calculator" ? "text-white" : "text-pink-500"}`} />
                <span>SIMULASI KALKULATOR</span>
              </div>
            </button>

            {/* 6. Panduan & Regulasi */}
            <button
              onClick={() => {
                setAdminView("regulations");
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-left ${
                adminView === "regulations"
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-950/20"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className={`w-4 h-4 ${adminView === "regulations" ? "text-white" : "text-violet-500"}`} />
                <span>PANDUAN & REGULASI BKN</span>
              </div>
            </button>

            {/* 7. Logging & Error Management */}
            <button
              onClick={() => {
                setAdminView("logs");
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-left ${
                adminView === "logs"
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-950/20"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Terminal className={`w-4 h-4 ${adminView === "logs" ? "text-white" : "text-amber-500"}`} />
                <span>LOGGING MANAGEMENT</span>
              </div>
              <span className="bg-slate-900 text-amber-400 text-[8px] font-mono px-1.5 py-0.5 rounded border border-slate-750 uppercase">
                SYSTEM
              </span>
            </button>

            {/* 8. Database MySQL XAMPP (Mac / SQL) - Khusus Super Admin */}
            {user.role === 'super_admin' && (
              <button
                onClick={() => {
                  setXamppModalOpen(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-left text-sky-400 hover:bg-sky-950/40 hover:text-sky-200 border border-sky-900/40"
                title="Panduan Database MySQL XAMPP & Unduh File database.sql"
              >
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-sky-400" />
                  <span>DATABASE XAMPP (MAC)</span>
                </div>
                <span className="bg-sky-950 text-sky-300 text-[8px] font-mono px-1.5 py-0.5 rounded border border-sky-850 uppercase">
                  SQL
                </span>
              </button>
            )}
          </nav>

          {/* Sidebar Bottom Session Controls & Exit */}
          <div className="p-4 border-t border-slate-850 space-y-3 bg-slate-950/20 select-none shrink-0">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white rounded-xl border border-slate-750 hover:border-rose-850 font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" /> KELUAR PORTAL
            </button>
            <div className="text-center text-[9px] text-slate-500 font-mono tracking-tight leading-tight">
              Si-KAPITA v1.5 • 2026<br />Cabang Dinas Pendidikan Wilayah XIII
            </div>
          </div>
        </aside>

        {/* Content Container (takes up flex-1 on right) */}
        <main className="flex-1 flex flex-col justify-between min-h-0 bg-slate-50/70 overflow-x-hidden">
          
          {/* Top subtle workspace alert bar on desktop */}
          <div id="top-admin-banner" className="hidden md:flex bg-slate-900 text-slate-400 text-[10px] py-2 px-8 justify-between items-center border-b border-slate-950 select-none print:hidden shrink-0">
            <div className="flex items-center gap-2 font-mono">
              <Clock className="w-3 h-3 text-teal-400 animate-pulse" />
              <span className="uppercase text-slate-300 font-bold">
                {user.role === 'school_admin' && user.school 
                  ? `UNIT KERJA / SEKOLAH: ${user.school}` 
                  : "SISTEM INFORMASI KONVERSI ANGKA KREDIT PENDIDIK & TENAGA KEPENDIDIKAN"}
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[9px]">
              <span className="text-emerald-400 font-bold">{user.displayName || user.username}</span>
              <span>•</span>
              <span>KCD Wil. XIII Ciamis Pangandaran Banjar</span>
              <div className="h-3.5 w-px bg-slate-750"></div>
              {/* Theme Toggle Button (Icon Only) */}
              <button
                type="button"
                onClick={toggleTheme}
                title={theme === 'dark' ? "Mode Terang (Light Mode)" : "Mode Gelap (Dark Mode)"}
                className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-300" />}
              </button>
              {/* Fullscreen Toggle Button (Icon Only) */}
              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Keluar Layar Penuh (Esc)" : "Layar Penuh (Fullscreen)"}
                className="p-1 text-slate-400 hover:text-teal-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                aria-label="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-teal-400" /> : <Maximize className="w-3.5 h-3.5 text-slate-300" />}
              </button>
            </div>
          </div>

          {/* Main workspace frame containing dynamic views */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 w-full max-w-7xl mx-auto space-y-6">

          {adminView === "teachers" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-teal-600 tracking-wider">Si-KAPITA Hub</span>
                    {user.role === 'school_admin' && user.school && (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase border border-emerald-300">
                        🏫 {user.school}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Pangkalan Data PAK Guru & Pengawas</h1>
                  <p className="text-xs text-slate-500">
                    {user.role === 'school_admin' && user.school
                      ? `Menampilkan pangkalan data dan penetapan angka kredit Guru ASN pada ${user.school}.`
                      : "Kelola perhitungan angka kredit dan cetak PAK Jabatan Fungsional Guru & Pengawas Sekolah secara instan."}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setIsAddingTeacher(!isAddingTeacher);
                      setIsImporting(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> DAFTARKAN PEGAWAI BARU
                  </button>

                  <button
                    onClick={() => {
                      setIsImporting(!isImporting);
                      setIsAddingTeacher(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" /> IMPORT DATA (CSV)
                  </button>

                  <button
                    onClick={handleExportTeachersToCSV}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> EKSPORT SEMUA (.CSV)
                  </button>

                  {teachers.length === 0 && (
                    <button
                      onClick={handleCreateDemoTeacher}
                      className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-450 text-slate-900 font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" /> KREASI GURU CONTOH
                    </button>
                  )}
                </div>
              </div>

              {/* Import CSV Section */}
              {isImporting && (
                <div className="bg-white border-2 border-emerald-500 p-6 rounded-2xl shadow-md space-y-4 animate-slideDown">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Upload className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-sm font-black text-slate-900 uppercase">Impor Data Guru via CSV</h3>
                    </div>
                    <button 
                      onClick={() => setIsImporting(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Batal
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Anda dapat mengimpor data guru secara massal menggunakan file Excel/CSV (mendukung pemisah koma <code className="px-1 bg-slate-100 rounded">,</code> maupun titik koma <code className="px-1 bg-slate-100 rounded">;</code> dari Excel Indonesia). 
                        Pastikan kolom NIP diformat sebagai <strong>Text</strong> agar tidak berubah menjadi format ilmiah Excel (mis. <code className="px-1 bg-slate-100 rounded">1.98E+17</code>).
                      </p>
                      
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleDownloadTemplateCSV}
                          disabled={isImportingProcessing}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5 text-teal-600" /> Download Template CSV
                        </button>
                      </div>
                    </div>

                    <div className="border border-dashed border-emerald-300 bg-emerald-50/20 p-6 rounded-xl text-center space-y-3 relative hover:bg-emerald-50/50 transition-colors">
                      {isImportingProcessing ? (
                        <>
                          <RefreshCw className="w-8 h-8 text-emerald-600 mx-auto animate-spin" />
                          <div>
                            <span className="text-xs font-bold text-emerald-700 block">
                              Sedang Mengimpor Data Guru{importProgress ? ` (${importProgress.current}/${importProgress.total})` : "..."}
                            </span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">Mohon tunggu hingga proses selesai</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-emerald-500 mx-auto animate-bounce" />
                          <div>
                            <span className="text-xs font-bold text-slate-700 block">Pilih file CSV Guru Anda</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Maksimal ukuran 5MB (.csv)</span>
                          </div>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        disabled={isImportingProcessing}
                        onChange={handleImportCSV}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Form Modal/Section to Add Teacher */}
              {isAddingTeacher && (
                <div className="bg-white border-2 border-teal-500 p-6 rounded-2xl shadow-md space-y-4 animate-slideDown">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-teal-600" />
                      <h3 className="text-sm font-black text-slate-900 uppercase">Formulir Registrasi PNS Baru</h3>
                    </div>
                    <button 
                      onClick={() => setIsAddingTeacher(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Batal
                    </button>
                  </div>

                  <form onSubmit={handleCreateTeacher} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">NAMA LENGKAP (GELAR PENUH)</label>
                      <input
                        type="text"
                        placeholder="Contoh: Drs. HARIS FIRDAUS, M.Pd."
                        value={newTeacherForm.name}
                        onChange={e => setNewTeacherForm({ ...newTeacherForm, name: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">NIP (18 ANGKA)</label>
                      <input
                        type="text"
                        maxLength={18}
                        placeholder="Contoh: 198606192011011001"
                        value={newTeacherForm.nip}
                        onChange={e => setNewTeacherForm({ ...newTeacherForm, nip: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">JENIS JABATAN FUNGSIONAL</label>
                      <select
                        value={newTeacherForm.jabatanFungsional}
                        onChange={e => {
                          const jf = e.target.value as JabatanFungsionalType;
                          setNewTeacherForm({
                            ...newTeacherForm,
                            jabatanFungsional: jf,
                            school: jf === 'Pengawas Sekolah' && !newTeacherForm.school
                              ? 'CABANG DINAS PENDIDIKAN WILAYAH XIII'
                              : (jf === 'Guru' && newTeacherForm.school === 'CABANG DINAS PENDIDIKAN WILAYAH XIII' ? '' : newTeacherForm.school)
                          });
                        }}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500 font-bold text-slate-800 bg-white"
                      >
                        <option value="Guru">Guru</option>
                        <option value="Pengawas Sekolah">Pengawas Sekolah</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        {newTeacherForm.jabatanFungsional === 'Pengawas Sekolah' ? 'UNIT KERJA / KCD / DINAS' : 'UNIT KERJA SEKOLAH'}
                      </label>
                      {user.role === 'school_admin' ? (
                        <input
                          type="text"
                          value={user.school}
                          disabled
                          className="w-full text-xs border border-slate-300 bg-slate-100 rounded-lg p-2.5 text-slate-500 font-bold uppercase"
                        />
                      ) : newTeacherForm.jabatanFungsional === 'Pengawas Sekolah' ? (
                        <input
                          type="text"
                          placeholder="Contoh: CABANG DINAS PENDIDIKAN WILAYAH XIII"
                          value={newTeacherForm.school}
                          onChange={e => setNewTeacherForm({ ...newTeacherForm, school: e.target.value })}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500 uppercase font-bold"
                        />
                      ) : (
                        <SearchableSchoolSelect
                          value={newTeacherForm.school}
                          onChange={val => setNewTeacherForm({ ...newTeacherForm, school: val })}
                          options={schoolsList.map(s => ({ id: s.id, name: s.name, npsn: s.npsn || s.id }))}
                          allowAll={true}
                          allLabel="-- PILIH UNIT KERJA SEKOLAH --"
                          placeholder="Cari & pilih unit kerja..."
                        />
                      )}
                      {user.role === 'super_admin' && newTeacherForm.jabatanFungsional === 'Guru' && schoolsList.length === 0 && (
                        <p className="text-[10px] text-rose-600 mt-1">
                          ⚠️ Belum ada sekolah terdaftar di database. Silakan daftarkan di menu Master Data Sekolah terlebih dahulu.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">NOMOR KARTU PEGAWAI (KARPEG)</label>
                      <input
                        type="text"
                        placeholder="Contoh: B03023705"
                        value={newTeacherForm.karpegNumber}
                        onChange={e => setNewTeacherForm({ ...newTeacherForm, karpegNumber: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">GOLONGAN SAAT INI</label>
                      <select
                        value={newTeacherForm.currentGolongan}
                        onChange={e => {
                          const val = e.target.value as GolonganID;
                          const Bases: Record<string, number> = {
                            'III/a': 100, 'III/b': 150, 'III/c': 200, 'III/d': 300,
                            'IV/a': 400, 'IV/b': 550, 'IV/c': 700, 'IV/d': 850, 'IV/e': 1050
                          };
                          setNewTeacherForm({ 
                            ...newTeacherForm, 
                            currentGolongan: val, 
                            baseAK: Bases[val] || 100
                          });
                        }}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
                      >
                        {GOLONGAN_LIST.map(g => (
                          <option key={g.id} value={g.id}>{g.id} - {g.pangkat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">TARGET GOLONGAN TRANSISI</label>
                      <select
                        value={newTeacherForm.targetGolongan}
                        onChange={e => setNewTeacherForm({ ...newTeacherForm, targetGolongan: e.target.value as GolonganID })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
                      >
                        {GOLONGAN_LIST.map(g => (
                          <option key={g.id} value={g.id}>{g.id} - Himpunan {g.pangkatTarget}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">AK PONDASI TRANSISI</label>
                      <input
                        type="number"
                        step="any"
                        value={newTeacherForm.baseAK}
                        onChange={e => setNewTeacherForm({ ...newTeacherForm, baseAK: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">AK PAK INTEGRASI 2022 (KONVERSI LAMA)</label>
                      <input
                        type="number"
                        step="any"
                        value={newTeacherForm.akIntegrasi2022}
                        onChange={e => setNewTeacherForm({ ...newTeacherForm, akIntegrasi2022: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-teal-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">JENIS KELAMIN</label>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none text-slate-700">
                          <input 
                            type="radio" 
                            name="gender" 
                            checked={newTeacherForm.gender === 'Laki-Laki'} 
                            onChange={() => setNewTeacherForm({ ...newTeacherForm, gender: 'Laki-Laki' })}
                          /> Laki-Laki
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none text-slate-700">
                          <input 
                            type="radio" 
                            name="gender" 
                            checked={newTeacherForm.gender === 'Perempuan'} 
                            onChange={() => setNewTeacherForm({ ...newTeacherForm, gender: 'Perempuan' })}
                          /> Perempuan
                        </label>
                      </div>
                    </div>

                    <div className="md:col-span-3 flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="submit"
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg cursor-pointer"
                      >
                        Simpan & Kelola Guru ➔
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Dynamic Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
                {/* Total Teachers */}
                <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 p-5 rounded-2xl border border-teal-100/70 shadow-xs flex items-center gap-4">
                  <div className="p-3 bg-teal-600 rounded-xl text-white">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-teal-700 uppercase tracking-wider font-mono">Total PNS</span>
                    <h3 className="text-xl font-black text-slate-950 mt-0.5">{stats.total} <span className="text-[11px] text-teal-600 font-bold">Pegawai</span></h3>
                  </div>
                </div>

                {/* Eligible */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 rounded-2xl border border-emerald-100/70 shadow-xs flex items-center gap-4">
                  <div className="p-3 bg-emerald-600 rounded-xl text-white">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider font-mono">Layak Naik Pangkat</span>
                    <h3 className="text-xl font-black text-slate-950 mt-0.5">{stats.eligible} <span className="text-[11px] text-emerald-600 font-bold">Pegawai</span></h3>
                  </div>
                </div>

                {/* Ineligible */}
                <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 rounded-2xl border border-amber-100/70 shadow-xs flex items-center gap-4">
                  <div className="p-3 bg-amber-500 rounded-xl text-white">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider font-mono">Belum Layak</span>
                    <h3 className="text-xl font-black text-slate-950 mt-0.5">{stats.notEligible} <span className="text-[11px] text-amber-600 font-bold">Pegawai</span></h3>
                  </div>
                </div>

                {/* Avg AK */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-5 rounded-2xl border border-indigo-100/70 shadow-xs flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-xl text-white">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider font-mono">Rata-Rata AK</span>
                    <h3 className="text-xl font-black text-slate-950 mt-0.5">{stats.avgAK.toFixed(2)} <span className="text-[11px] text-indigo-600 font-bold">AK</span></h3>
                  </div>
                </div>
              </div>

              {/* Filters & Search Control Panel */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Penyaringan & Sortir Pangkalan Data</span>
                  </div>
                  {(searchQuery || filterSchool || filterJabatan || filterGolongan || filterEligibility || sortBy !== "name_asc") && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setFilterSchool("");
                        setFilterJabatan("");
                        setFilterGolongan("");
                        setFilterEligibility("");
                        setSortBy("name_asc");
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-700 font-black flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 cursor-pointer transition-colors"
                    >
                      RESET SEMUA FILTER
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Search Query */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Pencarian Kata Kunci</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Cari Guru atau Pengawas berdasarkan Nama, NIP, atau Unit Kerja..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-teal-500 focus:bg-white text-slate-800 font-bold"
                      />
                    </div>
                  </div>

                  {/* Filter Jabatan Fungsional */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Jabatan Fungsional</label>
                    <select
                      value={filterJabatan}
                      onChange={e => setFilterJabatan(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs focus:outline-teal-500 focus:bg-white text-slate-700 font-bold"
                    >
                      <option value="">Semua Jabatan (Guru & Pengawas)</option>
                      <option value="Guru">Guru</option>
                      <option value="Pengawas Sekolah">Pengawas Sekolah</option>
                    </select>
                  </div>

                  {/* Filter Sekolah / Unit Kerja */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Unit Kerja / Sekolah</label>
                    {user?.role === 'school_admin' ? (
                      <input
                        type="text"
                        value={user.school || "Sekolah Anda"}
                        disabled
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2.5 px-3 text-xs text-slate-500 font-bold"
                      />
                    ) : (
                      <SearchableSchoolSelect
                        value={filterSchool}
                        onChange={val => setFilterSchool(val)}
                        options={schoolFilterOptions}
                        allowAll={true}
                        allLabel="Semua Unit Kerja"
                        placeholder="Cari & filter unit kerja..."
                      />
                    )}
                  </div>

                  {/* Filter Golongan */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Golongan Aktif</label>
                    <select
                      value={filterGolongan}
                      onChange={e => setFilterGolongan(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs focus:outline-teal-500 focus:bg-white text-slate-700 font-bold"
                    >
                      <option value="">Semua Golongan</option>
                      {GOLONGAN_LIST.map(g => (
                        <option key={g.id} value={g.id}>{g.id} - Himpunan {g.pangkatTarget}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter Status Kelayakan */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Status Kelayakan Kenaikan</label>
                    <select
                      value={filterEligibility}
                      onChange={e => setFilterEligibility(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs focus:outline-teal-500 focus:bg-white text-slate-700 font-bold"
                    >
                      <option value="">Semua Kelayakan</option>
                      <option value="eligible">Layak Naik Pangkat / Jenjang</option>
                      <option value="not_eligible">Belum Layak (Kurang AK)</option>
                    </select>
                  </div>

                  {/* Sort By Choice */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Urutkan Berdasarkan</label>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs focus:outline-teal-500 focus:bg-white text-slate-700 font-bold"
                    >
                      <option value="name_asc">Nama (A-Z)</option>
                      <option value="name_desc">Nama (Z-A)</option>
                      <option value="nip">NIP Pegawai</option>
                      <option value="ak_desc">Angka Kredit Terbanyak</option>
                      <option value="ak_asc">Angka Kredit Tersedikit</option>
                    </select>
                  </div>

                  {/* Export Filtered Buttons */}
                  <div className="flex items-end">
                    {(filterSchool || filterJabatan || filterGolongan || filterEligibility || searchQuery) ? (
                      <button
                        onClick={handleExportTeachersToCSV}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-50 hover:bg-teal-100 text-teal-700 hover:text-teal-800 font-bold text-xs rounded-xl transition-all cursor-pointer border border-teal-150 border-teal-200 shadow-xs"
                      >
                        <Download className="w-4 h-4 text-teal-600" />
                        <span>EKSPORT ({filteredTeachers.length} DATA)</span>
                      </button>
                    ) : (
                      <div className="text-[11px] text-slate-400 font-medium pb-2">
                        💡 Gunakan penyaringan untuk memisahkan Guru & Pengawas.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Control Bar for Admin / School Admin */}
              {user && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">TAMPILAN:</span>
                    <div className="inline-flex bg-slate-200/60 p-1 rounded-lg border border-slate-300/40">
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          viewMode === "grid"
                            ? "bg-white text-teal-700 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Grid / Kartu</span>
                      </button>
                      <button
                        onClick={() => setViewMode("list")}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          viewMode === "list"
                            ? "bg-white text-teal-700 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>Tabel / List</span>
                      </button>
                    </div>
                  </div>

                  {/* Items per Page Selector & Stats */}
                  <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                    <div className="text-[11px] text-slate-500 font-medium">
                      Total: <span className="font-bold text-slate-800">{filteredTeachers.length}</span> Pegawai
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">BARIS PER HALAMAN:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        className="text-xs bg-white border border-slate-300 rounded-lg py-1 px-2.5 focus:outline-teal-500 font-bold text-slate-700"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Database Connection Warning Alert */}
              {dbErrorWarning && (
                <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                        Pemberitahuan Status Database MySQL
                      </h4>
                      <p className="text-xs text-amber-800/90 mt-0.5">{dbErrorWarning}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        loadTeachers();
                        loadSchools();
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Coba Hubungkan Ulang
                    </button>
                    {user.role === 'super_admin' && (
                      <button
                        type="button"
                        onClick={() => setXamppModalOpen(true)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
                      >
                        Cek Kredensial Database
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Teachers list container */}
              {loadingTeachers ? (
                <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full border-t-2 border-l-2 border-teal-600 animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-500">Menghubungkan ke database cloud dan memuat data...</p>
                </div>
              ) : filteredTeachers.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-4 max-w-lg mx-auto">
                  <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <User className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm uppercase">Pangkalan Data Masih Kosong</h3>
                    {searchQuery ? (
                      <p className="text-xs text-slate-500 mt-1">Pencarian untuk "{searchQuery}" tidak menemukan kecocokan di database.</p>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xs text-slate-500 leading-normal mt-1">
                          Belum ada Guru PNS terdaftar untuk sekolah ini. Anda bisa menulis/mendaftarkan Guru PNS baru secara manual menggunakan tombol di atas, atau klik tombol di bawah untuk membuat instansiasi otomatis data contoh Guru Antan Kustiawan untuk pengetesan cepat.
                        </p>
                        <button
                          onClick={handleCreateDemoTeacher}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-450 text-slate-955 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer border border-amber-400"
                        >
                          <Sparkles className="w-4 h-4" /> Instansiasi Otomatis Guru Antan Kustiawan
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {activeViewMode === 'list' ? (
                    /* Beautiful Table View */
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                              <th className="py-3 px-4">Nama Lengkap & NIP</th>
                              <th className="py-3 px-4">Sekolah Unit Kerja</th>
                              <th className="py-3 px-4">Golongan</th>
                              <th className="py-3 px-4">AK Kumulatif</th>
                              <th className="py-3 px-4">Status Kelayakan</th>
                              <th className="py-3 px-4 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {currentTeachers.map((teacher) => {
                              const totalSKP = teacherEvalsCache[teacher.id] || 0;
                              const totalPend = teacherPendCache[teacher.id] || 0;
                              const totalPendidikanAK = sumAK(teacher.akPendidikan || 0, totalPend);
                              const currentTotalAK = sumAK(teacher.akIntegrasi2022 || 0, totalSKP, totalPendidikanAK);

                              const minimalPangkat = getMinimalPangkat(teacher.currentGolongan);
                              const minimalJenjang = getMinimalJenjang(teacher.currentGolongan);

                              const isCrossingJenjang = getTeacherLevel(teacher.currentGolongan) !== getTeacherLevel(teacher.targetGolongan);
                              const targetAK = isCrossingJenjang ? Math.max(minimalPangkat, minimalJenjang) : minimalPangkat;
                              
                              const rawShortfall = subtractAK(targetAK, currentTotalAK);
                              const shortfall = rawShortfall > 0 ? rawShortfall : 0;
                              const isEligible = isCrossingJenjang 
                                ? (isAKGreaterOrEqual(currentTotalAK, minimalPangkat) && isAKGreaterOrEqual(currentTotalAK, minimalJenjang))
                                : isAKGreaterOrEqual(currentTotalAK, minimalPangkat);

                              return (
                                <tr key={teacher.id} className="hover:bg-slate-50/70 transition-colors text-xs">
                                  <td className="py-3 px-4">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="font-bold text-slate-900 leading-tight">{teacher.name}</span>
                                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                        teacher.jabatanFungsional === 'Pengawas Sekolah'
                                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                          : 'bg-teal-50 text-teal-700 border-teal-200'
                                      }`}>
                                        {teacher.jabatanFungsional || 'Guru'}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">NIP: {teacher.nip}</div>
                                  </td>
                                  <td className="py-3 px-4 text-slate-600 font-medium max-w-xs truncate">
                                    {teacher.school || "-"}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 font-mono">
                                      {teacher.currentGolongan} ➔ {teacher.targetGolongan}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-mono font-bold text-slate-800">
                                    {currentTotalAK.toFixed(3)} <span className="text-[10px] text-slate-400 font-normal">/ {targetAK.toFixed(3)}</span>
                                  </td>
                                  <td className="py-3 px-4">
                                    {isEligible ? (
                                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-extrabold px-2 py-1 rounded-md border border-emerald-200 uppercase tracking-tight">
                                        <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>LAYAK {isCrossingJenjang ? "JENJANG" : "PANGKAT"}</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-extrabold px-2 py-1 rounded-md border border-amber-200 uppercase tracking-tight" title={`Kurang ${shortfall.toFixed(3)} AK`}>
                                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span>Kurang {shortfall.toFixed(3)} AK</span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => handleSelectTeacher(teacher)}
                                        className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 hover:text-teal-800 font-bold text-[10px] rounded-lg transition-colors cursor-pointer border border-teal-100"
                                      >
                                        Kelola ➔
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer rounded-lg hover:bg-rose-50"
                                        title="Hapus Guru"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* Original Card Grid View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {currentTeachers.map(teacher => (
                        <div 
                          key={teacher.id} 
                          className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-teal-500 hover:shadow-md transition-all flex flex-col justify-between"
                        >
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`inline-block text-[9px] uppercase font-black px-2 py-0.5 rounded border ${
                                  teacher.jabatanFungsional === 'Pengawas Sekolah'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  {teacher.jabatanFungsional === 'Pengawas Sekolah' ? 'PENGAWAS SEKOLAH' : 'GURU'}
                                </span>
                                <span className="inline-block bg-teal-50 text-teal-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-teal-100 font-mono">
                                  {teacher.currentGolongan} ➔ {teacher.targetGolongan}
                                </span>
                              </div>
                              
                              <button
                                onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                                className="text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Hapus Data"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div>
                              <h3 className="font-bold text-slate-900 text-base leading-tight tracking-tight">{teacher.name}</h3>
                              <p className="text-xs font-mono text-slate-500 mt-0.5">NIP: {teacher.nip}</p>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-lg text-[11px] space-y-1 text-slate-600 font-sans border border-slate-100">
                              <p><strong>Unit Kerja:</strong> {teacher.school || "Instansi belum diatur"}</p>
                              <p><strong>Karpeg:</strong> {teacher.karpegNumber || "-"}</p>
                              <div className="flex gap-4">
                                <p><strong>Integrasi 2022:</strong> {(teacher.akIntegrasi2022 || 0).toFixed(3)} AK</p>
                                {(teacher.akPendidikan || 0) > 0 && (
                                  <p><strong>AK Pendidikan:</strong> {(teacher.akPendidikan || 0).toFixed(3)} AK</p>
                                )}
                              </div>
                            </div>

                            {/* Monitoring Kelayakan Naik Pangkat / Naik Jenjang */}
                            {(() => {
                              const totalSKP = teacherEvalsCache[teacher.id] || 0;
                              const totalPend = teacherPendCache[teacher.id] || 0;
                              const totalPendidikanAK = sumAK(teacher.akPendidikan || 0, totalPend);
                              const currentTotalAK = sumAK(teacher.akIntegrasi2022 || 0, totalSKP, totalPendidikanAK);

                              const minimalPangkat = getMinimalPangkat(teacher.currentGolongan);
                              const minimalJenjang = getMinimalJenjang(teacher.currentGolongan);

                              const isCrossingJenjang = getTeacherLevel(teacher.currentGolongan) !== getTeacherLevel(teacher.targetGolongan);
                              const targetAK = isCrossingJenjang ? Math.max(minimalPangkat, minimalJenjang) : minimalPangkat;
                              
                              const rawShortfall = subtractAK(targetAK, currentTotalAK);
                              const shortfall = rawShortfall > 0 ? rawShortfall : 0;
                              const isEligible = isCrossingJenjang 
                                ? (isAKGreaterOrEqual(currentTotalAK, minimalPangkat) && isAKGreaterOrEqual(currentTotalAK, minimalJenjang))
                                : isAKGreaterOrEqual(currentTotalAK, minimalPangkat);

                              return (
                                <div className="pt-2.5 border-t border-slate-100 space-y-2">
                                  <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className="text-slate-450 text-slate-500 uppercase tracking-wider font-mono">STATUS KELAYAKAN</span>
                                    <span className="bg-slate-100 text-slate-800 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-200">
                                      {currentTotalAK.toFixed(3)} / {targetAK.toFixed(3)} AK
                                    </span>
                                  </div>

                                  {isEligible ? (
                                    <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-emerald-250 border-emerald-200 uppercase tracking-tight">
                                      <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0 animate-pulse" />
                                      <span>
                                        {isCrossingJenjang 
                                          ? "LAYAK NAIK JENJANG & PANGKAT" 
                                          : "LAYAK NAIK PANGKAT"}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg border border-amber-200 uppercase tracking-tight">
                                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span className="truncate">
                                          Belum Layak (Kurang {shortfall.toFixed(3)} AK)
                                        </span>
                                      </div>
                                      {/* Small dynamic progress bar */}
                                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                        <div 
                                          className="bg-amber-500 h-full rounded-full transition-all duration-500"
                                          style={{ width: `${Math.min(100, Math.max(0, (currentTotalAK / targetAK) * 100))}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          <button
                            onClick={() => handleSelectTeacher(teacher)}
                            className="w-full mt-4 flex items-center justify-center gap-2 py-2 px-4 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                          >
                            Kelola Angka Kredit & Cetak PAK ➔
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {hasPagination && totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs mt-6">
                      <div className="text-xs text-slate-500 font-medium">
                        Menampilkan <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> sampai{" "}
                        <span className="font-bold text-slate-800">
                          {Math.min(indexOfLastItem, filteredTeachers.length)}
                        </span>{" "}
                        dari <span className="font-bold text-slate-800">{filteredTeachers.length}</span> guru PNS
                      </div>

                      <div className="flex items-center gap-1.5 self-center sm:self-auto">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={safeCurrentPage === 1}
                          className={`p-1.5 rounded-lg border text-slate-600 transition-colors cursor-pointer ${
                            safeCurrentPage === 1
                              ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
                              : "bg-white border-slate-300 hover:bg-slate-50"
                          }`}
                          title="Halaman Sebelumnya"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        {getPageNumbers().map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all cursor-pointer border ${
                              safeCurrentPage === pageNum
                                ? "bg-teal-600 border-teal-600 text-white shadow-xs"
                                : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                          }`}
                          >
                            {pageNum}
                          </button>
                        ))}

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={safeCurrentPage === totalPages}
                          className={`p-1.5 rounded-lg border text-slate-600 transition-colors cursor-pointer ${
                            safeCurrentPage === totalPages
                              ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
                              : "bg-white border-slate-300 hover:bg-slate-50"
                          }`}
                          title="Halaman Berikutnya"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {adminView === "users" && user.role === "super_admin" && (
            <UserManagementTab />
          )}

          {adminView === "schools" && (
            <SchoolManagementTab userRole={user.role} userSchool={user.school} onSchoolsUpdated={loadSchools} />
          )}

          {adminView === "kop" && (
            <KopAdminTab
              kopSettings={kopSettings}
              setKopSettings={setKopSettings}
              appLogo={appLogo}
              userRole={user.role}
              onOpenLogoModal={user.role === 'super_admin' ? () => {
                setLogoPreviewUrl(null);
                setLogoUploadError(null);
                setCustomLogoUrlInput('');
                setTempLoginLogoHeight(loginLogoHeight);
                setTempSidebarLogoHeight(sidebarLogoHeight);
                setLogoModalOpen(true);
              } : undefined}
            />
          )}

          {adminView === "calculator" && (
            <CalculatorTab />
          )}

          {adminView === "regulations" && (
            <RegulationsTab />
          )}

          {adminView === "logs" && (
            <LoggingManagementTab />
          )}

        </div>

        {/* Footer */}
        <footer className="bg-slate-900 border-t border-slate-950 py-6 px-6 text-center text-xs text-slate-400 select-none shrink-0">
          <p className="font-bold text-slate-300">Si-KAPITA Hub © 2026</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Cabang Dinas Pendidikan Wilayah XIII Provinsi Jawa Barat</p>
        </footer>

        {renderConfirmModals()}
        </main>
      </div>
    );
  }

  // --- AUTHENTICATED: SELECTED TEACHER ACTIVE WORKSPACE ---
  const golonganDetail = GOLONGAN_LIST.find(g => g.id === profile.currentGolongan) || GOLONGAN_LIST[0];
  const targetGolonganDetail = GOLONGAN_LIST.find(g => g.id === profile.targetGolongan) || GOLONGAN_LIST[1];

  // Core calculations linked to MySQL evaluation rows using integer milli-AK
  const totalSKPAC = sumAK(...evaluations.map(item => item.creditEarned || 0));
  const totalPendidikanAK = sumAK(profile.akPendidikan || 0, ...evaluations.map(item => item.akPendidikan || 0));
  const currentTotalAK = sumAK(profile.akIntegrasi2022 || 0, totalSKPAC, totalPendidikanAK);
  
  // Clean, modern alignment with BKN incremental standards
  const targetAK = getMinimalPangkat(profile.currentGolongan);
  
  const rawNeededAK = subtractAK(targetAK, currentTotalAK);
  const neededAK = rawNeededAK > 0 ? rawNeededAK : 0;
  const progressPercent = targetAK > 0 ? Math.min(Math.round((currentTotalAK / targetAK) * 100), 100) : 100;
  const isEligible = isAKGreaterOrEqual(currentTotalAK, targetAK);

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-800 flex flex-col justify-between">
      
      {/* Top Banner Administration Alert */}
      <div id="top-admin-banner-workspace" className="bg-teal-950 text-teal-200 text-[11px] py-2 px-6 flex flex-col sm:flex-row justify-between items-center gap-2 border-b border-teal-900 font-mono select-none print:hidden">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-teal-300 animate-pulse fill-teal-950" />
          <span>PORTAL Si-KAPITA • PEMBANGUNAN DOKUMEN PAK RESMI</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 border-r border-teal-850 pr-3">
            {/* Theme Toggle Button (Icon Only) */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? "Mode Terang (Light Mode)" : "Mode Gelap (Dark Mode)"}
              className="p-1 text-teal-300 hover:text-amber-300 hover:bg-teal-900 rounded-md transition-colors cursor-pointer"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-teal-200" />}
            </button>

            {/* Fullscreen Toggle Button (Icon Only) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Keluar Layar Penuh (Esc)" : "Layar Penuh (Fullscreen)"}
              className="p-1 text-teal-300 hover:text-white hover:bg-teal-900 rounded-md transition-colors cursor-pointer"
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-teal-300" /> : <Maximize className="w-3.5 h-3.5 text-teal-200" />}
            </button>
          </div>

          <span>Petugas: <strong>{user.displayName || user.username}</strong></span>
          <button 
            onClick={handleLogout}
            className="bg-teal-900 hover:bg-teal-850 border border-teal-700 text-teal-300 px-2.5 py-0.5 rounded flex items-center gap-1 cursor-pointer font-bold text-[10px] transition-colors"
          >
            <LogOut className="w-3 h-3" /> Keluar
          </button>
        </div>
      </div>

      {/* Main Structural Framework */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        
        {/* Active Teacher Floating Context Banner */}
        <div className="bg-emerald-800 text-white p-4 rounded-xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-emerald-900 select-none print:hidden">
          <div>
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">
              Sedang Mengelola Data {profile.jabatanFungsional || 'Guru'} PNS:
            </p>
            <h2 className="text-lg font-black tracking-tight">{profile.name}</h2>
            <p className="text-xs font-mono text-emerald-200">
              NIP: {profile.nip} • {profile.school || "Instansi Belum Diatur"} • Tersebar {evaluations.length} E-SKP
            </p>
          </div>
          <button
            onClick={() => setSelectedTeacherId(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black bg-emerald-900 hover:bg-emerald-950 border border-emerald-750 text-white rounded-lg transition-all cursor-pointer shadow-sm"
          >
            ⬅ KEMBALI KE REKAP DATA
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Navigation Sidebar (3 Cols on desktop) */}
          <aside className="lg:col-span-3 space-y-4 print:hidden">
            
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
              {/* Logo area */}
              <div className="flex items-center gap-2.5">
                <div className="bg-teal-600 text-white p-2 rounded-lg font-black text-lg tracking-wider shadow-xs">
                  S
                </div>
                <div>
                  <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">Si-KAPITA KCD XIII</h1>
                  <p className="text-[10px] uppercase font-bold text-slate-400">PNS/ASN Career Tracker</p>
                </div>
              </div>
              
              <p className="text-xs text-slate-500 leading-normal">
                Perhitungan konversi angka kredit otomatis terstruktur yang disesuaikan dengan BKN dan Permenpan RB No. 1/2023.
              </p>
            </div>

            {/* Tab Button list */}
            <nav className="bg-white rounded-xl shadow-xs border border-slate-200 p-2 flex flex-col gap-1">
              <button
                onClick={() => setActiveTab("dashboard")}
                id="sidebar-nav-dashboard"
                className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4" />
                  DASHBOARD RINGKASAN
                </span>
              </button>

              <button
                onClick={() => setActiveTab("activities")}
                id="sidebar-nav-activities"
                className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "activities"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <ClipboardList className="w-4 h-4" />
                  E-SKP EVALUASI LOG
                </span>
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'activities' ? 'bg-teal-700 text-teal-100' : 'bg-slate-100 text-slate-500'}`}>
                  {evaluations.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("pak_report")}
                id="sidebar-nav-pak-report"
                className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "pak_report"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4" />
                  BLANGKO PAK RESMI (3 HAL)
                </span>
                <span className="bg-amber-100/80 text-amber-950 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-200 uppercase select-none">
                  PDF
                </span>
              </button>

              <button
                onClick={() => setActiveTab("calculator")}
                id="sidebar-nav-calculator"
                className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "calculator"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Calculator className="w-4 h-4" />
                  SIMULASI & KALKULATOR
                </span>
              </button>

              <button
                onClick={() => setActiveTab("regulations")}
                id="sidebar-nav-regulations"
                className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "regulations"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4" />
                  PANDUAN & REGULASI BKN
                </span>
              </button>

              <button
                onClick={() => setActiveTab("kop_admin")}
                id="sidebar-nav-kop-admin"
                className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "kop_admin"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-emerald-600" />
                  MENU ADMIN: KOP & LOGO
                </span>
                <span className="bg-rose-100 text-rose-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase select-none">
                  ADMIN
                </span>
              </button>

              {user.role === "super_admin" && (
                <button
                  onClick={() => setActiveTab("user_management")}
                  id="sidebar-nav-user-management"
                  className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "user_management"
                      ? "bg-teal-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-teal-600" />
                    MANAJEMEN PENGGUNA
                  </span>
                  <span className="bg-teal-100 text-teal-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase select-none">
                    SUPER
                  </span>
                </button>
              )}
            </nav>
 
            {/* Quick Actions Panel */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-2 text-xs">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aksi Cepat</span>
              
              <button
                onClick={handlePrint}
                id="print-btn"
                className="w-full flex items-center gap-2 px-3 py-2 border border-slate-250 hover:bg-slate-50 text-slate-700 font-semibold rounded cursor-pointer transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                Cetak Dokumen PAK Resmi
              </button>
            </div>
 
          </aside>
 
          {/* Core Main Area Content Tab rendering (9 Cols on desktop) */}
          <main className="lg:col-span-9 space-y-6">
            
            {/* Active Tab Screen Component */}
            {activeTab === "pak_report" ? (
              <OfficialPAKReport
                profile={profile}
                setProfile={handleProfileChange}
                evaluations={evaluations}
                kopSettings={kopSettings}
                setKopSettings={setKopSettings}
                selectedEvalId={selectedEvalIdForPrint}
                onSelectEvalId={setSelectedEvalIdForPrint}
              />
            ) : (
              <div className="print:hidden">
                {activeTab === "dashboard" && (
                  <DashboardTab
                    profile={profile}
                    setProfile={handleProfileChange}
                    evaluations={evaluations}
                    golonganDetail={golonganDetail}
                    targetGolonganDetail={targetGolonganDetail}
                  />
                )}
                
                {activeTab === "activities" && (
                  <ActivityLogTab
                    evaluations={evaluations}
                    onAddEvaluation={handleAddEvaluation}
                    onUpdateEvaluation={handleUpdateEvaluation}
                    onDeleteEvaluation={handleDeleteEvaluation}
                    onPrintEvaluation={handlePrintEvaluation}
                    currentGolonganLevel={getTeacherLevel(profile.currentGolongan)}
                    profile={profile}
                  />
                )}

                {activeTab === "calculator" && (
                  <CalculatorTab />
                )}

                {activeTab === "regulations" && (
                  <RegulationsTab />
                )}

                {activeTab === "kop_admin" && (
                  <KopAdminTab
                    kopSettings={kopSettings}
                    setKopSettings={setKopSettings}
                    appLogo={appLogo}
                    userRole={user.role}
                    onOpenLogoModal={user.role === 'super_admin' ? () => {
                      setLogoPreviewUrl(null);
                      setLogoUploadError(null);
                      setCustomLogoUrlInput('');
                      setTempLoginLogoHeight(loginLogoHeight);
                      setTempSidebarLogoHeight(sidebarLogoHeight);
                      setLogoModalOpen(true);
                    } : undefined}
                  />
                )}

                {activeTab === "user_management" && user.role === "super_admin" && (
                  <UserManagementTab />
                )}
              </div>
            )}

          </main>

        </div>

      </div>

      {/* Footer copyright info */}
      <footer className="bg-slate-900 border-t border-slate-950 py-6 px-6 text-center text-xs text-slate-400 print:hidden">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <p className="font-bold text-slate-300">Si-KAPITA © 2026</p>
            <p className="text-[10px] text-slate-500 font-medium">Sistem Informasi Konversi Angka Kredit Pendidik & Tenaga Kependidikan - Dinas Pendidikan Provinsi Jawa Barat</p>
          </div>
          <div className="flex gap-4 text-[10px] select-none text-slate-500">
            <span>Buku Pedoman BKN</span>
            <span>•</span>
            <span>Konversi Nilai SKP</span>
            <span>•</span>
            <span>SInep BKN Online</span>
          </div>
        </div>
      </footer>

      {renderConfirmModals()}

      {/* Beautiful Toast Notifications Container */}
      <div className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          let icon = <AlertCircle className="w-4 h-4 text-teal-600 font-bold shrink-0" />;
          let bgColor = "bg-white text-slate-850 border-slate-200";
          let accentColor = "bg-teal-600";
          if (t.type === 'success') {
            icon = <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />;
            bgColor = "bg-emerald-50 text-emerald-950 border-emerald-200";
            accentColor = "bg-emerald-600";
          } else if (t.type === 'error') {
            icon = <AlertCircle className="w-4 h-4 text-rose-650 shrink-0 font-extrabold" />;
            bgColor = "bg-rose-50 text-rose-950 border-rose-200";
            accentColor = "bg-rose-650";
          } else if (t.type === 'warning') {
            icon = <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />;
            bgColor = "bg-amber-50 text-amber-950 border-amber-200";
            accentColor = "bg-amber-650";
          } else if (t.type === 'info') {
            icon = <Award className="w-4 h-4 text-teal-650 shrink-0" />;
            bgColor = "bg-teal-50 text-teal-950 border-teal-200";
            accentColor = "bg-teal-650";
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg ${bgColor} animate-slideIn transition-all duration-300 relative overflow-hidden`}
              style={{
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
              }}
            >
              {/* Visual indicators */}
              <div className="pt-0.5">
                {icon}
              </div>
              
              <div className="flex-1 text-[11px] font-black leading-snug">
                {t.message}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                className="text-slate-450 hover:text-slate-650 cursor-pointer shrink-0 text-[10px] font-bold"
              >
                ✕
              </button>

              {/* Dynamic bottom progress bar */}
              <div 
                className={`absolute bottom-0 left-0 h-0.5 ${accentColor} animate-toastProgress`} 
              />
            </div>
          );
        })}
      </div>

      {/* Stunning SweetAlert Immersive Modal Center Popup */}
      {activeSwal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-all duration-300">
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 text-center border border-slate-100 animate-swalBounce overflow-hidden relative"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            {/* Top illustrative gradient border accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
            
            <div className="mt-4 flex justify-center">
              {activeSwal.icon === 'success' && (
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 animate-swalPulse">
                  <Sparkles className="w-8 h-8 text-emerald-600 animate-pulse" />
                </div>
              )}
              {activeSwal.icon === 'info' && (
                <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center border border-teal-100 animate-swalPulse">
                  <Award className="w-8 h-8 text-teal-650 animate-bounce" />
                </div>
              )}
              {activeSwal.icon === 'warning' && (
                <div className="w-16 h-16 rounded-full bg-amber-55/10 flex items-center justify-center border border-amber-200">
                  <AlertCircle className="w-8 h-8 text-amber-600 animate-bounce" />
                </div>
              )}
              {activeSwal.icon === 'error' && (
                <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
                  <AlertCircle className="w-8 h-8 text-rose-650 animate-pulse" />
                </div>
              )}
            </div>

            <h3 className="mt-5 text-[14px] font-black text-slate-900 uppercase tracking-tight">
              {activeSwal.title}
            </h3>
            
            <p className="mt-3 text-[11px] text-slate-500 font-bold leading-relaxed px-2">
              {activeSwal.text}
            </p>

            <div className="mt-6">
              <button
                onClick={() => setActiveSwal(null)}
                className="w-full py-3 px-5 bg-teal-600 hover:bg-teal-555 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                {activeSwal.confirmButtonText || "OK, SELESAI ➔"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
