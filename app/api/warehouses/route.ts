import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, deleteRow, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { Warehouse } from '@/types';

const SHEET = 'warehouse_list';

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
    const warehouses: Warehouse[] = records.map((r) => ({
      warehouse_id: r.warehouse_id || '',
      warehouse_name: r.warehouse_name || '',
      location: r.location || '',
      is_active: r.is_active === '' ? true : toBool(r.is_active),
    }));
    return NextResponse.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { headers, records } = await readSheetAsObjects<any>(SHEET);
    const newId = data.warehouse_id || `WH-${String(records.length + 1).padStart(3, '0')}`;

    if (records.some((r) => r.warehouse_id === newId)) {
      return NextResponse.json({ error: 'Warehouse ID sudah dipakai' }, { status: 400 });
    }

    const newRow = objectToRow(headers, {
      warehouse_id: newId,
      warehouse_name: data.warehouse_name || '',
      location: data.location || '',
      is_active: 'TRUE',
    });

    await appendSheet(SHEET, [newRow]);
    return NextResponse.json({ success: true, warehouse_id: newId });
  } catch (error) {
    console.error('Error creating warehouse:', error);
    return NextResponse.json({ error: 'Failed to create warehouse' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { warehouse_id, ...updates } = data;

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'warehouse_id', warehouse_id);

    if (dataRowIndex === -1) return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const merged = { ...currentObj };
    if (updates.warehouse_name !== undefined) merged.warehouse_name = updates.warehouse_name;
    if (updates.location !== undefined) merged.location = updates.location;
    if (updates.is_active !== undefined) merged.is_active = updates.is_active ? 'TRUE' : 'FALSE';

    const newRow = objectToRow(headers, merged);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    return NextResponse.json({ error: 'Failed to update warehouse' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id');
    if (!warehouseId) return NextResponse.json({ error: 'warehouse_id required' }, { status: 400 });

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'warehouse_id', warehouseId);

    if (dataRowIndex === -1) return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });

    await deleteRow(SHEET, dataRowIndex + 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    return NextResponse.json({ error: 'Failed to delete warehouse' }, { status: 500 });
  }
}
