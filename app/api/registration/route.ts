import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { Registration } from '@/types';
import bcrypt from 'bcryptjs';

const SHEET = 'registration';

// Role a newly-approved user gets by default. Admin can change it later
// from Settings → User Access. "2" = Viewer (dashboard-only) in the seed roles.
const DEFAULT_ROLE_ID = '2';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.permissions.registration_request) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { records } = await readSheetAsObjects<any>(SHEET);

    const registrations: Registration[] = records.map((r) => ({
      id: r.id || '',
      name: r.name || '',
      email: r.email || '',
      password: r.password || '',
      status: (r.status || 'pending') as 'pending' | 'approved' | 'rejected',
      created_at: r.created_at || '',
      update_at: r.update_at || '',
    }));

    return NextResponse.json(registrations);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ error: 'Failed to fetch registration data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });
    }

    const { headers, records } = await readSheetAsObjects<any>(SHEET);
    const newId = String(records.length + 1);

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const now = new Date().toISOString();

    const newRegistration = objectToRow(headers, {
      id: newId,
      name: data.name || '',
      email: data.email || '',
      password: hashedPassword,
      status: 'pending',
      created_at: now,
      update_at: now,
    });

    await appendSheet(SHEET, [newRegistration]);

    return NextResponse.json({ success: true, id: newId });
  } catch (error) {
    console.error('Error creating registration:', error);
    return NextResponse.json({ error: 'Failed to create registration' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.permissions.registration_request) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status } = await request.json();

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'id', id);

    if (dataRowIndex === -1) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const now = new Date().toISOString();

    // If approved, add to users sheet with a safe default role.
    if (status === 'approved') {
      const { headers: userHeaders, records: userRecords } = await readSheetAsObjects<any>('users');
      const newUserId = String(userRecords.length + 1);

      const newUser = objectToRow(userHeaders, {
        id: newUserId,
        name: currentObj.name,
        username: currentObj.email,
        password: currentObj.password, // already hashed
        role: 'staff',
        role_id: DEFAULT_ROLE_ID,
        last_active: '',
      });

      await appendSheet('users', [newUser]);
    }

    const merged = { ...currentObj, status, update_at: now };
    const newRow = objectToRow(headers, merged);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating registration:', error);
    return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 });
  }
}
