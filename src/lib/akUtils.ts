/**
 * Utilitas perhitungan & pemformatan Angka Kredit (PermenPAN RB No. 1/2023 & Perka BKN No. 3/2023).
 *
 * Menggunakan aritmetika bilangan bulat perseribu (milli-AK) untuk menghilangkan galat
 * floating-point JavaScript (mis. 0.1 + 0.2 = 0.30000000000000004) serta menjamin
 * kesesuaian 100% antara tampilan per baris, total penjumlahan, batas kelayakan,
 * dan tipe DECIMAL(10,3) di database MySQL.
 */

/**
 * Mengurai angka dari input string/number dalam format desimal titik (25.5 / 8.333),
 * format desimal koma Indonesia (25,5 / 8,333), maupun pemisah ribuan (1.050,500 / 1,050.500).
 */
export function parseAKNumber(val: unknown): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }

  let str = String(val).trim().replace(/\s+/g, '');
  if (!str) return 0;

  // Pertahankan tanda negatif di depan bila ada, bersihkan karakter non-angka selain . dan ,
  const isNegative = str.startsWith('-');
  str = str.replace(/[^0-9.,]/g, '');
  if (!str) return 0;

  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Format Indonesia: 1.050,500 -> titik adalah pemisah ribuan, koma adalah desimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Format Internasional: 1,050.500 -> koma adalah pemisah ribuan, titik adalah desimal
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount === 1) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasDot) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    }
  }

  const parsed = parseFloat((isNegative ? '-' : '') + str);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Mengonversi nilai Angka Kredit ke bilangan bulat perseribu (milli-AK)
 * dengan toleransi epsilon untuk menghindari pembulatan turun akibat representasi biner IEEE-754.
 */
export function toMilliAK(val: unknown): number {
  const num = parseAKNumber(val);
  if (num === 0) return 0;
  const absScaled = Math.round(Math.abs(num) * 1000 + 1e-9);
  return num < 0 ? -absScaled : absScaled;
}

/**
 * Membulatkan Angka Kredit tepat hingga 3 angka di belakang koma (standar BKN & DECIMAL(10,3)).
 */
export function roundAK(val: unknown): number {
  return toMilliAK(val) / 1000;
}

/**
 * Menjumlahkan daftar Angka Kredit secara presisi dalam satuan milli-AK (3 desimal).
 * Menjamin jumlah baris pada tabel cetak PAK selalu identik dengan total akhirnya.
 */
export function sumAK(...values: unknown[]): number {
  let totalMilli = 0;
  for (const v of values) {
    totalMilli += toMilliAK(v);
  }
  return totalMilli / 1000;
}

/**
 * Mengurangkan dua nilai Angka Kredit (a - b) secara presisi dalam satuan milli-AK.
 */
export function subtractAK(a: unknown, b: unknown): number {
  return (toMilliAK(a) - toMilliAK(b)) / 1000;
}

/**
 * Membandingkan apakah nilai AK a >= b setelah pembulatan resmi 3 desimal.
 * Mencegah kasus nilai tampil 150,000 tetapi dianggap < 150 karena selisih 0.0001.
 */
export function isAKGreaterOrEqual(a: unknown, b: unknown): boolean {
  return toMilliAK(a) >= toMilliAK(b);
}

/**
 * Memformat Angka Kredit menjadi string 3 desimal (default koma ',' untuk dokumen resmi Indonesia).
 */
export function formatAK(val: unknown, decimals = 3, useComma = true): string {
  const rounded = roundAK(val);
  const formatted = rounded.toFixed(decimals);
  return useComma ? formatted.replace('.', ',') : formatted;
}

/**
 * Memformat angka koefisien tahunan (mis. 12.5 -> "12,5", 25 -> "25", 37.5 -> "37,5")
 * agar konsisten dengan tata tulis desimal koma Indonesia pada blangko resmi.
 */
export function formatCoefficient(val: unknown, useComma = true): string {
  const num = roundAK(val);
  const str = Number.isInteger(num) ? String(num) : String(num);
  return useComma ? str.replace('.', ',') : str;
}
