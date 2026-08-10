import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getActivityLog } from '@/lib/activityLog';

// Which permission is required to view the log for a given doctype.
function requiredPerms(perms: any) {
  return {
    Item: perms.inventory,
    Warehouse: perms.inventory,
    'Stock Entry': perms.inventory,
    BOM: perms.inventory,
    Supplier: perms.purchasing,
    'Purchase Order': perms.purchasing,
    'Purchase Invoice': perms.purchasing,
    Customer: perms.sales_order,
    'Sales Order': perms.sales_order,
    'Sales Invoice': perms.sales_order,
    'Delivery Note': perms.delivery_order || perms.sales_order,
    'Payment Entry': perms.purchasing || perms.sales_order,
    User: perms.setting,
    Role: perms.setting,
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const doctype = searchParams.get('doctype');
  const documentId = searchParams.get('document_id');
  if (!doctype || !documentId) {
    return NextResponse.json({ error: 'doctype dan document_id wajib diisi' }, { status: 400 });
  }

  const perms = requiredPerms(session.user.permissions);
  const allowed = (perms as any)[doctype];
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const entries = await getActivityLog(doctype, documentId);
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return NextResponse.json({ error: 'Failed to fetch activity log' }, { status: 500 });
  }
}
