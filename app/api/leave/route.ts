import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, updateLastActive } from '@/lib/auth';
import { readSheet, appendSheet, writeSheet, deleteRow } from '@/lib/sheets';
import { LeaveAttendance } from '@/types';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow dashboard OR leave permission to read leave data
    if (!session.user.permissions.leave && !session.user.permissions.dashboard) {
      return NextResponse.json({ error: 'Forbidden: no leave access' }, { status: 403 });
    }

    // Update last_active (non-blocking) — only for leave permission users
    if (session.user.permissions.leave) {
      updateLastActive(session.user.id);
    }

    const rows = await readSheet('leave_attendance');

    if (!rows || rows.length < 2) {
      return NextResponse.json([]);
    }

    const leaves: LeaveAttendance[] = rows.slice(1).map((row) => ({
      id: row[0] || '',
      registration_id: row[1] || '',
      name: row[2] || '',
      date_from: row[3] || '',
      date_end: row[4] || '',
      category: row[5] || '',
      link_url: row[6] || '',
      keterangan: row[9] || '',
      created_at: row[7] || '',
      update_at: row[8] || '',
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
    const rows = await readSheet('leave_attendance');
    const newId = rows.length > 1 ? String(rows.length) : '1';
    const now = new Date().toISOString();

    const newLeave = [
      newId,
      data.registration_id || '',
      data.name || '',
      data.date_from || '',
      data.date_end || '',
      data.category || '',
      data.link_url || '',
      now,
      now,
      data.keterangan || '',
    ];

    await appendSheet('leave_attendance', [newLeave]);

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

    const rows = await readSheet('leave_attendance');
    const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    rows[rowIndex][3] = updates.date_from || rows[rowIndex][3];
    rows[rowIndex][4] = updates.date_end || rows[rowIndex][4];
    rows[rowIndex][5] = updates.category || rows[rowIndex][5];
    rows[rowIndex][6] = updates.link_url || rows[rowIndex][6];
    rows[rowIndex][8] = now;
    rows[rowIndex][9] = updates.keterangan ?? rows[rowIndex][9] ?? '';

    await writeSheet('leave_attendance', `A${rowIndex + 1}:J${rowIndex + 1}`, [rows[rowIndex]]);

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

    const rows = await readSheet('leave_attendance');
    const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    await deleteRow('leave_attendance', rowIndex);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting leave:', error);
    return NextResponse.json({ error: 'Failed to delete leave' }, { status: 500 });
  }
}