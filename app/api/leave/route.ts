import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, updateLastActive } from '@/lib/auth';
import { readSheet, appendSheet, writeSheet, deleteRow, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { LeaveAttendance } from '@/types';

const SHEET = 'leave_attendance';

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

    const { records } = await readSheetAsObjects<any>(SHEET);

    const leaves: LeaveAttendance[] = records.map((r) => ({
      id: r.id || '',
      employee: r.employee || '',
      employee_name: r.employee_name || '',
      from_date: r.from_date || '',
      to_date: r.to_date || '',
      leave_type: r.leave_type || '',
      attachment: r.attachment || '',
      description: r.description || '',
      created_at: r.created_at || '',
      update_at: r.update_at || '',
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
    const { headers, records } = await readSheetAsObjects<any>(SHEET);
    const newId = String(records.length + 1);
    const now = new Date().toISOString();

    const newLeave = objectToRow(headers, {
      id: newId,
      employee: data.employee || '',
      employee_name: data.employee_name || '',
      from_date: data.from_date || '',
      to_date: data.to_date || '',
      leave_type: data.leave_type || '',
      attachment: data.attachment || '',
      created_at: now,
      update_at: now,
      description: data.description || '',
    });

    await appendSheet(SHEET, [newLeave]);

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

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'id', id);

    if (dataRowIndex === -1) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    const sheetRowIndex = dataRowIndex + 1; // absolute index in `rows` (0 = header row)
    const currentRow = rows[sheetRowIndex] || [];

    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const now = new Date().toISOString();
    const merged = {
      ...currentObj,
      from_date: updates.from_date || currentObj.from_date,
      to_date: updates.to_date || currentObj.to_date,
      leave_type: updates.leave_type || currentObj.leave_type,
      attachment: updates.attachment || currentObj.attachment,
      update_at: now,
      description: updates.description ?? currentObj.description ?? '',
    };

    const newRow = objectToRow(headers, merged);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

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

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'id', id);

    if (dataRowIndex === -1) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    await deleteRow(SHEET, dataRowIndex + 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting leave:', error);
    return NextResponse.json({ error: 'Failed to delete leave' }, { status: 500 });
  }
}
