-- ==============================================================================
-- SIPAK-GURU KCD XIII (Penetapan Angka Kredit Jabatan Fungsional Guru)
-- Database Schema & Initial Data for XAMPP (MySQL / MariaDB) on macOS / Localhost
-- ==============================================================================

-- 1. Buat Database jika belum ada
CREATE DATABASE IF NOT EXISTS `sipak_guru_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `sipak_guru_db`;

-- Set pengaturan sesi
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+07:00";

-- ==============================================================================
-- TABEL 1: app_users (Manajemen Akun Pengguna & Operator Sekolah)
-- ==============================================================================
DROP TABLE IF EXISTS `app_users`;
CREATE TABLE `app_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE COMMENT 'Username unik (huruf kecil)',
  `password` VARCHAR(255) NOT NULL COMMENT 'Kata sandi akun',
  `role` ENUM('super_admin', 'school_admin') NOT NULL DEFAULT 'school_admin' COMMENT 'Hak akses pengguna',
  `school` VARCHAR(255) NOT NULL DEFAULT 'ALL' COMMENT 'Nama sekolah asal atau ALL untuk Dinas',
  `displayName` VARCHAR(255) NOT NULL COMMENT 'Nama tampilan operator/admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABEL 2: schools (Master Data Unit Kerja / Sekolah)
