import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet } from '@/lib/sheets';

const DEFAULTS: Record<string, string> = {
  jam_masuk: '08:00',
  jam_pulang: '17:00',
  toleransi_menit: '0',
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let rows: string[][] = [];
    try {
      rows = await readSheet('settings');
    } catch {
      // "settings" tab doesn't exist yet in the Google Sheet — fall back to defaults
    }

    const values: Record<string, string> = { ...DEFAULTS };
    rows.slice(1).forEach((row) => {
      if (row[0]) values[row[0]] = row[1] ?? '';
    });

    return NextResponse.json(values);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(DEFAULTS);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.user.permissions.setting) {
      return NextResponse.json({ error: 'Forbidden: no settings access' }, { status: 403 });
    }

    const data = await request.json();
    const merged = { ...DEFAULTS, ...data };
    const entries = Object.entries(merged);

    try {
      await writeSheet('settings', `A1:B${entries.length + 1}`, [
        ['key', 'value'],
        ...entries,
      ]);
    } catch (error) {
      console.error('Error writing settings (does the "settings" tab exist?):', error);
      return NextResponse.json(
        { error: 'Failed to save settings. Make sure a "settings" tab exists in the Google Sheet.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
