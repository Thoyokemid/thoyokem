import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { broadcastNotificationsChanged } from '@/lib/realtime';
import { generateId } from '@/lib/id';
import { validate, registrationCreateSchema } from '@/lib/validation';
import { Registration } from '@/types';
import bcrypt from 'bcryptjs';

// Role a newly-approved user gets by default. Admin can change it later
// from Settings → User Access. "2" = Viewer (dashboard-only) in the seed roles.
const DEFAULT_ROLE_ID = '2';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.permissions.registration_request) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const records = await prisma.registration.findMany();

    const registrations: Registration[] = records.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      password: r.password,
      status: r.status as 'pending' | 'approved' | 'rejected',
      created_at: r.createdAt,
      update_at: r.updateAt,
    }));

    return NextResponse.json(registrations);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ error: 'Failed to fetch registration data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = validate(registrationCreateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const newId = generateId();
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const now = new Date().toISOString();

    await prisma.registration.create({
      data: {
        id: newId,
        name: data.name || '',
        email: data.email || '',
        password: hashedPassword,
        status: 'pending',
        createdAt: now,
        updateAt: now,
      },
    });

    await logActivity({ doctype: 'Registration', documentId: newId, action: 'Created', changedBy: data.name || data.email || '', before: null, after: { name: data.name, email: data.email, status: 'pending' } });

    await broadcastNotificationsChanged();

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

    const current = await prisma.registration.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // If approved, add to users table with a safe default role.
    if (status === 'approved') {
      const newUserId = generateId();

      const newUser = await prisma.user.create({
        data: {
          id: newUserId,
          name: current.name,
          username: current.email,
          password: current.password, // already hashed
          role: 'staff',
          roleId: DEFAULT_ROLE_ID,
          lastActive: null,
        },
      });

      await logActivity({ doctype: 'User', documentId: newUserId, action: 'Created', changedBy: session.user.name || '', before: null, after: newUser });
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: { status, updateAt: now },
    });

    await logActivity({
      doctype: 'Registration',
      documentId: id,
      action: status === 'approved' ? 'Approved' : 'Rejected',
      changedBy: session.user.name || '',
      before: current,
      after: updated,
    });

    await broadcastNotificationsChanged();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating registration:', error);
    return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 });
  }
}
