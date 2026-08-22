import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Minimal birthday feed for the main dashboard widget — gated only by the
 * generic `dashboard` permission (not `staff`), so it deliberately returns
 * just name + DOB rather than the full staff record `/api/staff` exposes.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user.permissions.dashboard) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const records = await prisma.staffList.findMany({
      where: { dateOfBirth: { not: null } },
      select: { employeeId: true, employeeName: true, dateOfBirth: true },
    });

    const birthdays = records
      .filter((r) => r.dateOfBirth)
      .map((r) => ({
        employee_id: r.employeeId,
        employee_name: r.employeeName,
        date_of_birth: r.dateOfBirth as string,
      }));

    return NextResponse.json(birthdays);
  } catch (error) {
    console.error('Error fetching birthdays:', error);
    return NextResponse.json({ error: 'Failed to fetch birthdays' }, { status: 500 });
  }
}
