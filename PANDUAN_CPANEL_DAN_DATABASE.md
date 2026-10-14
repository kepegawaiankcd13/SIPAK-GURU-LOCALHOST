# PANDUAN LENGKAP DEPLOY SIPAK KE CPANEL HOSTING & SETUP DATABASE MYSQL

Panduan ini disusun langkah demi langkah untuk memastikan aplikasi SIPAK Guru dapat berjalan mulus di hosting cPanel Anda.

---

## 🔍 Mengapa Sebelumnya Gagal di cPanel?

1. **File Startup cPanel:**
   cPanel (menggunakan Phusion Passenger) mencari file startup seperti `app.js` atau `server.js`. Di pembaruan ini, file `app.js` dan `server.js` sudah disiapkan khusus di root project untuk langsung mengeksekusi `dist/server.cjs`.
2. **Kesesuaian Module (ESM/CJS):**
   Sudah diperbaiki penanganan direktori server sehingga tidak ada error `__dirname is not defined` saat dijalankan oleh Node.js hosting.
3. **Database cPanel vs XAMPP Lokal:**
   - Di XAMPP lokal, Anda menggunakan user `root` tanpa password dan bebas membuat database.
   - Di **cPanel Hosting**, nama database dan user **wajib memiliki awalan username cPanel Anda** (contoh: `kcdxiii_sipak` dan `kcdxiii_user`).
   - File `database.sql` sudah kami bersihkan dari perintah `CREATE DATABASE` paksa, sehingga saat di-import di phpMyAdmin cPanel **tidak akan terjadi error `#1044 Access Denied`**.

---

## 📋 LANGKAH 1: Buat Database di cPanel (Waktu: 2 Menit)

1. Login ke akun **cPanel** Anda.
2. Cari dan klik menu **MySQL Databases** (atau **MySQL Database Wizard**).
3. **Buat Database Baru:**
   - Masukkan nama, misal: `sipak` 
   - Hasil namanya akan menjadi: `usernamecpanel_sipak` (catat nama lengkap ini).
   - Klik **Create Database**.
4. **Buat Pengguna Database (Add New User):**
   - Masukkan username, misal: `sipakuser`
   - Hasilnya akan menjadi: `usernamecpanel_sipakuser` (catat nama lengkap ini).
   - Masukkan Password yang kuat (catat password ini).
   - Klik **Create User**.
5. **Hubungkan User ke Database (Add User To Database):**
   - Pilih User dan Database yang baru saja dibuat.
   - Klik **Add**.
   - Centang kotak **ALL PRIVILEGES** (Semua Hak Akses).
   - Klik **Make Changes**.

---

## 📥 LANGKAH 2: Import database.sql di phpMyAdmin cPanel

1. Di cPanel, buka menu **phpMyAdmin**.
2. **PENTING:** Pada panel sebelah kiri, **klik nama database** yang baru saja Anda buat di Langkah 1 (contoh: `usernamecpanel_sipak`).
3. Setelah database terbuka, klik tab **Import** di menu bagian atas.
4. Pada bagian **File to import**, klik **Choose File / Pilih File**, lalu pilih file **`database.sql`** dari project ini.
5. Gulir ke bawah dan klik tombol **Import** (atau **Kirim / Go**).
6. Akan muncul pesan hijau: *"Import has been successfully finished"*. Seluruh 6 tabel (`schools`, `teachers`, `evaluations`, `app_users`, `kop_settings`, `activity_logs`) dan data akun admin awal otomatis siap dipakai!

---

## 📁 LANGKAH 3: Upload & Ekstrak File Project

1. Siapkan file zip project ini (pastikan di dalamnya terdapat folder `dist`, file `app.js`, `server.js`, `package.json`, dll).
2. Di cPanel, buka **File Manager**.
3. Masuk ke folder root domain Anda:
   - Jika domain utama: masuk ke **`public_html`**.
   - Atau jika subdomain: masuk ke folder subdomain yang ditunjuk.
4. Klik tombol **Upload** di bagian atas, pilih file zip project Anda, lalu tunggu hingga 100% hijau.
5. Kembali ke File Manager, klik kanan pada file zip tersebut ➜ Pilih **Extract**.
6. Pastikan file `app.js`, `server.js`, folder `dist`, dan `package.json` berada di dalam folder tersebut.

---

## ⚙️ LANGKAH 4: Konfigurasi "Setup Node.js App" di cPanel

1. Di cPanel, buka menu **Setup Node.js App**.
2. Klik tombol **Create Application** (atau edit aplikasi yang sudah ada).
3. Atur pengaturannya persis seperti ini:
   - **Node.js version:** Pilih **20.x** atau **22.x** (versi LTS terbaru).
   - **Application mode:** Ubah dari *Development* menjadi **Production**.
   - **Application root:** Masukkan folder tempat project diekstrak (contoh: `public_html` atau nama folder Anda).
   - **Application URL:** Pilih domain Anda (contoh: `kcdxiii.my.id`).
   - **Application startup file:** Ketik: **`app.js`** (atau `server.js`).
4. Klik tombol **CREATE** (atau **SAVE** di kanan atas).
5. Setelah tersimpan, cari tombol **Run NPM Install** di halaman tersebut dan klik satu kali. Tunggu 1–2 menit sampai notifikasi instalasi modul selesai.

---

## 🔐 LANGKAH 5: Buat File .env untuk Koneksi Database

1. Kembali ke **File Manager** cPanel, buka folder project Anda.
2. Pastikan opsi *"Show Hidden Files (dotfiles)"* aktif di Settings pojok kanan atas File Manager.
3. Buat file baru dengan nama **`.env`** (jika belum ada) atau klik kanan file `.env` ➜ **Edit**.
4. Isi file `.env` dengan konfigurasi database cPanel Anda:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=usernamecpanel_sipakuser
DB_PASSWORD=password_database_anda
DB_NAME=usernamecpanel_sipak
NODE_ENV=production
```
*(Ganti `DB_USER`, `DB_PASSWORD`, dan `DB_NAME` sesuai data yang Anda buat di Langkah 1).*

5. Klik **Save Changes**.

---

## 🚀 LANGKAH 6: Restart Aplikasi & Selesai!

1. Kembali ke menu **Setup Node.js App** di cPanel.
2. Klik tombol **STOP** (warna merah/oranye), tunggu sekitar 5 detik.
3. Klik tombol **RESTART** (atau **START**).
4. Buka browser Anda menggunakan **Mode Penyamaran / Incognito** (atau tekan `Ctrl + Shift + R` untuk hapus cache):
   👉 **`https://domainanda.com`**

Aplikasi SIPAK Guru Anda sekarang akan langsung aktif, tampil cepat, dan tersambung penuh dengan database MySQL cPanel!

---

### 🔑 Akun Login Bawaan Pertama Kali:
- **Super Admin Cabang Dinas:**  
  Username: `admin`  
  Password: `adminpaskonversi`
- **Operator Sekolah Contoh (SMAN 1 Ciamis):**  
  Username: `sman1ciamis`  
  Password: `sman1ciamis123`
