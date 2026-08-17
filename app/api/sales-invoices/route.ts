import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getNextDocId } from '@/lib/numbering';
import { logActivity } from '@/lib/activityLog';
import { validate, salesInvoiceCreateSchema } from '@/lib/validation';

async function requireAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.sales_order) {
    return { error: NextResponse.json({ error: 'Forbidden: no sales access' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const records = await prisma.salesInvoice.findMany({
      include: { items: true },
      orderBy: { creation: 'desc' },
    });
    const customers = await prisma.customer.findMany({ select: { customerId: true, customerName: true } });
    const itemMaster = await prisma.item.findMany({ select: { itemCode: true, itemName: true, unit: true } });
    const customerMap = new Map(customers.map((c) => [c.customerId, c.customerName]));
    const itemMasterMap = new Map(itemMaster.map((i) => [i.itemCode, i]));

    const invoices = records.map((r) => ({
      si_id: r.siId,
      so_id: r.soId,
      dn_id: r.dnId,
      customer_id: r.customerId,
      customer_name: customerMap.get(r.customerId) || r.customerId,
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
    console.error('Error fetching sales invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch sales invoices' }, { status: 500 });
  }
}

// Create an invoice from a Sales Order (copies total + line items over).
export async function POST(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const parsed = validate(salesInvoiceCreateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { so_id, due_date } = parsed.data;

    const so = await prisma.salesOrder.findUnique({ where: { soId: so_id } });
    if (!so) return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });

    const lines = await prisma.salesOrderItem.findMany({ where: { soId: so_id } });
    const delivery = await prisma.deliveryNote.findFirst({ where: { soId: so_id } });

    const siId = await getNextDocId('SI');
    const now = new Date().toISOString();
    const grandTotal = Number(so.totalAmount);

    await prisma.salesInvoice.create({
      data: {
        siId,
        soId: so_id,
        dnId: delivery?.dnId || null,
        customerId: so.customerId,
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
      doctype: 'Sales Invoice',
      documentId: siId,
      action: 'Created',
      changedBy: guard.session?.user.name || '',
      before: null,
      after: { si_id: siId, so_id, grand_total: grandTotal, status: 'Submitted' },
    });

    return NextResponse.json({ success: true, si_id: siId });
  } catch (error) {
    console.error('Error creating sales invoice:', error);
    return NextResponse.json({ error: 'Failed to create sales invoice' }, { status: 500 });
  }
}
