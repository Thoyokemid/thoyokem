import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheetAsObjects, appendSheet, objectToRow } from '@/lib/sheets';
import { getNextDocId } from '@/lib/numbering';

const SHEET = 'sales_invoice';
const ITEM_SHEET = 'sales_invoice_item';

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
    const { records } = await readSheetAsObjects<any>(SHEET);
    const { records: customers } = await readSheetAsObjects<any>('customer_list');
    const customerMap = new Map(customers.map((c) => [c.customer_id, c.customer_name]));

    const invoices = records
      .map((r) => ({
        si_id: r.si_id,
        so_id: r.so_id,
        dn_id: r.dn_id,
        customer_id: r.customer_id,
        customer_name: customerMap.get(r.customer_id) || r.customer_id,
        posting_date: r.posting_date,
        due_date: r.due_date,
        grand_total: parseFloat(r.grand_total) || 0,
        outstanding_amount: parseFloat(r.outstanding_amount) || 0,
        status: r.status,
        owner: r.owner,
        creation: r.creation,
      }))
      .reverse();

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
    const { so_id, due_date } = await request.json();
    if (!so_id) return NextResponse.json({ error: 'so_id wajib diisi' }, { status: 400 });

    const { records: orders } = await readSheetAsObjects<any>('sales_order');
    const so = orders.find((o) => o.so_id === so_id);
    if (!so) return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });

    const { records: soItems } = await readSheetAsObjects<any>('sales_order_item');
    const lines = soItems.filter((i) => i.so_id === so_id);

    const { records: deliveries } = await readSheetAsObjects<any>('delivery_note');
    const delivery = deliveries.find((d) => d.so_id === so_id);

    const siId = await getNextDocId('SI');
    const now = new Date().toISOString();
    const grandTotal = parseFloat(so.total_amount) || 0;

    const { headers: siHeaders } = await readSheetAsObjects<any>(SHEET);
    const siRow = objectToRow(siHeaders, {
      si_id: siId,
      so_id,
      dn_id: delivery?.dn_id || '',
      customer_id: so.customer_id,
      posting_date: now.slice(0, 10),
      due_date: due_date || '',
      grand_total: grandTotal,
      outstanding_amount: grandTotal,
      status: 'Submitted',
      approval_status: 'Approved',
      owner: guard.session?.user.name || '',
      creation: now,
    });
    await appendSheet(SHEET, [siRow]);

    const { headers: siItemHeaders } = await readSheetAsObjects<any>(ITEM_SHEET);
    const siItemRows = lines.map((i) =>
      objectToRow(siItemHeaders, {
        si_id: siId,
        item_code: i.item_code,
        qty: i.qty,
        rate: i.rate,
        amount: i.amount,
      })
    );
    if (siItemRows.length > 0) await appendSheet(ITEM_SHEET, siItemRows);

    return NextResponse.json({ success: true, si_id: siId });
  } catch (error) {
    console.error('Error creating sales invoice:', error);
    return NextResponse.json({ error: 'Failed to create sales invoice' }, { status: 500 });
  }
}
