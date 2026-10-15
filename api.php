<?php
/**
 * SIPAK Guru - Backend REST API Bridge for cPanel Apache / PHP
 * Direct MySQL / MariaDB connection matching server.ts behavior
 */

// Error reporting & headers
error_reporting(0);
ini_set('display_errors', '0');

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Read .env if present
$envFile = __DIR__ . '/.env';
$env = [];
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $env[trim($parts[0])] = trim($parts[1]);
        }
    }
}

$dbHost = $env['DB_HOST'] ?? getenv('DB_HOST') ?: 'localhost';
$dbPort = $env['DB_PORT'] ?? getenv('DB_PORT') ?: '3306';
$dbName = $env['DB_NAME'] ?? getenv('DB_NAME') ?: 'yogo_simpak';
$dbUser = $env['DB_USER'] ?? getenv('DB_USER') ?: 'yogo_simpak';
$dbPass = $env['DB_PASSWORD'] ?? getenv('DB_PASSWORD') ?: 'adminkcd13!!';

// PDO Connection
$pdo = null;
$dbError = null;

try {
    $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    $dbError = $e->getMessage();
}

// Function to auto initialize schema if not present
function autoInitDb($pdo) {
    if (!$pdo) return;
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `app_users` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `username` VARCHAR(100) NOT NULL UNIQUE,
                `password` VARCHAR(255) NOT NULL,
                `role` ENUM('super_admin', 'school_admin') NOT NULL DEFAULT 'school_admin',
                `school` VARCHAR(255) NOT NULL DEFAULT 'ALL',
                `displayName` VARCHAR(255) NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `schools` (
                `id` VARCHAR(64) PRIMARY KEY,
                `npsn` VARCHAR(30) NOT NULL UNIQUE,
                `name` VARCHAR(255) NOT NULL,
                `address` TEXT NULL,
                `city` VARCHAR(100) NULL,
                `principalName` VARCHAR(255) NULL,
                `principalNip` VARCHAR(50) NULL,
                `principalStatus` ENUM('definitif', 'plt', 'plh') DEFAULT 'definitif',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `teachers` (
                `id` VARCHAR(64) PRIMARY KEY,
                `name` VARCHAR(255) NOT NULL,
                `nip` VARCHAR(50) NOT NULL,
                `school` VARCHAR(255) NOT NULL,
                `currentGolongan` VARCHAR(20) NOT NULL DEFAULT 'III/c',
                `targetGolongan` VARCHAR(20) NOT NULL DEFAULT 'III/d',
                `baseAK` DECIMAL(10, 3) DEFAULT 0.000,
                `akIntegrasi2022` DECIMAL(10, 3) DEFAULT 0.000,
                `akPendidikan` DECIMAL(10, 3) DEFAULT 0.000,
                `ratingSKP` VARCHAR(50) DEFAULT 'Baik',
                `workDurationYears` INT DEFAULT 0,
                `karpegNumber` VARCHAR(100) NULL,
                `birthPlaceDate` VARCHAR(255) NULL,
                `gender` ENUM('Laki-Laki', 'Perempuan') DEFAULT 'Laki-Laki',
                `tmtCurrentPangkat` VARCHAR(50) NULL,
                `tmtCurrentJabatan` VARCHAR(50) NULL,
                `unitKerja` VARCHAR(255) NULL,
                `instansiBiro` VARCHAR(255) NULL,
                `nomorSuratKonversi` VARCHAR(255) NULL,
                `nomorSuratAkumulasi` VARCHAR(255) NULL,
                `nomorSuratPenetapan` VARCHAR(255) NULL,
                `tempatDitetapkan` VARCHAR(100) NULL,
                `tanggalPenetapan` VARCHAR(100) NULL,
                `pejabatPenilaiTitle` VARCHAR(255) NULL,
                `pejabatPenilaiInstansi` VARCHAR(255) NULL,
                `pejabatPenilaiNama` VARCHAR(255) NULL,
                `pejabatPenilaiNip` VARCHAR(50) NULL,
                `pejabatPenilaiGolongan` VARCHAR(100) NULL,
                `pejabatPenilaiStatus` ENUM('definitif', 'plt', 'plh') DEFAULT 'definitif',
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
                `skPangkatFileLink` TEXT NULL,
                `pakIntegrasiFileLink` TEXT NULL,
                `ijazahFileLink` TEXT NULL,
                `additionalFileLink` TEXT NULL,
                `createdBy` VARCHAR(100) DEFAULT 'admin',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `evaluations` (
                `id` VARCHAR(64) PRIMARY KEY,
                `teacherId` VARCHAR(64) NOT NULL,
                `year` INT NOT NULL,
                `period` VARCHAR(100) DEFAULT 'Tahunan',
                `rating` VARCHAR(50) NOT NULL DEFAULT 'Baik',
                `level` VARCHAR(50) NOT NULL DEFAULT 'Ahli Muda',
                `coefficient` DECIMAL(10, 3) DEFAULT 25.000,
                `multiplier` DECIMAL(5, 2) DEFAULT 1.00,
                `creditEarned` DECIMAL(10, 3) DEFAULT 25.000,
                `akPendidikan` DECIMAL(10, 3) DEFAULT 0.000,
                `notes` TEXT NULL,
                `startDate` VARCHAR(50) NULL,
                `endDate` VARCHAR(50) NULL,
                `isCustomRange` TINYINT(1) DEFAULT 0,
                `customMonths` INT DEFAULT 12,
                `skpFileLink` TEXT NULL,
                `evidenceFileLink` TEXT NULL,
                `overrideData` LONGTEXT NULL,
                `createdBy` VARCHAR(100) DEFAULT 'admin',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `kop_settings` (
                `id` VARCHAR(32) PRIMARY KEY DEFAULT 'default',
                `logoType` VARCHAR(50) DEFAULT 'svg-jabar',
                `customLogoUrl` TEXT NULL,
                `row1` VARCHAR(255) DEFAULT 'PEMERINTAH DAERAH PROVINSI JAWA BARAT',
                `row2` VARCHAR(255) DEFAULT 'DINAS PENDIDIKAN',
                `row3` VARCHAR(255) DEFAULT 'CABANG DINAS PENDIDIKAN WILAYAH XIII',
                `row4` VARCHAR(255) DEFAULT 'Jalan Sukasenang No. 34 Telp./Fax (0265) 773123 Ciamis',
                `row5` VARCHAR(255) DEFAULT 'e-mail: cabdinwil13@gmail.com',
                `row6` VARCHAR(255) DEFAULT 'CIAMIS - 46211',
                `signatureType` VARCHAR(50) DEFAULT 'ttd_basah',
                `ttdBasahType` VARCHAR(50) DEFAULT 'blank',
                `ttdBasahImageUrl` TEXT NULL,
                `ttdBasahImageBase64` LONGTEXT NULL,
                `ttdBasahHeight` INT DEFAULT 64,
                `tteLogoType` VARCHAR(50) DEFAULT 'default',
                `tteLogoUrl` TEXT NULL,
                `tteLogoBase64` LONGTEXT NULL,
                `tteTextHeader` VARCHAR(255) DEFAULT 'Ditandatangani secara elektronik oleh :',
                `tteTextJabatan1` VARCHAR(255) DEFAULT 'KEPALA CABANG DINAS PENDIDIKAN WILAYAH XIII',
                `tteTextJabatan2` VARCHAR(255) DEFAULT 'DINAS PENDIDIKAN PROVINSI JAWA BARAT',
                `appLogoUrl` LONGTEXT NULL,
                `loginLogoHeight` INT DEFAULT 120,
                `sidebarLogoHeight` INT DEFAULT 64,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `system_logs` (
                `id` VARCHAR(64) PRIMARY KEY,
                `timestamp` VARCHAR(50) NOT NULL,
                `error` TEXT NOT NULL,
                `operationType` VARCHAR(50) DEFAULT 'general',
                `path` TEXT NULL,
                `userId` VARCHAR(100) NULL,
                `email` VARCHAR(100) NULL,
                `browser` TEXT NULL,
                `severity` ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
                `resolved` TINYINT(1) DEFAULT 0,
                `resolutionNotes` TEXT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        try {
            $pdo->exec("ALTER TABLE `kop_settings` ADD COLUMN `appLogoUrl` LONGTEXT NULL");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE `kop_settings` ADD COLUMN `loginLogoHeight` INT DEFAULT 120");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE `kop_settings` ADD COLUMN `sidebarLogoHeight` INT DEFAULT 64");
        } catch (Exception $e) {}

        // Seed users if empty
        $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM `app_users`");
        $cnt = $stmt->fetch()['cnt'] ?? 0;
        if ($cnt == 0) {
            $pdo->exec("
                INSERT INTO `app_users` (username, password, role, school, displayName) VALUES
                ('admin', 'adminpaskonversi', 'super_admin', 'ALL', 'Super Admin Dinas Pendidikan KCD XIII'),
                ('admin123', 'admin123', 'super_admin', 'ALL', 'Admin Utama'),
                ('sman2ciamis', 'sman2ciamis123', 'school_admin', 'SMAN 2 CIAMIS', 'Operator SMAN 2 Ciamis'),
                ('sman1ciamis', 'sman1ciamis123', 'school_admin', 'SMAN 1 CIAMIS', 'Operator SMAN 1 Ciamis')
            ");
        }

        // Seed schools if empty
        $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM `schools`");
        $cnt = $stmt->fetch()['cnt'] ?? 0;
        if ($cnt == 0) {
            $pdo->exec("
                INSERT INTO `schools` (id, npsn, name, city, address, principalName, principalNip, principalStatus) VALUES
                ('20211516', '20211516', 'SMAN 1 CIAMIS', 'Kabupaten Ciamis', 'Jl. Gunung Galunggung No. 37 Ciamis', 'Drs. H. Suarman Marks, M.Pd.', '196504121990031008', 'definitif'),
                ('20211517', '20211517', 'SMAN 2 CIAMIS', 'Kabupaten Ciamis', 'Jl. K.H. Ahmad Dahlan No. 2 Ciamis', 'Drs. H. Wawan Suwandi, M.Pd.', '196705151992031005', 'definitif'),
                ('20211518', '20211518', 'SMAN 1 BANJAR', 'Kota Banjar', 'Jl. K.H. Mustofa No. 1 Banjar', 'H. Agus Surtiawan, S.Pd., M.Pd.', '196811201994031004', 'definitif'),
                ('20211519', '20211519', 'SMAN 1 PANGANDARAN', 'Kabupaten Pangandaran', 'Jl. Babakan Pangandaran', 'Drs. H. Sukirman, M.Pd.', '196608101991031010', 'definitif')
            ");
        }
    } catch (Exception $e) {
        // Silently continue
    }
}

if ($pdo) {
    autoInitDb($pdo);
}

// Route extraction
$route = $_GET['route'] ?? '';
if (!$route) {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $route = preg_replace('#^.*?api/#i', '', $uri);
}
$route = trim($route, '/');
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

header('Content-Type: application/json; charset=utf-8');

// ============================================================================
// ROUTING
// ============================================================================

// 1. Health check
if ($route === 'health') {
    echo json_encode(['status' => 'healthy', 'timestamp' => date('c'), 'engine' => 'PHP/cPanel']);
    exit;
}

// 2. DB Status
if ($route === 'db-status') {
    if ($pdo) {
        $tables = [];
        try {
            $stmt = $pdo->query("SHOW TABLES");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        } catch (Exception $e) {}
        echo json_encode([
            'connected' => true,
            'host' => $dbHost,
            'port' => (int)$dbPort,
            'database' => $dbName,
            'user' => $dbUser,
            'message' => 'Terkoneksi ke Database MySQL cPanel (' . count($tables) . ' tabel aktif)',
            'tables' => $tables,
            'tablesCount' => count($tables),
            'timestamp' => date('c')
        ]);
    } else {
        echo json_encode([
            'connected' => false,
            'host' => $dbHost,
            'port' => (int)$dbPort,
            'database' => $dbName,
            'user' => $dbUser,
            'message' => 'Gagal terkoneksi ke MySQL: ' . $dbError,
            'tables' => [],
            'tablesCount' => 0,
            'timestamp' => date('c')
        ]);
    }
    exit;
}

// 3. Download SQL
if ($route === 'download-sql') {
    $sqlFile = __DIR__ . '/database.sql';
    if (file_exists($sqlFile)) {
        header('Content-Type: application/sql');
        header('Content-Disposition: attachment; filename="sipak_guru_db.sql"');
        readfile($sqlFile);
        exit;
    }
    http_response_code(404);
    echo "SQL file not found.";
    exit;
}

// Fallback if DB not connected
if (!$pdo) {
    http_response_code(500);
    echo json_encode(['error' => 'Database MySQL tidak terhubung: ' . $dbError]);
    exit;
}

// 4. Login
if ($route === 'login' || $route === 'mysql/login') {
    $uName = strtolower(trim($body['username'] ?? ''));
    $pWord = trim($body['password'] ?? '');
    if (!$uName || !$pWord) {
        http_response_code(400);
        echo json_encode(['error' => 'Username dan password harus diisi.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, username, password, role, school, displayName FROM `app_users` WHERE LOWER(`username`) = ? LIMIT 1");
    $stmt->execute([$uName]);
    $u = $stmt->fetch();
    if ($u) {
        if ($u['password'] === $pWord) {
            echo json_encode([
                'success' => true,
                'user' => [
                    'username' => $u['username'],
                    'displayName' => $u['displayName'],
                    'role' => $u['role'],
                    'school' => $u['school']
                ]
            ]);
            exit;
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Kombinasi password yang dimasukkan salah!']);
            exit;
        }
    }
    http_response_code(404);
    echo json_encode(['error' => 'Akun pengguna tidak ditemukan dalam database.']);
    exit;
}

// 5. Teachers
if ($route === 'teachers' || $route === 'mysql/teachers') {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM `teachers` ORDER BY `name` ASC");
        echo json_encode($stmt->fetchAll());
        exit;
    }
    if ($method === 'POST') {
        $t = $body;
        if (empty($t['id']) || empty($t['name']) || empty($t['nip'])) {
            http_response_code(400);
            echo json_encode(['error' => 'ID, Nama, dan NIP guru wajib diisi.']);
            exit;
        }

        $sql = "INSERT INTO `teachers` (
            id, name, nip, school, currentGolongan, targetGolongan,
            baseAK, akIntegrasi2022, akPendidikan, ratingSKP, workDurationYears,
            karpegNumber, birthPlaceDate, gender, tmtCurrentPangkat, tmtCurrentJabatan,
            unitKerja, instansiBiro, nomorSuratKonversi, nomorSuratAkumulasi, nomorSuratPenetapan,
            tempatDitetapkan, tanggalPenetapan, pejabatPenilaiTitle, pejabatPenilaiInstansi,
            pejabatPenilaiNama, pejabatPenilaiNip, pejabatPenilaiGolongan, pejabatPenilaiStatus,
            signatureType, ttdBasahType, ttdBasahImageUrl, ttdBasahImageBase64, ttdBasahHeight,
            tteLogoType, tteLogoUrl, tteLogoBase64, tteTextHeader, tteTextJabatan1, tteTextJabatan2,
            skPangkatFileLink, pakIntegrasiFileLink, ijazahFileLink, additionalFileLink, createdBy
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        ) ON DUPLICATE KEY UPDATE
            name = VALUES(name), nip = VALUES(nip), school = VALUES(school),
            currentGolongan = VALUES(currentGolongan), targetGolongan = VALUES(targetGolongan),
            baseAK = VALUES(baseAK), akIntegrasi2022 = VALUES(akIntegrasi2022), akPendidikan = VALUES(akPendidikan),
            ratingSKP = VALUES(ratingSKP), workDurationYears = VALUES(workDurationYears),
            karpegNumber = VALUES(karpegNumber), birthPlaceDate = VALUES(birthPlaceDate), gender = VALUES(gender),
            tmtCurrentPangkat = VALUES(tmtCurrentPangkat), tmtCurrentJabatan = VALUES(tmtCurrentJabatan),
            unitKerja = VALUES(unitKerja), instansiBiro = VALUES(instansiBiro),
            nomorSuratKonversi = VALUES(nomorSuratKonversi), nomorSuratAkumulasi = VALUES(nomorSuratAkumulasi),
            nomorSuratPenetapan = VALUES(nomorSuratPenetapan), tempatDitetapkan = VALUES(tempatDitetapkan),
            tanggalPenetapan = VALUES(tanggalPenetapan), pejabatPenilaiTitle = VALUES(pejabatPenilaiTitle),
            pejabatPenilaiInstansi = VALUES(pejabatPenilaiInstansi), pejabatPenilaiNama = VALUES(pejabatPenilaiNama),
            pejabatPenilaiNip = VALUES(pejabatPenilaiNip), pejabatPenilaiGolongan = VALUES(pejabatPenilaiGolongan),
            pejabatPenilaiStatus = VALUES(pejabatPenilaiStatus), signatureType = VALUES(signatureType),
            ttdBasahType = VALUES(ttdBasahType), ttdBasahImageUrl = VALUES(ttdBasahImageUrl),
            ttdBasahImageBase64 = VALUES(ttdBasahImageBase64), ttdBasahHeight = VALUES(ttdBasahHeight),
            tteLogoType = VALUES(tteLogoType), tteLogoUrl = VALUES(tteLogoUrl), tteLogoBase64 = VALUES(tteLogoBase64),
            tteTextHeader = VALUES(tteTextHeader), tteTextJabatan1 = VALUES(tteTextJabatan1), tteTextJabatan2 = VALUES(tteTextJabatan2),
            skPangkatFileLink = VALUES(skPangkatFileLink), pakIntegrasiFileLink = VALUES(pakIntegrasiFileLink),
            ijazahFileLink = VALUES(ijazahFileLink), additionalFileLink = VALUES(additionalFileLink)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $t['id'], $t['name'], $t['nip'], $t['school'] ?? '', $t['currentGolongan'] ?? 'III/c', $t['targetGolongan'] ?? 'III/d',
            $t['baseAK'] ?? 0, $t['akIntegrasi2022'] ?? 0, $t['akPendidikan'] ?? 0, $t['ratingSKP'] ?? 'Baik', $t['workDurationYears'] ?? 0,
            $t['karpegNumber'] ?? null, $t['birthPlaceDate'] ?? null, $t['gender'] ?? 'Laki-Laki', $t['tmtCurrentPangkat'] ?? null, $t['tmtCurrentJabatan'] ?? null,
            $t['unitKerja'] ?? null, $t['instansiBiro'] ?? null, $t['nomorSuratKonversi'] ?? null, $t['nomorSuratAkumulasi'] ?? null, $t['nomorSuratPenetapan'] ?? null,
            $t['tempatDitetapkan'] ?? null, $t['tanggalPenetapan'] ?? null, $t['pejabatPenilaiTitle'] ?? null, $t['pejabatPenilaiInstansi'] ?? null,
            $t['pejabatPenilaiNama'] ?? null, $t['pejabatPenilaiNip'] ?? null, $t['pejabatPenilaiGolongan'] ?? null, $t['pejabatPenilaiStatus'] ?? 'definitif',
            $t['signatureType'] ?? 'ttd_basah', $t['ttdBasahType'] ?? 'blank', $t['ttdBasahImageUrl'] ?? null, $t['ttdBasahImageBase64'] ?? null, $t['ttdBasahHeight'] ?? 64,
            $t['tteLogoType'] ?? 'default', $t['tteLogoUrl'] ?? null, $t['tteLogoBase64'] ?? null, $t['tteTextHeader'] ?? null, $t['tteTextJabatan1'] ?? null, $t['tteTextJabatan2'] ?? null,
            $t['skPangkatFileLink'] ?? null, $t['pakIntegrasiFileLink'] ?? null, $t['ijazahFileLink'] ?? null, $t['additionalFileLink'] ?? null, $t['createdBy'] ?? 'admin'
        ]);
        echo json_encode(['success' => true, 'id' => $t['id']]);
        exit;
    }
}

// 6. Delete teacher
if (preg_match('#^(teachers|mysql/teachers)/([^/]+)$#', $route, $matches)) {
    $tId = urldecode($matches[2]);
    if ($method === 'DELETE') {
        $pdo->prepare("DELETE FROM `evaluations` WHERE `teacherId` = ?")->execute([$tId]);
        $pdo->prepare("DELETE FROM `teachers` WHERE `id` = ?")->execute([$tId]);
        echo json_encode(['success' => true, 'id' => $tId]);
        exit;
    }
}

// 7. Evaluations for Teacher
if (preg_match('#^(teachers|mysql/teachers)/([^/]+)/evaluations$#', $route, $matches)) {
    $tId = urldecode($matches[2]);
    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT * FROM `evaluations` WHERE `teacherId` = ? ORDER BY `year` ASC");
        $stmt->execute([$tId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            if (!empty($r['overrideData']) && is_string($r['overrideData'])) {
                $dec = json_decode($r['overrideData'], true);
                if ($dec !== null) $r['overrideData'] = $dec;
            }
        }
        echo json_encode($rows);
        exit;
    }
    if ($method === 'POST') {
        $ev = $body;
        if (empty($ev['id'])) {
            $ev['id'] = 'eval_' . ($ev['year'] ?? 2024) . '_' . round(microtime(true) * 1000);
        }
        $overrideStr = !empty($ev['overrideData']) ? (is_string($ev['overrideData']) ? $ev['overrideData'] : json_encode($ev['overrideData'])) : null;

        $sql = "INSERT INTO `evaluations` (
            id, teacherId, year, period, rating, level, coefficient, multiplier,
            creditEarned, akPendidikan, notes, startDate, endDate, isCustomRange,
            customMonths, skpFileLink, evidenceFileLink, overrideData, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            year = VALUES(year), period = VALUES(period), rating = VALUES(rating),
            level = VALUES(level), coefficient = VALUES(coefficient), multiplier = VALUES(multiplier),
            creditEarned = VALUES(creditEarned), akPendidikan = VALUES(akPendidikan), notes = VALUES(notes),
            startDate = VALUES(startDate), endDate = VALUES(endDate), isCustomRange = VALUES(isCustomRange),
            customMonths = VALUES(customMonths), skpFileLink = VALUES(skpFileLink), evidenceFileLink = VALUES(evidenceFileLink),
            overrideData = VALUES(overrideData)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $ev['id'], $tId, $ev['year'] ?? 2024, $ev['period'] ?? 'Tahunan', $ev['rating'] ?? 'Baik', $ev['level'] ?? 'Ahli Muda',
            $ev['coefficient'] ?? 25, $ev['multiplier'] ?? 1, $ev['creditEarned'] ?? 25, $ev['akPendidikan'] ?? 0,
            $ev['notes'] ?? null, $ev['startDate'] ?? null, $ev['endDate'] ?? null, !empty($ev['isCustomRange']) ? 1 : 0,
            $ev['customMonths'] ?? 12, $ev['skpFileLink'] ?? null, $ev['evidenceFileLink'] ?? null,
            $overrideStr, $ev['createdBy'] ?? 'admin'
        ]);
        echo json_encode(['success' => true, 'id' => $ev['id']]);
        exit;
    }
}

// 8. Delete evaluation
if (preg_match('#^(evaluations|mysql/evaluations)/([^/]+)$#', $route, $matches)) {
    $eId = urldecode($matches[2]);
    if ($method === 'DELETE') {
        $pdo->prepare("DELETE FROM `evaluations` WHERE `id` = ?")->execute([$eId]);
        echo json_encode(['success' => true, 'id' => $eId]);
        exit;
    }
}

// 9. Schools
if ($route === 'schools' || $route === 'mysql/schools') {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM `schools` ORDER BY `name` ASC");
        echo json_encode($stmt->fetchAll());
        exit;
    }
    if ($method === 'POST') {
        $s = $body;
        $schoolId = $s['id'] ?? $s['npsn'] ?? '';
        if (!$schoolId || empty($s['name']) || empty($s['npsn'])) {
            http_response_code(400);
            echo json_encode(['error' => 'NPSN dan Nama Sekolah wajib diisi.']);
            exit;
        }

        $sql = "INSERT INTO `schools` (id, npsn, name, city, address, principalName, principalNip, principalStatus)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  npsn = VALUES(npsn), name = VALUES(name), city = VALUES(city),
                  address = VALUES(address), principalName = VALUES(principalName),
                  principalNip = VALUES(principalNip), principalStatus = VALUES(principalStatus)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $schoolId, $s['npsn'], $s['name'], $s['city'] ?? null, $s['address'] ?? null,
            $s['principalName'] ?? null, $s['principalNip'] ?? null, $s['principalStatus'] ?? 'definitif'
        ]);
        echo json_encode(['success' => true, 'id' => $schoolId]);
        exit;
    }
}

