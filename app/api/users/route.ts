import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { validate, userUpdateSchema } from '@/lib/validation';
import { hasDoctypePermission } from '@/lib/permissions';

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

    if (!session || !(await hasDoctypePermission(session, 'User', 'read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const records = await prisma.user.findMany();

    const usersData: UserWithRole[] = records.map((r) => ({
      id: r.id,
      name: r.name,
      username: r.username,
      role: r.role,
      role_id: r.roleId,
      last_active: r.lastActive || '',
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

    if (!session || !(await hasDoctypePermission(session, 'User', 'write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = validate(userUpdateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { id, role_id } = parsed.data;

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await prisma.user.update({ where: { id }, data: { roleId: String(role_id) } });

    await logActivity({
      doctype: 'User',
      documentId: current.username || id,
      action: 'Updated',
      changedBy: session.user.name || '',
      before: { role_id: current.roleId },
      after: { role_id: String(role_id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
  }
}
