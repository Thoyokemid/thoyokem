// User Types
export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: string;
  dashboard: boolean;
  attendance: boolean;
  leave: boolean;
  registration_request: boolean;
  setting: boolean;
  last_active?: string;
}

// Registration Types
export interface Registration {
  id: string;
  name: string;
  username: string;
  password: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  update_at: string;
}

// Attendance Types
export interface AttendanceImport {
  cloud_id: string;
  id: string;
  nama: string;
  tanggal_absensi: string;
  jam_set: string;
  jam_absensi: string;
  verifikasi: string;
  tipe_absensi: string;
  jabatan: string;
  kantor: string;
  keterangan: string; // NEW — kolom L di sheet
}

export interface AttendanceRecord {
  id: string;
  nama: string;
  jabatan: string;
  tanggal_absensi: string;
  jam_masuk_target: string;
  jam_masuk_actual: string;
  keterlambatan_menit: number;
  keterangan_masuk: string;
  jam_pulang_target: string;
  jam_pulang_actual: string;
  overtime_menit: number;
  keterangan_pulang: string;
  keterangan: string; // NEW — dari kolom keterangan import
}

export interface AttendanceRecap {
  nama_karyawan: string;
  jumlah_hadir: number;
  jumlah_keterlambatan: number;
  total_keterlambatan_menit: number;
  average_keterlambatan: number;
  jumlah_overtime: number;
  total_overtime_menit: number;
  average_overtime: number;
}

// Leave Types
export interface LeaveAttendance {
  id: string;
  registration_id: string;
  name: string;
  date_from: string;
  date_end: string;
  category: string;
  link_url: string;
  keterangan: string; // NEW — kolom J di sheet
  created_at: string;
  update_at: string;
}

// Staff Types
export interface StaffList {
  id: string;
  registration_id: string;
  name: string;
  birth_date?: string;
  leave_quota?: number;
}

// Session Types
export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: string;
  permissions: {
    dashboard: boolean;
    attendance: boolean;
    leave: boolean;
    registration_request: boolean;
    setting: boolean;
  };
}