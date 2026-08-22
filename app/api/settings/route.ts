import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { validate, settingsUpdateSchema } from '@/lib/validation';
import { logActivity } from '@/lib/activityLog';

const DEFAULTS: Record<string, string> = {
  jam_masuk: '08:00',
  jam_pulang: '17:00',
  toleransi_menit: '0',
  usd_idr_rate: '15800',
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await prisma.setting.findMany();
    const values: Record<string, string> = { ...DEFAULTS };
    rows.forEach((row) => {
      values[row.key] = row.value;
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

    const parsed = validate(settingsUpdateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const existingRows = await prisma.setting.findMany({ where: { key: { in: Object.keys(data) } } });
    const before: Record<string, string> = {};
    existingRows.forEach((row) => { before[row.key] = row.value; });

    await Promise.all(
      Object.entries(data).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );

    await logActivity({
      doctype: 'Settings',
      documentId: 'global',
      action: 'Updated',
      changedBy: session.user.name || '',
      before,
      after: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
