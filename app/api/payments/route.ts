import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';

const SHEET = 'payment_entry';

async function requireAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.purchasing && !session.user.permissions.sales_order) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const referenceId = searchParams.get('reference_id');

    const { records } = await readSheetAsObjects<any>(SHEET);
    let payments = records.map((r) => ({
      payment_id: r.payment_id,
      payment_type: r.payment_type,
      party_type: r.party_type,
      party_id: r.party_id,
      reference_type: r.reference_type,
      reference_id: r.reference_id,
      paid_amount: parseFloat(r.paid_amount) || 0,
      posting_date: r.posting_date,
      mode_of_payment: r.mode_of_payment,
      status: r.status,
      owner: r.owner,
      creation: r.creation,
    }));

    if (referenceId) payments = payments.filter((p) => p.reference_id === referenceId);

    return NextResponse.json(payments.reverse());
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { payment_type, party_type, party_id, reference_type, reference_id, paid_amount, mode_of_payment } = data;

    if (!reference_id || !paid_amount || paid_amount <= 0) {
      return NextResponse.json({ error: 'reference_id dan paid_amount (>0) wajib diisi' }, { status: 400 });
    }

    const invoiceSheet = reference_type === 'Sales Invoice' ? 'sales_invoice' : 'purchase_invoice';
    const idField = reference_type === 'Sales Invoice' ? 'si_id' : 'pi_id';

    const rows = await readSheet(invoiceSheet);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, idField, reference_id);
    if (dataRowIndex === -1) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const currentOutstanding = parseFloat(currentObj.outstanding_amount) || 0;
    if (paid_amount > currentOutstanding) {
      return NextResponse.json({ error: `Jumlah bayar (${paid_amount}) melebihi sisa tagihan (${currentOutstanding})` }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Record the payment.
    const { headers: payHeaders, records: payRecords } = await readSheetAsObjects<any>(SHEET);
    const paymentId = String(payRecords.length + 1);
    const payRow = objectToRow(payHeaders, {
      payment_id: paymentId,
      payment_type,
      party_type,
      party_id,
      reference_type,
      reference_id,
      paid_amount,
      posting_date: now.slice(0, 10),
      mode_of_payment: mode_of_payment || 'Cash',
      status: 'Submitted',
      owner: guard.session?.user.name || '',
      creation: now,
    });
    await appendSheet(SHEET, [payRow]);

    // Update the invoice's outstanding amount / status.
    const newOutstanding = currentOutstanding - paid_amount;
    currentObj.outstanding_amount = newOutstanding;
    currentObj.status = newOutstanding <= 0 ? 'Paid' : 'Partially Paid';

    const newRow = objectToRow(headers, currentObj);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(invoiceSheet, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    return NextResponse.json({ success: true, payment_id: paymentId, outstanding_amount: newOutstanding });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
