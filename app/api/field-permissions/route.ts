import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { logActivity } from '@/lib/activityLog';
import { FIELD_PERMISSION_FIELDS } from '@/lib/permissionsShared';
import { validate, fieldPermissionUpdateSchema } from '@/lib/validation';

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

    const rows = await prisma.fieldPermission.findMany({ where: { roleId } });
    const rowMap = new Map(rows.map((r) => [`${r.doctype}::${r.field}`, r]));

    const fields = FIELD_PERMISSION_FIELDS.map((f) => {
      const row = rowMap.get(`${f.doctype}::${f.field}`);
      return {
        doctype: f.doctype,
        field: f.field,
        label: f.label,
        can_view: role.isSuperAdmin ? true : row ? row.canView : true,
      };
    });

    return NextResponse.json({ fields, is_super_admin: role.isSuperAdmin });
  } catch (error) {
    console.error('Error fetching field permissions:', error);
    return NextResponse.json({ error: 'Failed to fetch field permissions' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireSettingAccess();
  if (guard.error) return guard.error;

  try {
    const parsed = validate(fieldPermissionUpdateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { role_id, doctype, field, can_view } = parsed.data;

    if (!FIELD_PERMISSION_FIELDS.some((f) => f.doctype === doctype && f.field === field)) {
      return NextResponse.json({ error: 'Field tidak dikenal' }, { status: 400 });
    }
    const role = await prisma.role.findUnique({ where: { roleId: role_id } });
    if (!role) return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 });

    const saved = await prisma.fieldPermission.upsert({
      where: { roleId_doctype_field: { roleId: role_id, doctype, field } },
      update: { canView: can_view },
      create: { id: generateId(), roleId: role_id, doctype, field, canView: can_view },
    });

    await logActivity({
      doctype: 'Role',
      documentId: role_id,
      action: 'Updated',
      changedBy: guard.session?.user.name || '',
      before: null,
      after: { [`field_permission_${doctype}_${field}`]: JSON.stringify(saved) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving field permission:', error);
    return NextResponse.json({ error: 'Failed to save field permission' }, { status: 500 });
  }
}
