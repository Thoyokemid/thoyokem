import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { clearAndWriteSheet, readSheetAsObjects, objectToRow } from '@/lib/sheets';
import { AttendanceImport } from '@/types';

const SHEET = 'attendance_import';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow dashboard OR attendance permission to read attendance data
    if (!session.user.permissions.attendance && !session.user.permissions.dashboard) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { records } = await readSheetAsObjects<any>(SHEET);

    const attendance: AttendanceImport[] = records.map((r) => ({
      cloud_id: r.cloud_id || '',
      id: r.id || '',
      employee_name: r.employee_name || '',
      attendance_date: r.attendance_date || '',
      jam_set: r.jam_set || '',
      jam_absensi: r.jam_absensi || '',
      verifikasi: r.verifikasi || '',
      tipe_absensi: r.tipe_absensi || '',
      designation: r.designation || '',
      branch: r.branch || '',
      remarks: r.remarks || '',
    }));

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.permissions.attendance) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    // Dates in the new import
    const incomingDates = new Set<string>(
      data.map((item: AttendanceImport) => item.attendance_date).filter(Boolean)
    );

    // Read existing data
    const { headers, records: existingData } = await readSheetAsObjects<AttendanceImport>(SHEET);

    // Keep existing rows whose dates are NOT in the incoming data
    const preserved = (existingData as any[]).filter(
      (item) => !incomingDates.has(item.attendance_date)
    );

    // Merge: preserved old data + new data
    const merged = [...preserved, ...data];

    // Sort by attendance_date then employee_name for cleanliness
    merged.sort((a, b) => {
      const dateCmp = a.attendance_date.localeCompare(b.attendance_date);
      return dateCmp !== 0 ? dateCmp : a.employee_name.localeCompare(b.employee_name);
    });

    const values = merged.map((item: AttendanceImport) => objectToRow(headers, item));

    await clearAndWriteSheet(SHEET, values);

    return NextResponse.json({
      success: true,
      count: data.length,
      preserved: preserved.length,
      total: merged.length,
      dates_replaced: Array.from(incomingDates).sort(),
    });
  } catch (error) {
    console.error('Error importing attendance:', error);
    return NextResponse.json({ error: 'Failed to import attendance data' }, { status: 500 });
  }
}
