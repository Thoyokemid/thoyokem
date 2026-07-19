// Role Types
export interface Role {
  role_id: string;
  role_name: string;
  dashboard: boolean;
  attendance: boolean;
  leave: boolean;
  registration_request: boolean;
  setting: boolean;
  staff: boolean;
}

// User Types
export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: string;
  role_id: string;
  last_active?: string;
  // Profile fields — editable by the user themselves
  photo_url?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  gender?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  bio?: string;
}

// Profile — subset of User that a user can self-edit
export interface UserProfile {
  name: string;
  photo_url?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  gender?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  bio?: string;
}

// Registration Types
export interface Registration {
  id: string;
  name: string;
  email: string;
  password: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  update_at: string;
}

// Attendance Types
export interface AttendanceImport {
  cloud_id: string;
  id: string;
  employee_name: string;
  attendance_date: string;
  jam_set: string;
  jam_absensi: string;
  verifikasi: string;
  tipe_absensi: string;
  designation: string;
  branch: string;
  remarks: string; // NEW — kolom L di sheet
}

export interface AttendanceRecord {
  id: string;
  employee_name: string;
  designation: string;
  attendance_date: string;
  shift_start: string;
  in_time: string;
  late_entry_minutes: number;
  keterangan_masuk: string;
  shift_end: string;
  out_time: string;
  overtime_minutes: number;
  keterangan_pulang: string;
  remarks: string; // NEW — dari kolom keterangan import
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
  employee: string;
  employee_name: string;
  from_date: string;
  to_date: string;
  leave_type: string;
  attachment: string;
  description: string; // NEW — kolom J di sheet
  created_at: string;
  update_at: string;
}

// Staff Types
export interface StaffList {
  employee_id: string;
  user_id: string;
  employee_name: string;
  date_of_birth?: string;
  leave_allocation?: number;
}

// Session Types
export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: string;
  role_id?: string;
  permissions: {
    dashboard: boolean;
    attendance: boolean;
    leave: boolean;
    registration_request: boolean;
    setting: boolean;
    staff: boolean;
  };
}