if (preg_match('#^(schools|mysql/schools)/([^/]+)$#', $route, $matches)) {
    $sId = urldecode($matches[2]);
    if ($method === 'DELETE') {
        $pdo->prepare("DELETE FROM `schools` WHERE `id` = ? OR `npsn` = ?")->execute([$sId, $sId]);
        echo json_encode(['success' => true, 'id' => $sId]);
        exit;
    }
}

// 10. Users
if ($route === 'users' || $route === 'mysql/users') {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT id, username, password, role, school, displayName, created_at, updated_at FROM `app_users` ORDER BY `displayName` ASC");
        echo json_encode($stmt->fetchAll());
        exit;
    }
    if ($method === 'POST') {
        $u = $body;
        if (empty($u['username']) || empty($u['password'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Username dan password wajib diisi.']);
            exit;
        }
        $sql = "INSERT INTO `app_users` (username, password, role, school, displayName)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  password = VALUES(password), role = VALUES(role),
                  school = VALUES(school), displayName = VALUES(displayName)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $u['username'], $u['password'], $u['role'] ?? 'school_admin', $u['school'] ?? 'ALL', $u['displayName'] ?? $u['username']
        ]);
        echo json_encode(['success' => true, 'username' => $u['username']]);
        exit;
    }
}

if (preg_match('#^(users|mysql/users)/([^/]+)$#', $route, $matches)) {
    $uName = urldecode($matches[2]);
    if ($method === 'DELETE') {
        $pdo->prepare("DELETE FROM `app_users` WHERE `username` = ?")->execute([$uName]);
        echo json_encode(['success' => true, 'username' => $uName]);
        exit;
    }
}

