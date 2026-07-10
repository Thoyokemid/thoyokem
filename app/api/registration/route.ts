import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet } from '@/lib/sheets';
import { Registration } from '@/types';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.permissions.registration_request) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await readSheet('registration');

    if (!rows || rows.length < 2) {
      return NextResponse.json([]);
    }

    const registrations: Registration[] = rows.slice(1).map((row) => ({
      id: row[0] || '',
      name: row[1] || '',
      username: row[2] || '',
      password: row[3] || '',
      status: (row[4] || 'pending') as 'pending' | 'approved' | 'rejected',
      created_at: row[5] || '',
      update_at: row[6] || '',
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

    // Get existing data to generate new ID
    const rows = await readSheet('registration');
    const newId = rows.length > 1 ? String(rows.length) : '1';

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const now = new Date().toISOString();

    const newRegistration = [
      newId,
      data.name || '',
      data.username || '',
      hashedPassword,
      'pending',
      now,
      now,
    ];

    await appendSheet('registration', [newRegistration]);

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

    const rows = await readSheet('registration');

    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id);

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    rows[rowIndex][4] = status;
    rows[rowIndex][6] = now;

    // If approved, add to users sheet
    if (status === 'approved') {
      const registration = rows[rowIndex];
      const usersRows = await readSheet('users');
      const newUserId = usersRows.length > 1 ? String(usersRows.length) : '1';

      const newUser = [
        newUserId,
        registration[1], // name
        registration[2], // username
        registration[3], // password (already hashed)
        'staff', // role
        'TRUE', // dashboard
        'FALSE', // attendance
        'FALSE', // leave
        'FALSE', // registration_request
        'FALSE', // setting
        '', // last_active
        'FALSE', // staff (staff management permission)
      ];

      await appendSheet('users', [newUser]);
    }

    await writeSheet('registration', `A${rowIndex + 1}:G${rowIndex + 1}`, [rows[rowIndex]]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating registration:', error);
    return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 });
  }
}
