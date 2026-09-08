# 📘 PANDUAN LENGKAP MENJALANKAN SIPAK-GURU DI LOCALHOST (macOS + XAMPP)

Panduan ini disiapkan khusus untuk memudahkan Anda menjalankan aplikasi **SIPAK-GURU KCD XIII** secara offline/lokal di MacBook / Mac OS Anda menggunakan database MySQL dari **XAMPP**.

---

## 📋 1. Kebutuhan Sistem di Mac
1. **XAMPP for Mac** (sudah terinstal dan modul **MySQL Database** serta **Apache** berstatus *Running*).
2. **Node.js** (versi 18, 20, atau 22 LTS) terinstal di Mac.
   - Periksa di Terminal: `node -v` dan `npm -v`.
   - Jika belum ada, pasang via [nodejs.org](https://nodejs.org) atau `brew install node`.

---

## 🗄️ 2. Nama Database & Tabel yang Dibuat

Nama database default: **`sipak_guru_db`**

Di dalam file **`database.sql`**, terdapat 6 tabel utama yang sudah dirancang sesuai kebutuhan SIPAK-GURU:
| Nama Tabel | Fungsi & Keterangan |
| :--- | :--- |
| **`app_users`** | Menyimpan akun pengguna (Super Admin & Admin Operator Sekolah) |
| **`schools`** | Master data unit kerja / sekolah (NPSN, nama sekolah, kepala sekolah, NIP) |
| **`teachers`** | Profil guru PNS, pangkat/golongan, TMT, nomor SK PAK, dan spesimen TTD/TTE |
| **`evaluations`** | Riwayat penilaian SKP tahunan (2023, 2024, 2025 dst.), koefisien, dan angka kredit |
| **`kop_settings`** | Format KOP surat dinas (Pemerintah Provinsi Jawa Barat / KCD XIII) |
| **`system_logs`** | Catatan audit trail dan log aktivitas aplikasi |

---

## 🚀 3. Langkah-Langkah Konfigurasi Database di XAMPP Mac

### Langkah A: Buka phpMyAdmin
1. Buka aplikasi **XAMPP** di Mac Anda.
2. Di tab **Manage Servers**, pastikan **MySQL Database** dan **Apache Web Server** sudah berwarna hijau (**Running**).
3. Buka browser (Safari / Chrome), lalu ketik:
   ```text
   http://localhost/phpmyadmin
   ```

### Langkah B: Impor File `database.sql`
1. Di phpMyAdmin, klik tab **Import** (Impor) di menu atas.
2. Klik tombol **Choose File** / **Browse...** lalu pilih file **`database.sql`** yang ada di folder proyek ini.
3. Gulir ke bawah dan klik tombol **Import** / **Kirim**.
4. phpMyAdmin akan secara otomatis:
   - Membuat database **`sipak_guru_db`**
   - Membuat ke-6 tabel lengkap dengan indeks dan relasi foreign key
   - Mengisi data awal (akun admin, sekolah contoh, guru contoh Antan Kustiawan).

---

## ⚙️ 4. Konfigurasi File `.env` di Mac

Di dalam folder proyek di Mac Anda, buat atau periksa file **`.env`** (jika belum ada, salin dari `.env.example`).

Isi konfigurasinya sebagai berikut:
```env
# Port aplikasi web
PORT=3000

# Konfigurasi Database MySQL XAMPP di Mac
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=sipak_guru_db
```

> 💡 **Catatan untuk Pengguna XAMPP di Mac**:
> - Username default MySQL XAMPP adalah **`root`**
> - Password default adalah **kosong** (tanpa kata sandi).
> - Jika Anda menggunakan Mac dengan XAMPP-VM (Virtual Machine) dan host `localhost` tidak merespons, coba ganti `DB_HOST=127.0.0.1` atau `DB_HOST=192.168.64.2` sesuai IP XAMPP-VM Anda.

---

## 💻 5. Menjalankan Aplikasi di Mac

1. Buka aplikasi **Terminal** di Mac Anda (`Cmd + Space`, ketik *Terminal*).
2. Masuk ke direktori/folder proyek:
   ```bash
   cd /path/ke/folder/sipak-guru
   ```
3. Pasang seluruh dependensi:
   ```bash
   npm install
   ```
4. Jalankan aplikasi dalam mode development:
   ```bash
   npm run dev
   ```
5. Buka browser Anda dan akses:
   ```text
   http://localhost:3000
   ```

---

## 🔑 6. Akun Bawaan (Default Login)

Setelah database berhasil diimpor, Anda dapat langsung login menggunakan akun berikut:

| Peran (Role) | Username | Password | Keterangan |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin` | `adminpaskonversi` | Akses penuh seluruh sekolah & guru |
| **Admin SMAN 1 Ciamis** | `sman1ciamis` | `sman1ciamis123` | Akses operator sekolah SMAN 1 Ciamis |
| **Admin SMAN 2 Ciamis** | `sman2ciamis` | `sman2ciamis123` | Akses operator sekolah SMAN 2 Ciamis |
| **Admin SMAN 1 Kawali** | `sman1kawali` | `sman1kawali123` | Akses operator sekolah SMAN 1 Kawali |

*(Kata sandi dan username dapat diubah kapan saja melalui menu Manajemen Pengguna di aplikasi).*

---

## 🛠️ 7. Troubleshooting (Kendala Umum di Mac)

1. **MySQL tidak mau Start di XAMPP Mac**:
   - Biasanya karena port 3306 sudah dipakai oleh MySQL bawaan Homebrew atau MariaDB lain.
   - Cek proses yang memakai port 3306 di Terminal:
     ```bash
     sudo lsof -i :3306
     ```
   - Hentikan service MySQL lokal lain jika ada: `brew services stop mysql`.

2. **Koneksi "Access denied for user 'root'@'localhost'"**:
   - Jika MySQL XAMPP Anda diberi password saat instalasi, masukkan password tersebut ke baris `DB_PASSWORD=password_anda` di file `.env`.

3. **Unduh Ulang File SQL**:
   - File `database.sql` selalu tersedia di root folder aplikasi atau dapat diunduh langsung lewat tombol di menu aplikasi.