// 11. Kop Settings
if ($route === 'settings/kop' || $route === 'mysql/settings/kop') {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM `kop_settings` WHERE `id` = 'default' LIMIT 1");
        $kop = $stmt->fetch();
        echo json_encode($kop ?: null);
        exit;
    }
    if ($method === 'POST') {
        $k = $body;
        $sql = "INSERT INTO `kop_settings` (
                  id, logoType, customLogoUrl, row1, row2, row3, row4, row5, row6,
                  signatureType, ttdBasahType, ttdBasahImageUrl, ttdBasahImageBase64, ttdBasahHeight,
                  tteLogoType, tteLogoUrl, tteLogoBase64, tteTextHeader, tteTextJabatan1, tteTextJabatan2,
                  appLogoUrl, loginLogoHeight, sidebarLogoHeight
                ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  logoType = VALUES(logoType), customLogoUrl = VALUES(customLogoUrl),
                  row1 = VALUES(row1), row2 = VALUES(row2), row3 = VALUES(row3),
                  row4 = VALUES(row4), row5 = VALUES(row5), row6 = VALUES(row6),
                  signatureType = VALUES(signatureType), ttdBasahType = VALUES(ttdBasahType),
                  ttdBasahImageUrl = VALUES(ttdBasahImageUrl), ttdBasahImageBase64 = VALUES(ttdBasahImageBase64),
                  ttdBasahHeight = VALUES(ttdBasahHeight), tteLogoType = VALUES(tteLogoType),
                  tteLogoUrl = VALUES(tteLogoUrl), tteLogoBase64 = VALUES(tteLogoBase64),
                  tteTextHeader = VALUES(tteTextHeader), tteTextJabatan1 = VALUES(tteTextJabatan1),
                  tteTextJabatan2 = VALUES(tteTextJabatan2),
                  appLogoUrl = VALUES(appLogoUrl),
                  loginLogoHeight = VALUES(loginLogoHeight),
                  sidebarLogoHeight = VALUES(sidebarLogoHeight)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $k['logoType'] ?? 'svg-jabar', $k['customLogoUrl'] ?? null,
            $k['row1'] ?? '', $k['row2'] ?? '', $k['row3'] ?? '', $k['row4'] ?? '', $k['row5'] ?? '', $k['row6'] ?? '',
            $k['signatureType'] ?? 'ttd_basah', $k['ttdBasahType'] ?? 'blank', $k['ttdBasahImageUrl'] ?? null,
            $k['ttdBasahImageBase64'] ?? null, $k['ttdBasahHeight'] ?? 64, $k['tteLogoType'] ?? 'default',
            $k['tteLogoUrl'] ?? null, $k['tteLogoBase64'] ?? null, $k['tteTextHeader'] ?? null,
            $k['tteTextJabatan1'] ?? null, $k['tteTextJabatan2'] ?? null,
            $k['appLogoUrl'] ?? null,
            intval($k['loginLogoHeight'] ?? 120),
            intval($k['sidebarLogoHeight'] ?? 64)
        ]);
        echo json_encode(['success' => true]);
        exit;
    }
}

