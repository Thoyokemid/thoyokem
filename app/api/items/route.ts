import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, deleteRow, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { logActivity } from '@/lib/activityLog';
import { Item } from '@/types';

const SHEET = 'item_list';

function toBool(v: any) {
  return v === 'TRUE' || v === true;
}

async function requireInventoryAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.inventory) {
    return { error: NextResponse.json({ error: 'Forbidden: no inventory access' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const { records } = await readSheetAsObjects<any>(SHEET);
    const items: Item[] = records.map((r) => ({
      item_code: r.item_code || '',
      item_name: r.item_name || '',
      item_group: r.item_group || '',
      unit: r.unit || '',
      purchase_price: parseFloat(r.purchase_price) || 0,
      selling_price: parseFloat(r.selling_price) || 0,
      reorder_level: parseFloat(r.reorder_level) || 0,
      valuation_method: (r.valuation_method || 'Average') as 'FIFO' | 'Average',
      opening_qty: parseFloat(r.opening_qty) || 0,
      opening_valuation_rate: parseFloat(r.opening_valuation_rate) || 0,
      is_active: r.is_active === '' ? true : toBool(r.is_active),
      currency: (r.currency || 'IDR') as 'IDR' | 'USD',
      item_type: (r.item_type || 'Regular') as 'Trading' | 'Regular',
    }));
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { headers, records } = await readSheetAsObjects<any>(SHEET);

    if (records.some((r) => r.item_code === data.item_code)) {
      return NextResponse.json({ error: 'Item code sudah dipakai' }, { status: 400 });
    }

    const newRow = objectToRow(headers, {
      item_code: data.item_code || '',
      item_name: data.item_name || '',
      item_group: data.item_group || '',
      unit: data.unit || '',
      purchase_price: data.purchase_price ?? 0,
      selling_price: data.selling_price ?? 0,
      reorder_level: data.reorder_level ?? 0,
      valuation_method: data.valuation_method || 'Average',
      opening_qty: data.opening_qty ?? 0,
      opening_valuation_rate: data.opening_valuation_rate ?? 0,
      is_active: 'TRUE',
      currency: data.currency || 'IDR',
      item_type: data.item_type || 'Regular',
    });

    await appendSheet(SHEET, [newRow]);

    const newObj: Record<string, any> = {};
    headers.forEach((h, i) => (newObj[h] = newRow[i]));
    await logActivity({ doctype: 'Item', documentId: data.item_code, action: 'Created', changedBy: guard.session?.user.name || '', before: null, after: newObj });

    return NextResponse.json({ success: true, item_code: data.item_code });
  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { item_code, ...updates } = data;

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'item_code', item_code);

    if (dataRowIndex === -1) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const merged = { ...currentObj };
    ['item_name', 'item_group', 'unit', 'purchase_price', 'selling_price', 'reorder_level', 'valuation_method', 'reorder_level', 'currency', 'item_type'].forEach((f) => {
      if (updates[f] !== undefined) merged[f] = updates[f];
    });
    if (updates.is_active !== undefined) merged.is_active = updates.is_active ? 'TRUE' : 'FALSE';

    const newRow = objectToRow(headers, merged);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    await logActivity({ doctype: 'Item', documentId: item_code, action: 'Updated', changedBy: guard.session?.user.name || '', before: currentObj, after: merged });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const itemCode = searchParams.get('item_code');
    if (!itemCode) return NextResponse.json({ error: 'item_code required' }, { status: 400 });

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'item_code', itemCode);

    if (dataRowIndex === -1) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await deleteRow(SHEET, dataRowIndex + 1);
    await logActivity({ doctype: 'Item', documentId: itemCode, action: 'Deleted', changedBy: guard.session?.user.name || '', before: null, after: { item_code: itemCode } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
