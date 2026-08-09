import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheetAsObjects, appendSheet, objectToRow } from '@/lib/sheets';
import { getNextDocId } from '@/lib/numbering';

const SHEET = 'purchase_invoice';
const ITEM_SHEET = 'purchase_invoice_item';

async function requireAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.purchasing) {
    return { error: NextResponse.json({ error: 'Forbidden: no purchasing access' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const { records } = await readSheetAsObjects<any>(SHEET);
    const { records: suppliers } = await readSheetAsObjects<any>('supplier_list');
    const supplierMap = new Map(suppliers.map((s) => [s.supplier_id, s.supplier_name]));

    const invoices = records
      .map((r) => ({
        pi_id: r.pi_id,
        po_id: r.po_id,
        pr_id: r.pr_id,
        supplier_id: r.supplier_id,
        supplier_name: supplierMap.get(r.supplier_id) || r.supplier_id,
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
    console.error('Error fetching purchase invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase invoices' }, { status: 500 });
  }
}

// Create an invoice from a Purchase Order (copies total + line items over).
export async function POST(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const { po_id, due_date } = await request.json();
    if (!po_id) return NextResponse.json({ error: 'po_id wajib diisi' }, { status: 400 });

    const { records: orders } = await readSheetAsObjects<any>('purchase_order');
    const po = orders.find((o) => o.po_id === po_id);
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    const { records: poItems } = await readSheetAsObjects<any>('purchase_order_item');
    const lines = poItems.filter((i) => i.po_id === po_id);

    const { records: receipts } = await readSheetAsObjects<any>('purchase_receipt');
    const receipt = receipts.find((r) => r.po_id === po_id);

    const piId = await getNextDocId('PI');
    const now = new Date().toISOString();
    const grandTotal = parseFloat(po.total_amount) || 0;

    const { headers: piHeaders } = await readSheetAsObjects<any>(SHEET);
    const piRow = objectToRow(piHeaders, {
      pi_id: piId,
      po_id,
      pr_id: receipt?.pr_id || '',
      supplier_id: po.supplier_id,
      posting_date: now.slice(0, 10),
      due_date: due_date || '',
      grand_total: grandTotal,
      outstanding_amount: grandTotal,
      status: 'Submitted',
      approval_status: 'Approved',
      owner: guard.session?.user.name || '',
      creation: now,
    });
    await appendSheet(SHEET, [piRow]);

    const { headers: piItemHeaders } = await readSheetAsObjects<any>(ITEM_SHEET);
    const piItemRows = lines.map((i) =>
      objectToRow(piItemHeaders, {
        pi_id: piId,
        item_code: i.item_code,
        qty: i.qty,
        rate: i.rate,
        amount: i.amount,
      })
    );
    if (piItemRows.length > 0) await appendSheet(ITEM_SHEET, piItemRows);

    return NextResponse.json({ success: true, pi_id: piId });
  } catch (error) {
    console.error('Error creating purchase invoice:', error);
    return NextResponse.json({ error: 'Failed to create purchase invoice' }, { status: 500 });
  }
}
