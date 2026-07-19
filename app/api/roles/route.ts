import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendSheet, writeSheet, deleteRow, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { Role } from '@/types';

const SHEET = 'roles';

function toBool(v: any) {
  return v === 'TRUE' || v === true;
}

// Only users with setting permission may manage roles.
async function requireSettingAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.setting) {
    return { error: NextResponse.json({ error: 'Forbidden: no setting access' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { records } = await readSheetAsObjects<any>(SHEET);
    const roles: Role[] = records.map((r) => ({
      role_id: r.role_id || '',
      role_name: r.role_name || '',
      dashboard: toBool(r.dashboard),
      attendance: toBool(r.attendance),
      leave: toBool(r.leave),
      registration_request: toBool(r.registration_request),
      setting: toBool(r.setting),
      staff: toBool(r.staff),
    }));

    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSettingAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { headers, records } = await readSheetAsObjects<any>(SHEET);
    const newId = String(records.length + 1);

    const newRole = objectToRow(headers, {
      role_id: newId,
      role_name: data.role_name || '',
      dashboard: data.dashboard ? 'TRUE' : 'FALSE',
      attendance: data.attendance ? 'TRUE' : 'FALSE',
      leave: data.leave ? 'TRUE' : 'FALSE',
      registration_request: data.registration_request ? 'TRUE' : 'FALSE',
      setting: data.setting ? 'TRUE' : 'FALSE',
      staff: data.staff ? 'TRUE' : 'FALSE',
    });

    await appendSheet(SHEET, [newRole]);

    return NextResponse.json({ success: true, role_id: newId });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireSettingAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { role_id, ...updates } = data;

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'role_id', role_id);

    if (dataRowIndex === -1) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const boolFields = ['dashboard', 'attendance', 'leave', 'registration_request', 'setting', 'staff'];
    const merged = { ...currentObj };
    if (updates.role_name !== undefined) merged.role_name = updates.role_name;
    boolFields.forEach((f) => {
      if (updates[f] !== undefined) merged[f] = updates[f] ? 'TRUE' : 'FALSE';
    });

    const newRow = objectToRow(headers, merged);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireSettingAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('role_id');

    if (!roleId) {
      return NextResponse.json({ error: 'role_id required' }, { status: 400 });
    }

    // Prevent deleting a role that's still assigned to a user.
    const { records: users } = await readSheetAsObjects<any>('users');
    const inUse = users.some((u) => String(u.role_id) === String(roleId));
    if (inUse) {
      return NextResponse.json(
        { error: 'Role masih dipakai oleh user lain, tidak bisa dihapus' },
        { status: 400 }
      );
    }

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'role_id', roleId);

    if (dataRowIndex === -1) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    await deleteRow(SHEET, dataRowIndex + 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
}
