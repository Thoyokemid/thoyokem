import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';

const SHEET = 'users';

// Fields a user is allowed to self-edit. Role/permission fields are excluded
// on purpose — those stay admin-only via /api/users.
const EDITABLE_FIELDS = [
  'name',
  'photo_url',
  'phone',
  'date_of_birth',
  'address',
  'gender',
  'emergency_contact_name',
  'emergency_contact_phone',
  'bio',
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { records } = await readSheetAsObjects<any>(SHEET);
    const user = records.find((u) => String(u.id) === String(session.user.id));

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { password, ...profile } = user;
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'id', session.user.id);

    if (dataRowIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const merged = { ...currentObj };
    EDITABLE_FIELDS.forEach((field) => {
      if (data[field] !== undefined) merged[field] = data[field];
    });

    // Optional password change — requires current password to be correct.
    if (data.new_password) {
      if (!data.current_password) {
        return NextResponse.json({ error: 'Password saat ini wajib diisi' }, { status: 400 });
      }
      const valid = await bcrypt.compare(data.current_password, currentObj.password);
      if (!valid) {
        return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 });
      }
      merged.password = await bcrypt.hash(data.new_password, 10);
    }

    const newRow = objectToRow(headers, merged);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