// 12. System Logs
if ($route === 'logs' || $route === 'mysql/logs') {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM `system_logs` ORDER BY `timestamp` DESC LIMIT 200");
        echo json_encode($stmt->fetchAll());
        exit;
    }
    if ($method === 'POST') {
        $l = $body;
        $id = $l['id'] ?? uniqid('log_', true);
        $sql = "INSERT INTO `system_logs` (id, timestamp, error, operationType, path, userId, email, browser, severity, resolved, resolutionNotes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $id, $l['timestamp'] ?? date('c'), $l['error'] ?? 'Unknown event', $l['operationType'] ?? 'general',
            $l['path'] ?? null, $l['userId'] ?? null, $l['email'] ?? null, $l['browser'] ?? null,
            $l['severity'] ?? 'info', !empty($l['resolved']) ? 1 : 0, $l['resolutionNotes'] ?? null
        ]);
        echo json_encode(['success' => true, 'id' => $id]);
        exit;
    }
    if ($method === 'DELETE') {
        $pdo->query("TRUNCATE TABLE `system_logs`");
        echo json_encode(['success' => true]);
        exit;
    }
}

// 13. Backup Export / Import
if ($route === 'backup/export' || $route === 'mysql/export') {
    $schools = $pdo->query("SELECT * FROM `schools`")->fetchAll();
    $teachers = $pdo->query("SELECT * FROM `teachers`")->fetchAll();
    $evaluations = $pdo->query("SELECT * FROM `evaluations`")->fetchAll();
    $users = $pdo->query("SELECT id, username, password, role, school, displayName FROM `app_users`")->fetchAll();
    $kop = $pdo->query("SELECT * FROM `kop_settings` WHERE `id` = 'default'")->fetch();

    foreach ($teachers as &$t) {
        $t['evaluations'] = array_values(array_filter($evaluations, function($e) use ($t) {
            return $e['teacherId'] === $t['id'];
        }));
    }

    echo json_encode([
        'version' => 'sipak_v2_cpanel_php',
        'timestamp' => date('c'),
        'exportedBy' => 'admin',
        'schools' => $schools,
        'teachers' => $teachers,
        'app_users' => $users,
        'kopSettings' => $kop ?: null
    ]);
    exit;
}

// Unknown route
http_response_code(404);
echo json_encode(['error' => 'API endpoint not found', 'route' => $route]);
