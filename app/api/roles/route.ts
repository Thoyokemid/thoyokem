import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { generateId } from '@/lib/id';
import { Role } from '@/types';

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

    const records = await prisma.role.findMany();
    const roles: Role[] = records.map((r) => ({
      role_id: r.roleId,
      role_name: r.roleName,
      dashboard: r.dashboard,
      attendance: r.attendance,
      leave: r.leave,
      registration_request: r.registrationRequest,
      setting: r.setting,
      staff: r.staff,
      inventory: r.inventory,
      purchasing: r.purchasing,
      sales_order: r.salesOrder,
      delivery_order: r.deliveryOrder,
      can_approve: r.canApprove,
      is_super_admin: r.isSuperAdmin,
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
    const newId = generateId();

    const created = await prisma.role.create({
      data: {
        roleId: newId,
        roleName: data.role_name || '',
        dashboard: !!data.dashboard,
        attendance: !!data.attendance,
        leave: !!data.leave,
        registrationRequest: !!data.registration_request,
        setting: !!data.setting,
        staff: !!data.staff,
        inventory: !!data.inventory,
        purchasing: !!data.purchasing,
        salesOrder: !!data.sales_order,
        deliveryOrder: !!data.delivery_order,
        canApprove: !!data.can_approve,
        isSuperAdmin: !!data.is_super_admin,
      },
    });

    await logActivity({ doctype: 'Role', documentId: newId, action: 'Created', changedBy: guard.session?.user.name || '', before: null, after: created });

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

    const current = await prisma.role.findUnique({ where: { roleId: role_id } });
    if (!current) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const updated = await prisma.role.update({
      where: { roleId: role_id },
      data: {
        roleName: updates.role_name !== undefined ? updates.role_name : current.roleName,
        dashboard: updates.dashboard !== undefined ? !!updates.dashboard : current.dashboard,
        attendance: updates.attendance !== undefined ? !!updates.attendance : current.attendance,
        leave: updates.leave !== undefined ? !!updates.leave : current.leave,
        registrationRequest: updates.registration_request !== undefined ? !!updates.registration_request : current.registrationRequest,
        setting: updates.setting !== undefined ? !!updates.setting : current.setting,
        staff: updates.staff !== undefined ? !!updates.staff : current.staff,
        inventory: updates.inventory !== undefined ? !!updates.inventory : current.inventory,
        purchasing: updates.purchasing !== undefined ? !!updates.purchasing : current.purchasing,
        salesOrder: updates.sales_order !== undefined ? !!updates.sales_order : current.salesOrder,
        deliveryOrder: updates.delivery_order !== undefined ? !!updates.delivery_order : current.deliveryOrder,
        canApprove: updates.can_approve !== undefined ? !!updates.can_approve : current.canApprove,
        isSuperAdmin: updates.is_super_admin !== undefined ? !!updates.is_super_admin : current.isSuperAdmin,
      },
    });

    await logActivity({ doctype: 'Role', documentId: role_id, action: 'Updated', changedBy: guard.session?.user.name || '', before: current, after: updated });

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
    const inUseCount = await prisma.user.count({ where: { roleId } });
    if (inUseCount > 0) {
      return NextResponse.json(
        { error: 'Role masih dipakai oleh user lain, tidak bisa dihapus' },
        { status: 400 }
      );
    }

    const existing = await prisma.role.findUnique({ where: { roleId } });
    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    await prisma.role.delete({ where: { roleId } });
    await logActivity({ doctype: 'Role', documentId: roleId, action: 'Deleted', changedBy: guard.session?.user.name || '', before: null, after: { role_id: roleId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
}
