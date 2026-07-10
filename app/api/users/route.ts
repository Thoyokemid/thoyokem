import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet } from '@/lib/sheets';

/**
 * Sheet column layout (0-indexed):
 * A[0]  = id
 * B[1]  = name
 * C[2]  = username
 * D[3]  = password (hashed)
 * E[4]  = role
 * F[5]  = dashboard (TRUE/FALSE)
 * G[6]  = attendance (TRUE/FALSE)
 * H[7]  = leave (TRUE/FALSE)        ← NEW
 * I[8]  = registration_request (TRUE/FALSE)
 * J[9]  = setting (TRUE/FALSE)
 * K[10] = last_active (ISO string)  ← NEW
 * L[11] = staff (TRUE/FALSE)        ← NEW
 */

interface UserPermission {
  id: string;
  name: string;
  username: string;
  role: string;
  dashboard: boolean;
  attendance: boolean;
  leave: boolean;
  registration_request: boolean;
  setting: boolean;
  staff: boolean;
  last_active?: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.permissions.setting) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await readSheet('users');

    if (!rows || rows.length < 2) {
      return NextResponse.json([]);
    }

    const usersData: UserPermission[] = rows.slice(1).map((row) => ({
      id: row[0] || '',
      name: row[1] || '',
      username: row[2] || '',
      role: row[4] || '',
      dashboard: row[5] === 'TRUE' || row[5] === true,
      attendance: row[6] === 'TRUE' || row[6] === true,
      leave: row[7] === 'TRUE' || row[7] === true,
      registration_request: row[8] === 'TRUE' || row[8] === true,
      setting: row[9] === 'TRUE' || row[9] === true,
      last_active: row[10] || '',
      staff: row[11] === 'TRUE' || row[11] === true,
    }));

    return NextResponse.json(usersData);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.permissions.setting) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { users } = await request.json();
    const rows = await readSheet('users');

    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: 'No users found' }, { status: 404 });
    }

    for (let i = 1; i < rows.length; i++) {
      const userId = rows[i][0];
      const user = users.find((u: UserPermission) => u.id === userId);

      if (user) {
        rows[i][5] = user.dashboard ? 'TRUE' : 'FALSE';
        rows[i][6] = user.attendance ? 'TRUE' : 'FALSE';
        rows[i][7] = user.leave ? 'TRUE' : 'FALSE';
        rows[i][8] = user.registration_request ? 'TRUE' : 'FALSE';
        rows[i][9] = user.setting ? 'TRUE' : 'FALSE';
        // col 10 (last_active) is NOT touched here — it's updated on login/activity
        rows[i][11] = user.staff ? 'TRUE' : 'FALSE';
      }
    }

    // Write columns A–L, preserving col K (last_active) as-is
    await writeSheet('users', `A2:L${rows.length}`, rows.slice(1).map(r => r.slice(0, 12)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating users:', error);
    return NextResponse.json({ error: 'Failed to update users' }, { status: 500 });
  }
}