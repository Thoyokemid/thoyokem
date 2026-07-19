import { AttendanceImport, AttendanceRecord, AttendanceRecap, LeaveAttendance } from '@/types';
import * as XLSX from 'xlsx';

/**
 * Hitung jumlah hari cuti dari date_from sampai date_end (inklusif).
 */
export function countLeaveDays(leave: LeaveAttendance): number {
  if (!leave.from_date || !leave.to_date) return 1;
  const from = new Date(leave.from_date);
  const end = new Date(leave.to_date);
  if (isNaN(from.getTime()) || isNaN(end.getTime())) return 1;
  const diffMs = end.getTime() - from.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Hitung total hari cuti yang sudah dipakai oleh seorang karyawan.
 * Sick leave tidak dihitung karena tidak memotong kuota cuti.
 */
export function countUsedLeaveDays(
  leaveData: LeaveAttendance[],
  registrationId: string
): number {
  return leaveData
    .filter((l) => l.employee === registrationId && l.leave_type !== 'sick')
    .reduce((sum, l) => sum + countLeaveDays(l), 0);
}

interface ProcessedDay {
  masuk?: string;
  masukTarget?: string;
  pulang?: string;
  pulangTarget?: string;
  keterangan?: string;
}

export interface WorkHourDefaults {
  jamMasuk: string;
  jamPulang: string;
  toleransiMenit?: number;
}

export function processAttendanceData(
  rawData: AttendanceImport[],
  defaults: WorkHourDefaults = { jamMasuk: '08:00', jamPulang: '17:00', toleransiMenit: 0 }
): AttendanceRecord[] {
  const toleransi = defaults.toleransiMenit ?? 0;
  const grouped = new Map<string, Map<string, ProcessedDay>>();

  rawData.forEach((record) => {
    const key = `${record.id}-${record.employee_name}`;
    if (!grouped.has(key)) {
      grouped.set(key, new Map());
    }

    const dateMap = grouped.get(key)!;
    if (!dateMap.has(record.attendance_date)) {
      dateMap.set(record.attendance_date, {});
    }

    const dayRecord = dateMap.get(record.attendance_date)!;

    // Simpan keterangan jika ada
    if (record.remarks) {
      dayRecord.keterangan = record.remarks;
    }

    if (record.tipe_absensi === 'Absensi Masuk') {
      dayRecord.masuk = record.jam_absensi;
      dayRecord.masukTarget = record.jam_set;
    } else if (record.tipe_absensi === 'Absensi Pulang') {
      dayRecord.pulang = record.jam_absensi;
      dayRecord.pulangTarget = record.jam_set;
    }
  });

  const records: AttendanceRecord[] = [];

  rawData.forEach((record) => {
    const key = `${record.id}-${record.employee_name}`;
    const dateMap = grouped.get(key);
    if (!dateMap) return;

    const dayRecord = dateMap.get(record.attendance_date);
    if (!dayRecord) return;

    const existingRecord = records.find(
      (r) => r.id === record.id && r.attendance_date === record.attendance_date
    );

    if (existingRecord) return;

    const jamMasukTarget = dayRecord.masukTarget || defaults.jamMasuk;
    const jamPulangTarget = dayRecord.pulangTarget || defaults.jamPulang;

    let jamMasukActual = '';
    let keterlambatanMenit = 0;
    let keteranganMasuk = '';

    let jamPulangActual = '';
    let overtimeMenit = 0;
    let keteranganPulang = '';

    if (dayRecord.masuk) {
      jamMasukActual = dayRecord.masuk;
      const targetMinutes = timeToMinutes(jamMasukTarget);
      const actualMinutes = timeToMinutes(jamMasukActual);

      if (actualMinutes > targetMinutes + toleransi) {
        keterlambatanMenit = actualMinutes - targetMinutes;
        keteranganMasuk = 'Terlambat';
      } else {
        keteranganMasuk = 'Tepat Waktu';
      }
    }

    if (dayRecord.pulang) {
      jamPulangActual = dayRecord.pulang;
      const targetMinutes = timeToMinutes(jamPulangTarget);
      const actualMinutes = timeToMinutes(jamPulangActual);

      if (actualMinutes > targetMinutes) {
        overtimeMenit = actualMinutes - targetMinutes;
        keteranganPulang = 'Overtime';
      } else {
        keteranganPulang = 'Tepat Waktu';
      }
    } else {
      keteranganPulang = 'Tepat Waktu';
    }

    records.push({
      id: record.id,
      employee_name: record.employee_name,
      designation: record.designation,
      attendance_date: record.attendance_date,
      shift_start: jamMasukTarget,
      in_time: jamMasukActual,
      late_entry_minutes: keterlambatanMenit,
      keterangan_masuk: keteranganMasuk,
      shift_end: jamPulangTarget,
      out_time: jamPulangActual,
      overtime_minutes: overtimeMenit,
      keterangan_pulang: keteranganPulang,
      remarks: dayRecord.keterangan || '',
    });
  });

  return records.sort((a, b) => {
    if (a.employee_name !== b.employee_name) return a.employee_name.localeCompare(b.employee_name);
    return a.attendance_date.localeCompare(b.attendance_date);
  });
}

export function calculateRecap(records: AttendanceRecord[]): AttendanceRecap[] {
  const employeeMap = new Map<string, {
    uniqueDates: Set<string>;
    keterlambatan: number[];
    overtime: number[];
  }>();

  records.forEach((record) => {
    if (!employeeMap.has(record.employee_name)) {
      employeeMap.set(record.employee_name, {
        uniqueDates: new Set(),
        keterlambatan: [],
        overtime: [],
      });
    }

    const empData = employeeMap.get(record.employee_name)!;

    empData.uniqueDates.add(record.attendance_date);

    if (record.late_entry_minutes > 0) {
      empData.keterlambatan.push(record.late_entry_minutes);
    }

    if (record.overtime_minutes > 0) {
      empData.overtime.push(record.overtime_minutes);
    }
  });

  const recap: AttendanceRecap[] = [];

  employeeMap.forEach((data, nama) => {
    const totalKeterlambatan = data.keterlambatan.reduce((sum, val) => sum + val, 0);
    const totalOvertime = data.overtime.reduce((sum, val) => sum + val, 0);

    recap.push({
      nama_karyawan: nama,
      jumlah_hadir: data.uniqueDates.size,
      jumlah_keterlambatan: data.keterlambatan.length,
      total_keterlambatan_menit: totalKeterlambatan,
      average_keterlambatan: data.keterlambatan.length > 0
        ? Math.round(totalKeterlambatan / data.keterlambatan.length)
        : 0,
      jumlah_overtime: data.overtime.length,
      total_overtime_menit: totalOvertime,
      average_overtime: data.overtime.length > 0
        ? Math.round(totalOvertime / data.overtime.length)
        : 0,
    });
  });

  return recap.sort((a, b) => a.nama_karyawan.localeCompare(b.nama_karyawan));
}

/**
 * Convert time string to minutes.
 */
function timeToMinutes(time: string): number {
  if (!time || time.trim() === '') return 0;

  const trimmedTime = time.trim();

  // Excel decimal format (e.g. "0.7083333333")
  if (/^0\.\d+$/.test(trimmedTime)) {
    const decimalValue = parseFloat(trimmedTime);
    if (!isNaN(decimalValue)) {
      return Math.round(decimalValue * 1440);
    }
  }

  // Normalize dot separator to colon (e.g. "8.00" → "8:00")
  let normalizedTime = trimmedTime;
  const dotIndex = trimmedTime.indexOf('.');
  if (dotIndex > 0 && dotIndex <= 2) {
    normalizedTime = trimmedTime.substring(0, dotIndex) + ':' + trimmedTime.substring(dotIndex + 1);
  }

  const parts = normalizedTime.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return hours * 60 + minutes;
    }
  }

  return 0;
}

