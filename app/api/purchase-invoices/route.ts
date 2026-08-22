import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getNextDocId } from '@/lib/numbering';
import { logActivity } from '@/lib/activityLog';
import { validate, purchaseInvoiceCreateSchema, purchaseInvoiceActionSchema } from '@/lib/validation';
import { hasDoctypePermission, requiresOwnerMatch, PermissionAction } from '@/lib/permissions';

async function requireAccess(action: PermissionAction) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!(await hasDoctypePermission(session, 'Purchase Invoice', action))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireAccess('read');
  if (guard.error) return guard.error;

  try {
    const records = await prisma.purchaseInvoice.findMany({
      include: { items: true },
      orderBy: { creation: 'desc' },
    });
    const suppliers = await prisma.supplier.findMany({ select: { supplierId: true, supplierName: true } });
    const itemMaster = await prisma.item.findMany({ select: { itemCode: true, itemName: true, unit: true } });
    const supplierMap = new Map(suppliers.map((s) => [s.supplierId, s.supplierName]));
    const itemMasterMap = new Map(itemMaster.map((i) => [i.itemCode, i]));

    const invoices = records.map((r) => ({
      pi_id: r.piId,
      po_id: r.poId,
      pr_id: r.prId,
      supplier_id: r.supplierId,
      supplier_name: supplierMap.get(r.supplierId) || r.supplierId,
      posting_date: r.postingDate,
      due_date: r.dueDate,
      grand_total: Number(r.grandTotal),
      outstanding_amount: Number(r.outstandingAmount),
      status: r.status,
      owner: r.owner,
      creation: r.creation,
      items: r.items.map((i) => ({
        item_code: i.itemCode,
        item_name: itemMasterMap.get(i.itemCode)?.itemName || i.itemCode,
        uom: itemMasterMap.get(i.itemCode)?.unit || '-',
        qty: Number(i.qty),
        rate: Number(i.rate),
        amount: Number(i.amount),
      })),
    }));

    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching purchase invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase invoices' }, { status: 500 });
  }
}

// Create an invoice from a Purchase Order (copies total + line items over).
export async function POST(request: NextRequest) {
  const guard = await requireAccess('create');
  if (guard.error) return guard.error;

  try {
    const parsed = validate(purchaseInvoiceCreateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { po_id, due_date } = parsed.data;

    const po = await prisma.purchaseOrder.findUnique({ where: { poId: po_id } });
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    const lines = await prisma.purchaseOrderItem.findMany({ where: { poId: po_id } });
    const receipt = await prisma.purchaseReceipt.findFirst({ where: { poId: po_id } });

    const piId = await getNextDocId('PI');
    const now = new Date().toISOString();
    const grandTotal = Number(po.totalAmount);

    await prisma.purchaseInvoice.create({
      data: {
        piId,
        poId: po_id,
        prId: receipt?.prId || null,
        supplierId: po.supplierId,
        postingDate: now.slice(0, 10),
        dueDate: due_date || null,
        grandTotal,
        outstandingAmount: grandTotal,
        status: 'Submitted',
        approvalStatus: 'Approved',
        owner: guard.session?.user.name || '',
        creation: now,
        items: {
          create: lines.map((i) => ({
            itemCode: i.itemCode,
            qty: i.qty,
            rate: i.rate,
            amount: i.amount,
          })),
        },
      },
    });

    await logActivity({
      doctype: 'Purchase Invoice',
      documentId: piId,
      action: 'Created',
      changedBy: guard.session?.user.name || '',
      before: null,
      after: { pi_id: piId, po_id, grand_total: grandTotal, status: 'Submitted' },
    });

    return NextResponse.json({ success: true, pi_id: piId });
  } catch (error) {
    console.error('Error creating purchase invoice:', error);
    return NextResponse.json({ error: 'Failed to create purchase invoice' }, { status: 500 });
  }
}

// PATCH performs a status-transition action: cancel
export async function PATCH(request: NextRequest) {
  const guard = await requireAccess('cancel');
  if (guard.error) return guard.error;

  try {
    const parsed = validate(purchaseInvoiceActionSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { pi_id, action } = parsed.data;

    const current = await prisma.purchaseInvoice.findUnique({ where: { piId: pi_id } });
    if (!current) return NextResponse.json({ error: 'Purchase invoice not found' }, { status: 404 });

    if (await requiresOwnerMatch(guard.session!, 'Purchase Invoice') && current.owner !== guard.session!.user.name) {
      return NextResponse.json({ error: 'Anda hanya bisa membatalkan Purchase Invoice yang Anda buat sendiri' }, { status: 403 });
    }

    if (action === 'cancel') {
      if (current.status === 'Cancelled') {
        return NextResponse.json({ error: 'Purchase invoice sudah dibatalkan' }, { status: 400 });
      }

      const paymentCount = await prisma.paymentEntry.count({ where: { referenceId: pi_id } });
      if (paymentCount > 0) {
        return NextResponse.json({ error: 'Batalkan/hapus Payment Entry yang terkait invoice ini dulu sebelum membatalkannya' }, { status: 400 });
      }

      const updated = await prisma.purchaseInvoice.update({ where: { piId: pi_id }, data: { status: 'Cancelled' } });

      await logActivity({
        doctype: 'Purchase Invoice',
        documentId: pi_id,
        action: 'Cancelled',
        changedBy: guard.session?.user.name || '',
        before: current,
        after: updated,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating purchase invoice:', error);
    return NextResponse.json({ error: 'Failed to update purchase invoice' }, { status: 500 });
  }
}
