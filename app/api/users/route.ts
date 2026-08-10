import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { logActivity } from '@/lib/activityLog';

const SHEET = 'users';

interface UserWithRole {
  id: string;
  name: string;
  username: string;
  role: string;
  role_id: string;
  last_active?: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.permissions.setting) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { records } = await readSheetAsObjects<any>(SHEET);

    const usersData: UserWithRole[] = records.map((r) => ({
      id: r.id || '',
      name: r.name || '',
      username: r.username || '',
      role: r.role || '',
      role_id: r.role_id || '',
      last_active: r.last_active || '',
    }));

    return NextResponse.json(usersData);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// Assign a role_id to a single user. Admin-only (setting permission).
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.permissions.setting) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, role_id } = await request.json();

    if (!id || !role_id) {
      return NextResponse.json({ error: 'id and role_id are required' }, { status: 400 });
    }

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'id', id);

    if (dataRowIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const merged = { ...currentObj, role_id: String(role_id) };
    const newRow = objectToRow(headers, merged);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    await logActivity({
      doctype: 'User',
      documentId: currentObj.username || id,
      action: 'Updated',
      changedBy: session.user.name || '',
      before: { role_id: currentObj.role_id },
      after: { role_id: String(role_id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
  }
}
