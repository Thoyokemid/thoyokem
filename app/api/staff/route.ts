import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { generateId } from '@/lib/id';
import { StaffList } from '@/types';
import { validate, staffCreateSchema, staffUpdateSchema } from '@/lib/validation';
import { hasDoctypePermission } from '@/lib/permissions';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await hasDoctypePermission(session, 'Staff', 'read'))) {
      return NextResponse.json({ error: 'Forbidden: no staff access' }, { status: 403 });
    }

    const records = await prisma.staffList.findMany();

    const staff: StaffList[] = records.map((r) => ({
      employee_id: r.employeeId,
      user_id: r.userId,
      employee_name: r.employeeName,
      date_of_birth: r.dateOfBirth || '',
      leave_allocation: r.leaveAllocation ?? 12,
    }));

    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: 'Failed to fetch staff data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(await hasDoctypePermission(session, 'Staff', 'create'))) {
      return NextResponse.json({ error: 'Forbidden: no staff access' }, { status: 403 });
    }

    const parsed = validate(staffCreateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const data = parsed.data;
    const newId = generateId();

    const created = await prisma.staffList.create({
      data: {
        employeeId: newId,
        userId: data.user_id || '',
        employeeName: data.employee_name || '',
        dateOfBirth: data.date_of_birth || null,
        leaveAllocation: data.leave_allocation ?? 12,
      },
    });

    await logActivity({ doctype: 'Staff', documentId: newId, action: 'Created', changedBy: session.user.name || '', before: null, after: created });

    return NextResponse.json({ success: true, id: newId });
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(await hasDoctypePermission(session, 'Staff', 'write'))) {
      return NextResponse.json({ error: 'Forbidden: no staff access' }, { status: 403 });
    }

    const parsed = validate(staffUpdateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { employee_id, ...updates } = parsed.data;

    const current = await prisma.staffList.findUnique({ where: { employeeId: employee_id } });
    if (!current) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    const updated = await prisma.staffList.update({
      where: { employeeId: employee_id },
      data: {
        userId: updates.user_id ?? current.userId,
        employeeName: updates.employee_name ?? current.employeeName,
        dateOfBirth: updates.date_of_birth ?? current.dateOfBirth,
        leaveAllocation: updates.leave_allocation ?? current.leaveAllocation,
      },
    });

    await logActivity({ doctype: 'Staff', documentId: employee_id, action: 'Updated', changedBy: session.user.name || '', before: current, after: updated });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(await hasDoctypePermission(session, 'Staff', 'delete'))) {
      return NextResponse.json({ error: 'Forbidden: no staff access' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const existing = await prisma.staffList.findUnique({ where: { employeeId: id } });
    if (!existing) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    await prisma.staffList.delete({ where: { employeeId: id } });

    await logActivity({ doctype: 'Staff', documentId: id, action: 'Deleted', changedBy: session.user.name || '', before: null, after: { employee_id: id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
  }
}
