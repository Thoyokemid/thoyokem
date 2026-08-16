import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AttendanceImport } from '@/types';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.permissions.attendance) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const records = await prisma.attendanceImport.findMany();

    const attendance: AttendanceImport[] = records.map((r) => ({
      cloud_id: r.cloudId,
      id: r.sourceId,
      employee_name: r.employeeName,
      attendance_date: r.attendanceDate,
      jam_set: r.jamSet,
      jam_absensi: r.jamAbsensi,
      verifikasi: r.verifikasi,
      tipe_absensi: r.tipeAbsensi,
      designation: r.designation,
      branch: r.branch,
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
    const incomingDates = Array.from(
      new Set<string>(data.map((item: AttendanceImport) => item.attendance_date).filter(Boolean))
    );

    const [deleted] = await prisma.$transaction([
      prisma.attendanceImport.deleteMany({ where: { attendanceDate: { in: incomingDates } } }),
      prisma.attendanceImport.createMany({
        data: data.map((item: AttendanceImport) => ({
          cloudId: item.cloud_id || '',
          sourceId: item.id || '',
          employeeName: item.employee_name || '',
          attendanceDate: item.attendance_date || '',
          jamSet: item.jam_set || '',
          jamAbsensi: item.jam_absensi || '',
          verifikasi: item.verifikasi || '',
          tipeAbsensi: item.tipe_absensi || '',
          designation: item.designation || '',
          branch: item.branch || '',
          remarks: item.remarks || null,
        })),
      }),
    ]);

    const total = await prisma.attendanceImport.count();

    return NextResponse.json({
      success: true,
      count: data.length,
      preserved: deleted.count >= 0 ? total - data.length : 0,
      total,
      dates_replaced: incomingDates.sort(),
    });
  } catch (error) {
    console.error('Error importing attendance:', error);
    return NextResponse.json({ error: 'Failed to import attendance data' }, { status: 500 });
  }
}
