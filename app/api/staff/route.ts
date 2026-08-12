import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, deleteRow, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { logActivity } from '@/lib/activityLog';
import { StaffList } from '@/types';

const SHEET = 'staff_list';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.user.permissions.staff) {
      return NextResponse.json({ error: 'Forbidden: no staff access' }, { status: 403 });
    }

    const { records } = await readSheetAsObjects<any>(SHEET);

    const staff: StaffList[] = records.map((r) => ({
      employee_id: r.employee_id || '',
      user_id: r.user_id || '',
      employee_name: r.employee_name || '',
      date_of_birth: r.date_of_birth || '',
      leave_allocation: r.leave_allocation ? parseInt(r.leave_allocation) : 12,
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
    const { headers, records } = await readSheetAsObjects<any>(SHEET);
    const newId = String(records.length + 1);

    const newStaff = objectToRow(headers, {
      employee_id: newId,
      user_id: data.user_id || '',
      employee_name: data.employee_name || '',
      date_of_birth: data.date_of_birth || '',
      leave_allocation: data.leave_allocation ?? 12,
    });

    await appendSheet(SHEET, [newStaff]);

    const newObj: Record<string, any> = {};
    headers.forEach((h, i) => (newObj[h] = newStaff[i]));
    await logActivity({ doctype: 'Staff', documentId: newId, action: 'Created', changedBy: session.user.name || '', before: null, after: newObj });

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
    const { employee_id, ...updates } = data;

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'employee_id', employee_id);

    if (dataRowIndex === -1) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    const sheetRowIndex = dataRowIndex + 1; // absolute index in `rows` (0 = header row)
    const currentRow = rows[sheetRowIndex] || [];

    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const merged = {
      ...currentObj,
      user_id: updates.user_id ?? currentObj.user_id,
      employee_name: updates.employee_name ?? currentObj.employee_name,
      date_of_birth: updates.date_of_birth ?? currentObj.date_of_birth,
      leave_allocation: updates.leave_allocation ?? currentObj.leave_allocation,
    };

    const newRow = objectToRow(headers, merged);
    const lastCol = String.fromCharCode(65 + headers.length - 1); // A, B, C...
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    await logActivity({ doctype: 'Staff', documentId: employee_id, action: 'Updated', changedBy: session.user.name || '', before: currentObj, after: merged });

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

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'employee_id', id);

    if (dataRowIndex === -1) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    await deleteRow(SHEET, dataRowIndex + 1); // +1 to skip header row

    await logActivity({ doctype: 'Staff', documentId: id, action: 'Deleted', changedBy: session.user.name || '', before: null, after: { employee_id: id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
  }
}