export function exportToXLSX(records: AttendanceRecord[]): void {
  const exportData = records.map((r) => ({
    'ID': r.id,
    'Nama': r.employee_name,
    'Jabatan': r.designation,
    'Tanggal Absensi': r.attendance_date,
    'Jam Masuk (Target)': r.shift_start,
    'Jam Masuk (Actual)': r.in_time,
    'Keterlambatan (menit)': r.late_entry_minutes,
    'Keterangan Masuk': r.keterangan_masuk,
    'Jam Pulang (Target)': r.shift_end,
    'Jam Pulang (Actual)': r.out_time,
    'Overtime (menit)': r.overtime_minutes,
    'Keterangan Pulang': r.keterangan_pulang,
    'Keterangan': r.remarks,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');

  XLSX.writeFile(workbook, `attendance_report_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Export recap dengan filter tanggal opsional.
 * rawRecords = semua AttendanceRecord (sebelum di-recap), digunakan untuk filter by date.
 * dateFrom & dateTo format: 'YYYY-MM-DD'
 */
export function exportRecapToXLSX(
  allRecords: AttendanceRecord[],
  dateFrom?: string,
  dateTo?: string
): void {
  // Filter records by date range if provided
  let filtered = allRecords;
  if (dateFrom) filtered = filtered.filter((r) => r.attendance_date >= dateFrom);
  if (dateTo) filtered = filtered.filter((r) => r.attendance_date <= dateTo);

  // Re-calculate recap from filtered records
  const recap = calculateRecap(filtered);

  const exportData = recap.map((r) => ({
    'Nama Karyawan': r.nama_karyawan,
    'Jumlah Hadir': r.jumlah_hadir,
    'Jumlah Keterlambatan': r.jumlah_keterlambatan,
    'Total Keterlambatan (Menit)': r.total_keterlambatan_menit,
    'Rata-rata Keterlambatan': r.average_keterlambatan,
    'Jumlah Overtime': r.jumlah_overtime,
    'Total Overtime (Menit)': r.total_overtime_menit,
    'Rata-rata Overtime': r.average_overtime,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Recap');

  const suffix = dateFrom && dateTo
    ? `${dateFrom}_to_${dateTo}`
    : dateFrom
    ? `from_${dateFrom}`
    : dateTo
    ? `to_${dateTo}`
    : new Date().toISOString().split('T')[0];

  XLSX.writeFile(workbook, `attendance_recap_${suffix}.xlsx`);
}