-- ==============================================================================
DROP TABLE IF EXISTS `schools`;
CREATE TABLE `schools` (
  `id` VARCHAR(64) PRIMARY KEY COMMENT 'ID unik sekolah',
  `npsn` VARCHAR(30) NOT NULL UNIQUE COMMENT 'Nomor Pokok Sekolah Nasional',
  `name` VARCHAR(255) NOT NULL COMMENT 'Nama lengkap sekolah/instansi',
  `address` TEXT NULL COMMENT 'Alamat sekolah',
  `city` VARCHAR(100) NULL COMMENT 'Kabupaten / Kota',
  `principalName` VARCHAR(255) NULL COMMENT 'Nama Kepala Sekolah dengan gelar',
  `principalNip` VARCHAR(50) NULL COMMENT 'NIP Kepala Sekolah',
  `principalStatus` ENUM('definitif', 'plt', 'plh') DEFAULT 'definitif' COMMENT 'Status jabatan Kepala Sekolah',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABEL 3: teachers (Data Profil Guru PNS & Riwayat Golongan)
-- ==============================================================================
DROP TABLE IF EXISTS `teachers`;
CREATE TABLE `teachers` (
  `id` VARCHAR(64) PRIMARY KEY COMMENT 'ID unik guru (atau string slug)',
  `name` VARCHAR(255) NOT NULL COMMENT 'Nama lengkap guru beserta gelar akademik',
  `nip` VARCHAR(50) NOT NULL COMMENT '18 digit Nomor Induk Pegawai',
  `school` VARCHAR(255) NOT NULL COMMENT 'Nama sekolah unit kerja saat ini',
  `currentGolongan` VARCHAR(20) NOT NULL DEFAULT 'III/c' COMMENT 'Pangkat / Golongan ruang saat ini (III/a s.d IV/e)',
  `targetGolongan` VARCHAR(20) NOT NULL DEFAULT 'III/d' COMMENT 'Pangkat / Golongan ruang target kenaikan',
  `baseAK` DECIMAL(10, 3) DEFAULT 0.000 COMMENT 'Angka Kredit Pondasi dasar golongan',
  `akIntegrasi2022` DECIMAL(10, 3) DEFAULT 0.000 COMMENT 'Angka Kredit PAK Integrasi 2022',
  `akPendidikan` DECIMAL(10, 3) DEFAULT 0.000 COMMENT 'Angka Kredit peningkatan pendidikan yang belum dinilai',
  `ratingSKP` VARCHAR(50) DEFAULT 'Baik' COMMENT 'Predikat kinerja SKP default',
  `workDurationYears` INT DEFAULT 0 COMMENT 'Estimasi masa kerja golongan (tahun)',
  `karpegNumber` VARCHAR(100) NULL COMMENT 'Nomor Kartu Pegawai (Karpeg)',
  `birthPlaceDate` VARCHAR(255) NULL COMMENT 'Tempat dan tanggal lahir',
  `gender` ENUM('Laki-Laki', 'Perempuan') DEFAULT 'Laki-Laki' COMMENT 'Jenis kelamin',
  `tmtCurrentPangkat` VARCHAR(50) NULL COMMENT 'TMT Pangkat terakhir',
  `tmtCurrentJabatan` VARCHAR(50) NULL COMMENT 'TMT Jabatan terakhir',
  `unitKerja` VARCHAR(255) NULL COMMENT 'Keterangan lengkap unit kerja',
  `instansiBiro` VARCHAR(255) NULL COMMENT 'Instansi induk / biro',
  
  -- Nomor Surat Keputusan Dokumen Resmi PAK
  `nomorSuratKonversi` VARCHAR(255) NULL COMMENT 'Nomor SK Konversi Predikat ke Angka Kredit (Hal 1)',
  `nomorSuratAkumulasi` VARCHAR(255) NULL COMMENT 'Nomor SK Akumulasi Angka Kredit (Hal 2)',
  `nomorSuratPenetapan` VARCHAR(255) NULL COMMENT 'Nomor SK Penetapan Angka Kredit / PAK (Hal 3)',
  `tempatDitetapkan` VARCHAR(100) NULL COMMENT 'Kota tempat penetapan surat (misal: Bandung / Ciamis)',
  `tanggalPenetapan` VARCHAR(100) NULL COMMENT 'Tanggal penetapan resmi',
  
  -- Pejabat Penilai Kinerja
  `pejabatPenilaiTitle` VARCHAR(255) NULL COMMENT 'Jabatan pejabat penilai (misal: KEPALA CABANG DINAS PENDIDIKAN WILAYAH XIII)',
  `pejabatPenilaiInstansi` VARCHAR(255) NULL COMMENT 'Instansi pejabat penilai',
  `pejabatPenilaiNama` VARCHAR(255) NULL COMMENT 'Nama lengkap pejabat penilai beserta gelar',
  `pejabatPenilaiNip` VARCHAR(50) NULL COMMENT 'NIP pejabat penilai',
  `pejabatPenilaiGolongan` VARCHAR(100) NULL COMMENT 'Pangkat/Golongan pejabat penilai',
  `pejabatPenilaiStatus` ENUM('definitif', 'plt', 'plh') DEFAULT 'definitif' COMMENT 'Status definitif/Plt/Plh',
  
  -- Pengaturan Tanda Tangan (TTE atau TTD Basah)
  `signatureType` VARCHAR(50) DEFAULT 'ttd_basah' COMMENT 'Tipe tanda tangan: ttd_basah atau tte',
  `ttdBasahType` VARCHAR(50) DEFAULT 'blank' COMMENT 'blank, upload, atau url',
  `ttdBasahImageUrl` TEXT NULL,
  `ttdBasahImageBase64` LONGTEXT NULL,
  `ttdBasahHeight` INT DEFAULT 64,
  `tteLogoType` VARCHAR(50) DEFAULT 'default',
  `tteLogoUrl` TEXT NULL,
  `tteLogoBase64` LONGTEXT NULL,
  `tteTextHeader` VARCHAR(255) DEFAULT 'Ditandatangani secara elektronik oleh :',
  `tteTextJabatan1` VARCHAR(255) NULL,
  `tteTextJabatan2` VARCHAR(255) NULL,
  
  -- Integrasi Tautan Berkas Cloud
  `skPangkatFileLink` TEXT NULL,
  `pakIntegrasiFileLink` TEXT NULL,
  `ijazahFileLink` TEXT NULL,
  `additionalFileLink` TEXT NULL,
  
  `createdBy` VARCHAR(100) NOT NULL DEFAULT 'admin',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_nip` (`nip`),
  INDEX `idx_school` (`school`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABEL 4: evaluations (Riwayat Evaluasi Kinerja SKP Guru & Angka Kredit)
-- ==============================================================================
DROP TABLE IF EXISTS `evaluations`;
CREATE TABLE `evaluations` (
  `id` VARCHAR(64) PRIMARY KEY COMMENT 'ID unik rekaman evaluasi',
  `teacherId` VARCHAR(64) NOT NULL COMMENT 'Relasi ke tabel teachers.id',
  `year` INT NOT NULL COMMENT 'Tahun penilaian SKP (misal: 2023, 2024, 2025)',
  `period` VARCHAR(100) NOT NULL COMMENT 'Periode SKP (misal: Tahunan, September s.d Desember)',
  `rating` VARCHAR(50) NOT NULL COMMENT 'Predikat kinerja: Sangat Baik, Baik, Cukup, Kurang, Sangat Kurang',
  `level` VARCHAR(50) NOT NULL COMMENT 'Jenjang jabatan: Ahli Pertama, Ahli Muda, Ahli Madya, Ahli Utama',
  `coefficient` DECIMAL(10, 3) NOT NULL COMMENT 'Koefisien dasar tahunan (12.5, 25, 37.5, 50)',
  `multiplier` DECIMAL(5, 2) NOT NULL COMMENT 'Persentase pengali predikat (1.5, 1.0, 0.75, dst)',
  `creditEarned` DECIMAL(10, 3) NOT NULL COMMENT 'Angka kredit yang didapat',
  `akPendidikan` DECIMAL(10, 3) DEFAULT 0.000 COMMENT 'Tambahan AK peningkatan pendidikan pada periode ini',
  `notes` TEXT NULL COMMENT 'Catatan keterangan periode',
  `startDate` VARCHAR(50) NULL COMMENT 'Tanggal mulai penilaian (YYYY-MM-DD)',
  `endDate` VARCHAR(50) NULL COMMENT 'Tanggal selesai penilaian (YYYY-MM-DD)',
  `isCustomRange` TINYINT(1) DEFAULT 0 COMMENT 'Apakah periode proporsional sebagian bulan',
  `customMonths` INT DEFAULT 12 COMMENT 'Jumlah bulan penilaian',
  `skpFileLink` TEXT NULL COMMENT 'Tautan Google Drive SKP',
  `evidenceFileLink` TEXT NULL COMMENT 'Tautan Bukti Dukung',
  `overrideData` LONGTEXT NULL COMMENT 'Data snapshot JSON jika ada perubahan profil saat cetak',
  `createdBy` VARCHAR(100) NOT NULL DEFAULT 'admin',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_teacherId` (`teacherId`),
  INDEX `idx_year` (`year`),
  CONSTRAINT `fk_eval_teacher` FOREIGN KEY (`teacherId`) REFERENCES `teachers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABEL 5: kop_settings (Konfigurasi Kop Surat Dinas & Spesimen Tanda Tangan)
-- ==============================================================================
DROP TABLE IF EXISTS `kop_settings`;
CREATE TABLE `kop_settings` (
  `id` VARCHAR(64) PRIMARY KEY DEFAULT 'default' COMMENT 'ID setting (default atau kop_username)',
  `logoType` VARCHAR(50) DEFAULT 'svg-jabar' COMMENT 'svg-jabar atau url',
  `customLogoUrl` TEXT NULL,
  `row1` VARCHAR(255) DEFAULT 'PEMERINTAH DAERAH PROVINSI JAWA BARAT',
  `row2` VARCHAR(255) DEFAULT 'DINAS PENDIDIKAN',
  `row3` VARCHAR(255) DEFAULT 'Jalan. Dr. Radjiman No. 6 Telp (022) 4264813 Fax. (022) 4264881',
  `row4` VARCHAR(255) DEFAULT 'Website : disdik.jabarprov.go.id',
  `row5` VARCHAR(255) DEFAULT 'e-mail: disdik@jabar.prov.go.id / sekretariatdisdikjabar@gmail.com',
  `row6` VARCHAR(255) DEFAULT 'BANDUNG - 40171',
  `signatureType` VARCHAR(50) DEFAULT 'ttd_basah',
  `ttdBasahType` VARCHAR(50) DEFAULT 'blank',
  `ttdBasahImageUrl` TEXT NULL,
  `ttdBasahImageBase64` LONGTEXT NULL,
  `ttdBasahHeight` INT DEFAULT 64,
  `tteLogoType` VARCHAR(50) DEFAULT 'default',
  `tteLogoUrl` TEXT NULL,
  `tteLogoBase64` LONGTEXT NULL,
  `tteTextHeader` VARCHAR(255) DEFAULT 'Ditandatangani secara elektronik oleh :',
  `tteTextJabatan1` VARCHAR(255) NULL,
  `tteTextJabatan2` VARCHAR(255) NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABEL 6: system_logs (Audit Trail & Log Riwayat Sistem)
-- ==============================================================================
DROP TABLE IF EXISTS `system_logs`;
CREATE TABLE `system_logs` (
  `id` VARCHAR(64) PRIMARY KEY,
  `timestamp` VARCHAR(100) NOT NULL,
  `error` TEXT NOT NULL,
  `operationType` VARCHAR(100) NULL,
  `path` VARCHAR(255) NULL,
  `userId` VARCHAR(100) NULL,
  `email` VARCHAR(100) NULL,
  `browser` TEXT NULL,
  `severity` ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
  `resolved` TINYINT(1) DEFAULT 0,
  `resolutionNotes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- DATA AWAL (SEED DATA)
-- ==============================================================================

-- 1. Akun Pengguna Default
-- Kata sandi admin: adminpaskonversi (bisa diubah dari aplikasi)
INSERT INTO `app_users` (`username`, `password`, `role`, `school`, `displayName`) VALUES
('admin', 'adminpaskonversi', 'super_admin', 'ALL', 'Super Admin Dinas Pendidikan KCD XIII'),
('sman1ciamis', 'sman1ciamis123', 'school_admin', 'SMAN 1 CIAMIS', 'Operator SMAN 1 Ciamis'),
('sman2ciamis', 'sman2ciamis123', 'school_admin', 'SMAN 2 CIAMIS', 'Operator SMAN 2 Ciamis'),
('sman1kawali', 'sman1kawali123', 'school_admin', 'SMAN 1 KAWALI', 'Operator SMAN 1 Kawali')
ON DUPLICATE KEY UPDATE `displayName` = VALUES(`displayName`);

-- 2. Master Data Sekolah
INSERT INTO `schools` (`id`, `npsn`, `name`, `city`, `address`, `principalName`, `principalNip`, `principalStatus`) VALUES
('sman1ciamis', '20211512', 'SMAN 1 CIAMIS', 'Kabupaten Ciamis', 'Jl. Gunung Galunggung No. 37, Ciamis', 'Drs. H. SUHARA, M.Pd.', '196603121992031008', 'definitif'),
('sman2ciamis', '20211513', 'SMAN 2 CIAMIS', 'Kabupaten Ciamis', 'Jl. K.H. Ahmad Dahlan No. 2, Ciamis', 'Drs. ENDANG RAHMAT, M.Pd.', '196805101994121002', 'definitif'),
('sman1kawali', '20211514', 'SMAN 1 KAWALI', 'Kabupaten Ciamis', 'Jl. Poronggol Raya No. 9, Kawali', 'BEBEN HEMARA, S.Pd., M.Pd.', '197204151998021004', 'definitif')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 3. Pengaturan KOP Surat Default
INSERT INTO `kop_settings` (`id`, `logoType`, `customLogoUrl`, `row1`, `row2`, `row3`, `row4`, `row5`, `row6`, `tteLogoType`, `tteTextHeader`) VALUES
('default', 'svg-jabar', '', 'PEMERINTAH DAERAH PROVINSI JAWA BARAT', 'DINAS PENDIDIKAN', 'Jalan. Dr. Radjiman No. 6 Telp (022) 4264813 Fax. (022) 4264881', 'Website : disdik.jabarprov.go.id', 'e-mail: disdik@jabar.prov.go.id / sekretariatdisdikjabar@gmail.com', 'BANDUNG - 40171', 'default', 'Ditandatangani secara elektronik oleh :')
ON DUPLICATE KEY UPDATE `row1` = VALUES(`row1`);

-- 4. Contoh Data Guru PNS (Demo Antan Kustiawan)
INSERT INTO `teachers` (
  `id`, `name`, `nip`, `school`, `currentGolongan`, `targetGolongan`,
  `baseAK`, `akIntegrasi2022`, `akPendidikan`, `ratingSKP`, `workDurationYears`,
  `karpegNumber`, `birthPlaceDate`, `gender`, `tmtCurrentPangkat`, `tmtCurrentJabatan`,
  `unitKerja`, `instansiBiro`, `nomorSuratKonversi`, `nomorSuratAkumulasi`, `nomorSuratPenetapan`,
  `tempatDitetapkan`, `tanggalPenetapan`, `pejabatPenilaiTitle`, `pejabatPenilaiInstansi`,
  `pejabatPenilaiNama`, `pejabatPenilaiNip`, `pejabatPenilaiGolongan`, `pejabatPenilaiStatus`,
  `signatureType`, `createdBy`
) VALUES (
  'demo_antan_kustiawan',
  'ANTAN KUSTIAWAN, S.Pd, M.Pd.',
  '198606192011011001',
  'SMAN 2 CIAMIS',
  'III/c',
  'III/d',
  200.000,
  25.000,
  0.000,
  'Baik',
  3,
  'B03023705',
  'CIAMIS, 19-06-1986',
  'Laki-Laki',
  '01-04-2024',
  '24-08-2023',
  'SMAN 2 CIAMIS KABUPATEN CIAMIS CABANG PENDIDIKAN WILAYAH XIII',
  'PEMERINTAH PROVINSI JAWA BARAT',
  '1523/KPG.03.03/KCD XIII',
  '1524/KPG.03.03/KCD XIII',
  '1525/KPG.03.03/KCD XIII',
  'Bandung',
  '02 April 2026',
  'KEPALA CABANG DINAS PENDIDIKAN WILAYAH XIII',
  'PROVINSI JAWA BARAT',
  'DWI YANTI ESTRININGRUM, S.Sos., M.Pd.',
  '19741212 200212 2 003',
  'Pembina Tk.I',
  'definitif',
  'ttd_basah',
  'admin'
) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 5. Riwayat Evaluasi SKP Guru Contoh
INSERT INTO `evaluations` (
  `id`, `teacherId`, `year`, `period`, `rating`, `level`,
  `coefficient`, `multiplier`, `creditEarned`, `akPendidikan`, `notes`,
  `startDate`, `endDate`, `isCustomRange`, `customMonths`, `createdBy`
) VALUES 
(
  'eval_2023_0',
  'demo_antan_kustiawan',
  2023,
  'September s.d Desember',
  'Baik',
  'Ahli Muda',
  25.000,
  1.00,
  8.333,
  0.000,
  'September s.d Desember (Proporsional 4 bulan)',
  '2023-09-01',
  '2023-12-31',
  1,
  4,
  'admin'
),
(
  'eval_2024_1',
  'demo_antan_kustiawan',
  2024,
  'Tahunan',
  'Baik',
  'Ahli Muda',
  25.000,
  1.00,
  25.000,
  0.000,
  'Januari s.d Desember',
  '2024-01-01',
  '2024-12-31',
  0,
  12,
  'admin'
),
(
  'eval_2025_2',
  'demo_antan_kustiawan',
  2025,
  'Tahunan',
  'Baik',
  'Ahli Muda',
  25.000,
  1.00,
  25.000,
  0.000,
  'Januari s.d Desember',
  '2025-01-01',
  '2025-12-31',
  0,
  12,
  'admin'
) ON DUPLICATE KEY UPDATE `creditEarned` = VALUES(`creditEarned`);

SET FOREIGN_KEY_CHECKS = 1;

-- Selesai. Database siap digunakan di XAMPP MySQL.
