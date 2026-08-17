import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { generateId } from '@/lib/id';
import { validate, paymentCreateSchema } from '@/lib/validation';

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

    const records = await prisma.paymentEntry.findMany({
      where: referenceId ? { referenceId } : undefined,
      orderBy: { creation: 'desc' },
    });

    const payments = records.map((r) => ({
      payment_id: r.paymentId,
      payment_type: r.paymentType,
      party_type: r.partyType,
      party_id: r.partyId,
      reference_type: r.referenceType,
      reference_id: r.referenceId,
      paid_amount: Number(r.paidAmount),
      posting_date: r.postingDate,
      mode_of_payment: r.modeOfPayment,
      status: r.status,
      owner: r.owner,
      creation: r.creation,
    }));

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const parsed = validate(paymentCreateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { payment_type, party_type, party_id, reference_type, reference_id, paid_amount, mode_of_payment } = parsed.data;

    const isSalesInvoice = reference_type === 'Sales Invoice';

    const currentInvoice = isSalesInvoice
      ? await prisma.salesInvoice.findUnique({ where: { siId: reference_id } })
      : await prisma.purchaseInvoice.findUnique({ where: { piId: reference_id } });
    if (!currentInvoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const currentOutstanding = Number(currentInvoice.outstandingAmount);
    const originalStatus = currentInvoice.status;
    if (paid_amount > currentOutstanding) {
      return NextResponse.json({ error: `Jumlah bayar (${paid_amount}) melebihi sisa tagihan (${currentOutstanding})` }, { status: 400 });
    }

    const now = new Date().toISOString();
    const paymentId = generateId();
    const newOutstanding = currentOutstanding - paid_amount;
    const newStatus = newOutstanding <= 0 ? 'Paid' : 'Partially Paid';

    await prisma.paymentEntry.create({
      data: {
        paymentId,
        paymentType: payment_type,
        partyType: party_type,
        partyId: party_id,
        referenceType: reference_type,
        referenceId: reference_id,
        paidAmount: paid_amount,
        postingDate: now.slice(0, 10),
        modeOfPayment: mode_of_payment || 'Cash',
        status: 'Submitted',
        owner: guard.session?.user.name || '',
        creation: now,
      },
    });

    // Update the invoice's outstanding amount / status.
    if (isSalesInvoice) {
      await prisma.salesInvoice.update({ where: { siId: reference_id }, data: { outstandingAmount: newOutstanding, status: newStatus } });
    } else {
      await prisma.purchaseInvoice.update({ where: { piId: reference_id }, data: { outstandingAmount: newOutstanding, status: newStatus } });
    }

    await logActivity({
      doctype: 'Payment Entry',
      documentId: paymentId,
      action: 'Paid',
      changedBy: guard.session?.user.name || '',
      before: null,
      after: { payment_id: paymentId, reference_type, reference_id, paid_amount, mode_of_payment: mode_of_payment || 'Cash' },
    });
    await logActivity({
      doctype: reference_type,
      documentId: reference_id,
      action: 'Paid',
      changedBy: guard.session?.user.name || '',
      before: { outstanding_amount: currentOutstanding, status: originalStatus },
      after: { outstanding_amount: newOutstanding, status: newStatus },
    });

    return NextResponse.json({ success: true, payment_id: paymentId, outstanding_amount: newOutstanding });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
