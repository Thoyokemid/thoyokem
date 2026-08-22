import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { logActivity } from '@/lib/activityLog';
import { getRolePermissionMatrix, MATRIX_DOCTYPES } from '@/lib/permissions';
import { validate, rolePermissionUpdateSchema } from '@/lib/validation';

async function requireSettingAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.setting) {
    return { error: NextResponse.json({ error: 'Forbidden: no setting access' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: NextRequest) {
  const guard = await requireSettingAccess();
  if (guard.error) return guard.error;

  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get('role_id');
  if (!roleId) return NextResponse.json({ error: 'role_id wajib diisi' }, { status: 400 });

  try {
    const role = await prisma.role.findUnique({ where: { roleId } });
    if (!role) return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 });

    const matrix = await getRolePermissionMatrix(roleId, role.isSuperAdmin);
    return NextResponse.json({ matrix, is_super_admin: role.isSuperAdmin });
  } catch (error) {
    console.error('Error fetching role permission matrix:', error);
    return NextResponse.json({ error: 'Failed to fetch permission matrix' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireSettingAccess();
  if (guard.error) return guard.error;

  try {
    const parsed = validate(rolePermissionUpdateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const {
      role_id, doctype, read, create, write, delete: canDelete, export: canExport, import: canImport,
      only_if_owner, restrict_to_assigned, submit, cancel, amend, approve, print,
    } = parsed.data;

    if (!MATRIX_DOCTYPES.includes(doctype as any)) {
      return NextResponse.json({ error: 'Doctype tidak dikenal' }, { status: 400 });
    }
    const role = await prisma.role.findUnique({ where: { roleId: role_id } });
    if (!role) return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 });

    const before = await prisma.rolePermission.findUnique({ where: { roleId_doctype: { roleId: role_id, doctype } } });
    const onlyIfOwner = only_if_owner ?? before?.onlyIfOwner ?? false;
    const restrictToAssigned = restrict_to_assigned ?? before?.restrictToAssigned ?? false;
    const canSubmit = submit ?? before?.canSubmit ?? false;
    const canCancel = cancel ?? before?.canCancel ?? false;
    const canAmend = amend ?? before?.canAmend ?? false;
    const canApproveDoc = approve ?? before?.canApproveDoc ?? false;
    const canPrint = print ?? before?.canPrint ?? false;

    const data = {
      canRead: read, canCreate: create, canWrite: write, canDelete, canExport, canImport,
      onlyIfOwner, restrictToAssigned, canSubmit, canCancel, canAmend, canApproveDoc, canPrint,
    };
    const saved = await prisma.rolePermission.upsert({
      where: { roleId_doctype: { roleId: role_id, doctype } },
      update: data,
      create: { id: generateId(), roleId: role_id, doctype, ...data },
    });

    await logActivity({
      doctype: 'Role',
      documentId: role_id,
      action: 'Updated',
      changedBy: guard.session?.user.name || '',
      before: before ? { [`permission_${doctype}`]: JSON.stringify(before) } : null,
      after: { [`permission_${doctype}`]: JSON.stringify(saved) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving role permission:', error);
    return NextResponse.json({ error: 'Failed to save permission' }, { status: 500 });
  }
}

/** Removes an override, reverting that (role, doctype) pair to the legacy flat module flag. */
export async function DELETE(request: NextRequest) {
  const guard = await requireSettingAccess();
  if (guard.error) return guard.error;

  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get('role_id');
  const doctype = searchParams.get('doctype');
  if (!roleId || !doctype) return NextResponse.json({ error: 'role_id dan doctype wajib diisi' }, { status: 400 });

  try {
    const existing = await prisma.rolePermission.findUnique({ where: { roleId_doctype: { roleId, doctype } } });
    if (!existing) return NextResponse.json({ success: true });

    await prisma.rolePermission.delete({ where: { roleId_doctype: { roleId, doctype } } });

    await logActivity({
      doctype: 'Role',
      documentId: roleId,
      action: 'Updated',
      changedBy: guard.session?.user.name || '',
      before: { [`permission_${doctype}`]: JSON.stringify(existing) },
      after: { [`permission_${doctype}`]: 'reset to default' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting role permission:', error);
    return NextResponse.json({ error: 'Failed to reset permission' }, { status: 500 });
  }
}
