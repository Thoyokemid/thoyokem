import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, deleteRow, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { Customer } from '@/types';

const SHEET = 'customer_list';

function toBool(v: any) {
  return v === 'TRUE' || v === true;
}

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
    const customers: Customer[] = records.map((r) => ({
      customer_id: r.customer_id || '',
      customer_name: r.customer_name || '',
      contact: r.contact || '',
      phone: r.phone || '',
      email: r.email || '',
      address: r.address || '',
      payment_terms: r.payment_terms || '',
      credit_limit: parseFloat(r.credit_limit) || 0,
      is_active: r.is_active === '' ? true : toBool(r.is_active),
    }));
    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { headers, records } = await readSheetAsObjects<any>(SHEET);
    const newId = data.customer_id || `CUST-${String(records.length + 1).padStart(3, '0')}`;

    if (records.some((r) => r.customer_id === newId)) {
      return NextResponse.json({ error: 'Customer ID sudah dipakai' }, { status: 400 });
    }

    const newRow = objectToRow(headers, {
      customer_id: newId,
      customer_name: data.customer_name || '',
      contact: data.contact || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      payment_terms: data.payment_terms || '',
      credit_limit: data.credit_limit ?? 0,
      is_active: 'TRUE',
    });

    await appendSheet(SHEET, [newRow]);
    return NextResponse.json({ success: true, customer_id: newId });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { customer_id, ...updates } = data;

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'customer_id', customer_id);
    if (dataRowIndex === -1) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const merged = { ...currentObj };
    ['customer_name', 'contact', 'phone', 'email', 'address', 'payment_terms', 'credit_limit'].forEach((f) => {
      if (updates[f] !== undefined) merged[f] = updates[f];
    });
    if (updates.is_active !== undefined) merged.is_active = updates.is_active ? 'TRUE' : 'FALSE';

    const newRow = objectToRow(headers, merged);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 });

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'customer_id', customerId);
    if (dataRowIndex === -1) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    await deleteRow(SHEET, dataRowIndex + 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
