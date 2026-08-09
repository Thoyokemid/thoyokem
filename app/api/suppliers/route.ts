import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, deleteRow, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { Supplier } from '@/types';

const SHEET = 'supplier_list';

function toBool(v: any) {
  return v === 'TRUE' || v === true;
}

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
    const suppliers: Supplier[] = records.map((r) => ({
      supplier_id: r.supplier_id || '',
      supplier_name: r.supplier_name || '',
      contact: r.contact || '',
      phone: r.phone || '',
      email: r.email || '',
      address: r.address || '',
      payment_terms: r.payment_terms || '',
      is_active: r.is_active === '' ? true : toBool(r.is_active),
    }));
    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { headers, records } = await readSheetAsObjects<any>(SHEET);
    const newId = data.supplier_id || `SUP-${String(records.length + 1).padStart(3, '0')}`;

    if (records.some((r) => r.supplier_id === newId)) {
      return NextResponse.json({ error: 'Supplier ID sudah dipakai' }, { status: 400 });
    }

    const newRow = objectToRow(headers, {
      supplier_id: newId,
      supplier_name: data.supplier_name || '',
      contact: data.contact || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      payment_terms: data.payment_terms || '',
      is_active: 'TRUE',
    });

    await appendSheet(SHEET, [newRow]);
    return NextResponse.json({ success: true, supplier_id: newId });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { supplier_id, ...updates } = data;

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'supplier_id', supplier_id);
    if (dataRowIndex === -1) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const merged = { ...currentObj };
    ['supplier_name', 'contact', 'phone', 'email', 'address', 'payment_terms'].forEach((f) => {
      if (updates[f] !== undefined) merged[f] = updates[f];
    });
    if (updates.is_active !== undefined) merged.is_active = updates.is_active ? 'TRUE' : 'FALSE';

    const newRow = objectToRow(headers, merged);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplier_id');
    if (!supplierId) return NextResponse.json({ error: 'supplier_id required' }, { status: 400 });

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'supplier_id', supplierId);
    if (dataRowIndex === -1) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    await deleteRow(SHEET, dataRowIndex + 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
  }
}
