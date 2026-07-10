import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, deleteRow } from '@/lib/sheets';
import { StaffList } from '@/types';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await readSheet('staff_list');

    if (!rows || rows.length < 2) {
      return NextResponse.json([]);
    }

    const staff: StaffList[] = rows.slice(1).map((row) => ({
      id: row[0] || '',
      registration_id: row[1] || '',
      name: row[2] || '',
      birth_date: row[3] || '',
      leave_quota: row[4] ? parseInt(row[4]) : 12,
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

    if (!session || !session.user.permissions.staff) {
      return NextResponse.json({ error: 'Forbidden: no staff access' }, { status: 403 });
    }

    const data = await request.json();
    const rows = await readSheet('staff_list');
    const newId = rows.length > 1 ? String(rows.length) : '1';

    const newStaff = [
      newId,
      data.registration_id || '',
      data.name || '',
      data.birth_date || '',
      data.leave_quota ?? 12,
    ];

    await appendSheet('staff_list', [newStaff]);

    return NextResponse.json({ success: true, id: newId });
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.permissions.staff) {
      return NextResponse.json({ error: 'Forbidden: no staff access' }, { status: 403 });
    }

    const data = await request.json();
    const { id, ...updates } = data;

    const rows = await readSheet('staff_list');
    const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    rows[rowIndex][1] = updates.registration_id ?? rows[rowIndex][1];
    rows[rowIndex][2] = updates.name ?? rows[rowIndex][2];
    rows[rowIndex][3] = updates.birth_date ?? rows[rowIndex][3];
    rows[rowIndex][4] = updates.leave_quota ?? rows[rowIndex][4];

    await writeSheet('staff_list', `A${rowIndex + 1}:E${rowIndex + 1}`, [rows[rowIndex]]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.permissions.staff) {
      return NextResponse.json({ error: 'Forbidden: no staff access' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const rows = await readSheet('staff_list');
    const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    await deleteRow('staff_list', rowIndex);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
  }
}
