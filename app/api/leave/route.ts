import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, updateLastActive } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { generateId } from '@/lib/id';
import { LeaveAttendance } from '@/types';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.permissions.leave) {
      return NextResponse.json({ error: 'Forbidden: no leave access' }, { status: 403 });
    }

    updateLastActive(session.user.id);

    const records = await prisma.leaveAttendance.findMany();

    const leaves: LeaveAttendance[] = records.map((r) => ({
      id: r.id,
      employee: r.employee,
      employee_name: r.employeeName,
      from_date: r.fromDate,
      to_date: r.toDate,
      leave_type: r.leaveType,
      attachment: r.attachment || '',
      description: r.description || '',
      created_at: r.createdAt,
      update_at: r.updateAt,
    }));

    return NextResponse.json(leaves);
  } catch (error) {
    console.error('Error fetching leaves:', error);
    return NextResponse.json({ error: 'Failed to fetch leave data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.permissions.leave) {
      return NextResponse.json({ error: 'Forbidden: no leave access' }, { status: 403 });
    }

    updateLastActive(session.user.id);

    const data = await request.json();
    const newId = generateId();
    const now = new Date().toISOString();

    const created = await prisma.leaveAttendance.create({
      data: {
        id: newId,
        employee: data.employee || '',
        employeeName: data.employee_name || '',
        fromDate: data.from_date || '',
        toDate: data.to_date || '',
        leaveType: data.leave_type || '',
        attachment: data.attachment || null,
        createdAt: now,
        updateAt: now,
        description: data.description || null,
      },
    });

    await logActivity({ doctype: 'Leave', documentId: newId, action: 'Created', changedBy: session.user.name || '', before: null, after: created });

    return NextResponse.json({ success: true, id: newId });
  } catch (error) {
    console.error('Error creating leave:', error);
    return NextResponse.json({ error: 'Failed to create leave' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.permissions.leave) {
      return NextResponse.json({ error: 'Forbidden: no leave access' }, { status: 403 });
    }

    updateLastActive(session.user.id);

    const data = await request.json();
    const { id, ...updates } = data;

    const current = await prisma.leaveAttendance.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updated = await prisma.leaveAttendance.update({
      where: { id },
      data: {
        fromDate: updates.from_date || current.fromDate,
        toDate: updates.to_date || current.toDate,
        leaveType: updates.leave_type || current.leaveType,
        attachment: updates.attachment || current.attachment,
        updateAt: now,
        description: updates.description ?? current.description ?? '',
      },
    });

    await logActivity({ doctype: 'Leave', documentId: id, action: 'Updated', changedBy: session.user.name || '', before: current, after: updated });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating leave:', error);
    return NextResponse.json({ error: 'Failed to update leave' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.permissions.leave) {
      return NextResponse.json({ error: 'Forbidden: no leave access' }, { status: 403 });
    }

    updateLastActive(session.user.id);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const existing = await prisma.leaveAttendance.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    await prisma.leaveAttendance.delete({ where: { id } });

    await logActivity({ doctype: 'Leave', documentId: id, action: 'Deleted', changedBy: session.user.name || '', before: null, after: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting leave:', error);
    return NextResponse.json({ error: 'Failed to delete leave' }, { status: 500 });
  }
}
