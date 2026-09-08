import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'sipak_db.json');

export interface LocalDbData {
  schools: any[];
  teachers: any[];
  evaluations: any[];
  users: any[];
  kopSettings: any;
  logs: any[];
}

const DEFAULT_DATA: LocalDbData = {
  schools: [
    {
      id: '20211516',
      npsn: '20211516',
      name: 'SMAN 1 CIAMIS',
      city: 'Kabupaten Ciamis',
      address: 'Jl. Gunung Galunggung No. 37 Ciamis',
      principalName: 'Drs. H. Suarman Marks, M.Pd.',
      principalNip: '196504121990031008',
      principalStatus: 'definitif'
    },
    {
      id: '20211517',
      npsn: '20211517',
      name: 'SMAN 2 CIAMIS',
      city: 'Kabupaten Ciamis',
      address: 'Jl. K.H. Ahmad Dahlan No. 2 Ciamis',
      principalName: 'Drs. H. Wawan Suwandi, M.Pd.',
      principalNip: '196705151992031005',
      principalStatus: 'definitif'
    },
    {
      id: '20211518',
      npsn: '20211518',
      name: 'SMAN 1 BANJAR',
      city: 'Kota Banjar',
      address: 'Jl. K.H. Mustofa No. 1 Banjar',
      principalName: 'H. Agus Surtiawan, S.Pd., M.Pd.',
      principalNip: '196811201994031004',
      principalStatus: 'definitif'
    },
    {
      id: '20211519',
      npsn: '20211519',
      name: 'SMAN 1 PANGANDARAN',
      city: 'Kabupaten Pangandaran',
      address: 'Jl. Babakan Pangandaran',
      principalName: 'Drs. H. Sukirman, M.Pd.',
      principalNip: '196608101991031010',
      principalStatus: 'definitif'
    }
  ],
  teachers: [],
  evaluations: [],
  users: [
    {
      username: 'admin',
      password: 'adminpaskonversi',
      role: 'super_admin',
      school: 'ALL',
      displayName: 'Super Admin Dinas Pendidikan KCD XIII'
    },
    {
      username: 'admin123',
      password: 'admin123',
      role: 'super_admin',
      school: 'ALL',
      displayName: 'Admin Utama'
    },
    {
      username: 'sman2ciamis',
      password: 'sman2ciamis123',
      role: 'school_admin',
      school: 'SMAN 2 CIAMIS',
      displayName: 'Operator SMAN 2 Ciamis'
    },
    {
      username: 'sman1ciamis',
      password: 'sman1ciamis123',
      role: 'school_admin',
      school: 'SMAN 1 CIAMIS',
      displayName: 'Operator SMAN 1 Ciamis'
    }
  ],
  kopSettings: {
    id: 'default',
    logoType: 'svg-jabar',
    customLogoUrl: '',
    row1: 'PEMERINTAH DAERAH PROVINSI JAWA BARAT',
    row2: 'DINAS PENDIDIKAN',
    row3: 'CABANG DINAS PENDIDIKAN WILAYAH XIII',
    row4: 'Jalan Sukasenang No. 34 Telp./Fax (0265) 773123 Ciamis',
    row5: 'e-mail: cabdinwil13@gmail.com',
    row6: 'CIAMIS - 46211',
    signatureType: 'ttd_basah',
    ttdBasahType: 'blank',
    tteLogoType: 'default',
    tteTextHeader: 'Ditandatangani secara elektronik oleh :',
    tteTextJabatan1: 'KEPALA CABANG DINAS PENDIDIKAN WILAYAH XIII',
    tteTextJabatan2: 'DINAS PENDIDIKAN PROVINSI JAWA BARAT'
  },
  logs: []
};

/**
 * Ensures data directory and json database file exist.
 */
function ensureStorage(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error ensuring storage directory:', err);
  }
}

export function readLocalDb(): LocalDbData {
  ensureStorage();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_DATA;
  }
}

export function writeLocalDb(data: LocalDbData): void {
  ensureStorage();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing local database file:', e);
  }
}
