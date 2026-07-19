import {
  processAttendanceData,
  calculateRecap,
  countLeaveDays,
  countUsedLeaveDays,
} from '@/utils/attendance';
import { AttendanceImport, LeaveAttendance } from '@/types';

function makeImportRow(overrides: Partial<AttendanceImport>): AttendanceImport {
  return {
    cloud_id: 'C1',
    id: '1',
    employee_name: 'Budi',
    attendance_date: '2026-01-05',
    jam_set: '08:00',
    jam_absensi: '08:00',
    verifikasi: 'Vein',
    tipe_absensi: 'Absensi Masuk',
    designation: 'Staff',
    branch: 'Office',
    remarks: '',
    ...overrides,
  };
}

describe('processAttendanceData', () => {
  it('marks on-time entry as "Tepat Waktu" when within tolerance', () => {
    const raw = [makeImportRow({ jam_absensi: '08:00' })];
    const result = processAttendanceData(raw);

    expect(result).toHaveLength(1);
    expect(result[0].keterangan_masuk).toBe('Tepat Waktu');
    expect(result[0].late_entry_minutes).toBe(0);
  });

  it('marks late entry beyond tolerance as "Terlambat" with correct minutes', () => {
    const raw = [makeImportRow({ jam_absensi: '08:19', jam_set: '08:00' })];
    const result = processAttendanceData(raw);

    expect(result[0].keterangan_masuk).toBe('Terlambat');
    expect(result[0].late_entry_minutes).toBe(19);
  });

  it('respects the configured tolerance before marking as late', () => {
    const raw = [makeImportRow({ jam_absensi: '08:05', jam_set: '08:00' })];
    const result = processAttendanceData(raw, { jamMasuk: '08:00', jamPulang: '17:00', toleransiMenit: 10 });

    expect(result[0].keterangan_masuk).toBe('Tepat Waktu');
    expect(result[0].late_entry_minutes).toBe(0);
  });

  it('merges "Absensi Masuk" and "Absensi Pulang" rows for the same person/date into one record', () => {
    const raw = [
      makeImportRow({ tipe_absensi: 'Absensi Masuk', jam_absensi: '08:00', jam_set: '08:00' }),
      makeImportRow({ tipe_absensi: 'Absensi Pulang', jam_absensi: '17:30', jam_set: '17:00' }),
    ];
    const result = processAttendanceData(raw);

    expect(result).toHaveLength(1);
    expect(result[0].in_time).toBe('08:00');
    expect(result[0].out_time).toBe('17:30');
    expect(result[0].overtime_minutes).toBe(30);
    expect(result[0].keterangan_pulang).toBe('Overtime');
  });

  it('carries over remarks from the import row', () => {
    const raw = [makeImportRow({ remarks: 'Izin dokter' })];
    const result = processAttendanceData(raw);

    expect(result[0].remarks).toBe('Izin dokter');
  });
});

describe('calculateRecap', () => {
  it('aggregates attendance count, lateness, and overtime per employee', () => {
    const raw = [
      makeImportRow({ id: '1', employee_name: 'Budi', attendance_date: '2026-01-05', jam_absensi: '08:20', jam_set: '08:00' }),
      makeImportRow({ id: '1', employee_name: 'Budi', attendance_date: '2026-01-06', jam_absensi: '08:00', jam_set: '08:00' }),
    ];
    const processed = processAttendanceData(raw);
    const recap = calculateRecap(processed);

    expect(recap).toHaveLength(1);
    expect(recap[0].nama_karyawan).toBe('Budi');
    expect(recap[0].jumlah_hadir).toBe(2);
    expect(recap[0].jumlah_keterlambatan).toBe(1);
    expect(recap[0].total_keterlambatan_menit).toBe(20);
  });

  it('returns an empty array for empty input', () => {
    expect(calculateRecap([])).toEqual([]);
  });
});

function makeLeave(overrides: Partial<LeaveAttendance>): LeaveAttendance {
  return {
    id: '1',
    employee: 'TYID001',
    employee_name: 'Budi',
    from_date: '2026-01-05',
    to_date: '2026-01-05',
    leave_type: 'annual',
    attachment: '',
    description: '',
    created_at: '',
    update_at: '',
    ...overrides,
  };
}

describe('countLeaveDays', () => {
  it('counts a single-day leave as 1 day', () => {
    const leave = makeLeave({ from_date: '2026-01-05', to_date: '2026-01-05' });
    expect(countLeaveDays(leave)).toBe(1);
  });

  it('counts a multi-day range inclusively', () => {
    const leave = makeLeave({ from_date: '2026-01-05', to_date: '2026-01-07' });
    expect(countLeaveDays(leave)).toBe(3);
  });
});

describe('countUsedLeaveDays', () => {
  it('sums leave days for the given employee, excluding sick leave', () => {
    const leaves = [
      makeLeave({ employee: 'TYID001', leave_type: 'annual', from_date: '2026-01-05', to_date: '2026-01-06' }),
      makeLeave({ employee: 'TYID001', leave_type: 'sick', from_date: '2026-02-01', to_date: '2026-02-03' }),
      makeLeave({ employee: 'TYID002', leave_type: 'annual', from_date: '2026-01-05', to_date: '2026-01-05' }),
    ];

    expect(countUsedLeaveDays(leaves, 'TYID001')).toBe(2);
  });

  it('returns 0 when the employee has no leave records', () => {
    expect(countUsedLeaveDays([], 'TYID999')).toBe(0);
  });
});
