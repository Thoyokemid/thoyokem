import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, deleteRow, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { getNextDocId } from '@/lib/numbering';
import { logActivity } from '@/lib/activityLog';

const SHEET = 'bom';
const ITEM_SHEET = 'bom_item';

function toBool(v: any) {
  return v === 'TRUE' || v === true;
}

async function requireAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.inventory) {
    return { error: NextResponse.json({ error: 'Forbidden: no inventory access' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const { records: boms } = await readSheetAsObjects<any>(SHEET);
    const { records: components } = await readSheetAsObjects<any>(ITEM_SHEET);
    const { records: items } = await readSheetAsObjects<any>('item_list');
    const itemNameMap = new Map(items.map((i) => [i.item_code, i.item_name]));

    const result = boms.map((b) => ({
      bom_id: b.bom_id,
      item_code: b.item_code,
      item_name: itemNameMap.get(b.item_code) || b.item_code,
      qty: parseFloat(b.qty) || 1,
      is_active: b.is_active === '' ? true : toBool(b.is_active),
      owner: b.owner || '',
      creation: b.creation || '',
      components: components
        .filter((c) => c.bom_id === b.bom_id)
        .map((c) => ({
          bom_id: c.bom_id,
          component_item_code: c.component_item_code,
          component_item_name: itemNameMap.get(c.component_item_code) || c.component_item_code,
          qty: parseFloat(c.qty) || 0,
        })),
    }));

    return NextResponse.json(result.reverse());
  } catch (error) {
    console.error('Error fetching BOMs:', error);
    return NextResponse.json({ error: 'Failed to fetch BOMs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { item_code, qty, components } = data;

    if (!item_code || !Array.isArray(components) || components.length === 0) {
      return NextResponse.json({ error: 'item_code dan minimal 1 komponen wajib diisi' }, { status: 400 });
    }
    if (components.some((c: any) => c.component_item_code === item_code)) {
      return NextResponse.json({ error: 'Komponen tidak boleh sama dengan produk campuran itu sendiri' }, { status: 400 });
    }

    const bomId = await getNextDocId('BOM');
    const now = new Date().toISOString();

    const { headers: bomHeaders } = await readSheetAsObjects<any>(SHEET);
    const bomRow = objectToRow(bomHeaders, {
      bom_id: bomId,
      item_code,
      qty: qty || 1,
      is_active: 'TRUE',
      owner: guard.session?.user.name || '',
      creation: now,
    });
    await appendSheet(SHEET, [bomRow]);

    const { headers: compHeaders } = await readSheetAsObjects<any>(ITEM_SHEET);
    const compRows = components.map((c: any) =>
      objectToRow(compHeaders, {
        bom_id: bomId,
        component_item_code: c.component_item_code,
        qty: c.qty,
      })
    );
    await appendSheet(ITEM_SHEET, compRows);

    await logActivity({
      doctype: 'BOM',
      documentId: bomId,
      action: 'Created',
      changedBy: guard.session?.user.name || '',
      before: null,
      after: { bom_id: bomId, item_code, qty: qty || 1, components: components.map((c: any) => `${c.component_item_code} x${c.qty}`).join(', ') },
    });

    return NextResponse.json({ success: true, bom_id: bomId });
  } catch (error) {
    console.error('Error creating BOM:', error);
    return NextResponse.json({ error: 'Failed to create BOM' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const bomId = searchParams.get('bom_id');
    if (!bomId) return NextResponse.json({ error: 'bom_id required' }, { status: 400 });

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'bom_id', bomId);
    if (dataRowIndex === -1) return NextResponse.json({ error: 'BOM not found' }, { status: 404 });

    await deleteRow(SHEET, dataRowIndex + 1);

    // Remove component rows too.
    const compRows = await readSheet(ITEM_SHEET);
    const compHeaders = (compRows[0] || []).map((h: any) => String(h ?? '').trim());
    const bomCol = compHeaders.indexOf('bom_id');
    for (let i = compRows.length - 1; i >= 1; i--) {
      if (compRows[i][bomCol] === bomId) {
        await deleteRow(ITEM_SHEET, i);
      }
    }

    await logActivity({ doctype: 'BOM', documentId: bomId, action: 'Deleted', changedBy: guard.session?.user.name || '', before: null, after: { bom_id: bomId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting BOM:', error);
    return NextResponse.json({ error: 'Failed to delete BOM' }, { status: 500 });
  }
}
