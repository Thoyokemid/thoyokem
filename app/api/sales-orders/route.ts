import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { getNextDocId } from '@/lib/numbering';
import { appendStockLedgerEntry, getCurrentStockQty } from '@/lib/stock';

const SHEET = 'sales_order';
const ITEM_SHEET = 'sales_order_item';

async function requireSalesAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.sales_order) {
    return { error: NextResponse.json({ error: 'Forbidden: no sales access' }, { status: 403 }) };
  }
  return { session };
}

async function requireDeliveryAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.sales_order && !session.user.permissions.delivery_order) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireSalesAccess();
  if (guard.error) return guard.error;

  try {
    const { records: orders } = await readSheetAsObjects<any>(SHEET);
    const { records: items } = await readSheetAsObjects<any>(ITEM_SHEET);
    const { records: customers } = await readSheetAsObjects<any>('customer_list');

    const customerMap = new Map(customers.map((c) => [c.customer_id, c.customer_name]));

    const result = orders
      .map((so) => ({
        so_id: so.so_id,
        customer_id: so.customer_id,
        customer_name: customerMap.get(so.customer_id) || so.customer_id,
        order_date: so.order_date,
        delivery_date: so.delivery_date,
        status: so.status,
        approval_status: so.approval_status || 'Pending',
        approved_by: so.approved_by || '',
        total_amount: parseFloat(so.total_amount) || 0,
        owner: so.owner,
        creation: so.creation,
        items: items
          .filter((i) => i.so_id === so.so_id)
          .map((i) => ({
            so_id: i.so_id,
            item_code: i.item_code,
            qty: parseFloat(i.qty) || 0,
            rate: parseFloat(i.rate) || 0,
            amount: parseFloat(i.amount) || 0,
            delivered_qty: parseFloat(i.delivered_qty) || 0,
            warehouse_id: i.warehouse_id,
          })),
      }))
      .reverse();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return NextResponse.json({ error: 'Failed to fetch sales orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSalesAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { customer_id, delivery_date, items } = data;

    if (!customer_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'customer_id dan minimal 1 item wajib diisi' }, { status: 400 });
    }

    const soId = await getNextDocId('SO');
    const now = new Date().toISOString();
    const totalAmount = items.reduce((sum: number, i: any) => sum + (i.qty * i.rate), 0);

    const { headers: soHeaders } = await readSheetAsObjects<any>(SHEET);
    const soRow = objectToRow(soHeaders, {
      so_id: soId,
      customer_id,
      order_date: now.slice(0, 10),
      delivery_date: delivery_date || '',
      status: 'Draft',
      total_amount: totalAmount,
      approval_status: 'Pending',
      owner: guard.session?.user.name || '',
      creation: now,
      modified_by: guard.session?.user.name || '',
      modified: now,
    });
    await appendSheet(SHEET, [soRow]);

    const { headers: itemHeaders } = await readSheetAsObjects<any>(ITEM_SHEET);
    const itemRows = items.map((i: any) =>
      objectToRow(itemHeaders, {
        so_id: soId,
        item_code: i.item_code,
        qty: i.qty,
        rate: i.rate,
        amount: i.qty * i.rate,
        delivered_qty: 0,
        warehouse_id: i.warehouse_id,
      })
    );
    await appendSheet(ITEM_SHEET, itemRows);

    return NextResponse.json({ success: true, so_id: soId });
  } catch (error) {
    console.error('Error creating sales order:', error);
    return NextResponse.json({ error: 'Failed to create sales order' }, { status: 500 });
  }
}

// PATCH performs a status-transition action: submit | deliver | cancel
export async function PATCH(request: NextRequest) {
  try {
    const { so_id, action } = await request.json();
    if (!so_id || !action) {
      return NextResponse.json({ error: 'so_id dan action wajib diisi' }, { status: 400 });
    }

    // Permission depends on the action: delivering needs delivery_order access,
    // everything else needs sales_order access.
    const guard = action === 'deliver' ? await requireDeliveryAccess() : await requireSalesAccess();
    if (guard.error) return guard.error;

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'so_id', so_id);
    if (dataRowIndex === -1) return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));

    const now = new Date().toISOString();
    const session = guard.session;

    if (action === 'submit') {
      if (currentObj.status !== 'Draft') {
        return NextResponse.json({ error: 'Hanya SO berstatus Draft yang bisa di-submit' }, { status: 400 });
      }
      currentObj.status = 'Confirmed';
    } else if (action === 'cancel') {
      currentObj.status = 'Cancelled';
    } else if (action === 'approve' || action === 'reject') {
      if (!session?.user.permissions.can_approve) {
        return NextResponse.json({ error: 'Kamu tidak punya izin approve' }, { status: 403 });
      }
      if (currentObj.status !== 'Confirmed') {
        return NextResponse.json({ error: 'SO harus berstatus Confirmed sebelum di-approve/reject' }, { status: 400 });
      }
      currentObj.approval_status = action === 'approve' ? 'Approved' : 'Rejected';
      currentObj.approved_by = session?.user.name || '';
      currentObj.approved_at = now;
    } else if (action === 'deliver') {
      if (currentObj.status !== 'Confirmed') {
        return NextResponse.json({ error: 'SO harus berstatus Confirmed sebelum dikirim' }, { status: 400 });
      }
      if (currentObj.approval_status !== 'Approved') {
        return NextResponse.json({ error: 'SO harus di-approve dulu sebelum dikirim' }, { status: 400 });
      }

      const { records: items } = await readSheetAsObjects<any>(ITEM_SHEET);
      const { records: itemMaster } = await readSheetAsObjects<any>('item_list');
      const soItems = items.filter((i) => i.so_id === so_id);

      // Guard against negative stock.
      for (const item of soItems) {
        const available = await getCurrentStockQty(item.item_code, item.warehouse_id);
        if (available < parseFloat(item.qty)) {
          return NextResponse.json(
            { error: `Stok tidak cukup untuk ${item.item_code} di ${item.warehouse_id} (tersedia ${available}, butuh ${item.qty})` },
            { status: 400 }
          );
        }
      }

      const dnId = await getNextDocId('DN');
      const { headers: dnHeaders } = await readSheetAsObjects<any>('delivery_note');
      const dnRow = objectToRow(dnHeaders, {
        dn_id: dnId,
        so_id,
        customer_id: currentObj.customer_id,
        posting_date: now.slice(0, 10),
        status: 'Submitted',
        approval_status: 'Approved',
        owner: session?.user.name || '',
        creation: now,
      });
      await appendSheet('delivery_note', [dnRow]);

      const { headers: dnItemHeaders } = await readSheetAsObjects<any>('delivery_note_item');
      const dnItemRows = soItems.map((i) =>
        objectToRow(dnItemHeaders, {
          dn_id: dnId,
          so_id,
          item_code: i.item_code,
          delivered_qty: i.qty,
          warehouse_id: i.warehouse_id,
          rate: i.rate,
        })
      );
      await appendSheet('delivery_note_item', dnItemRows);

      for (const item of soItems) {
        const master = itemMaster.find((m) => m.item_code === item.item_code);
        const valuationRate = parseFloat(master?.purchase_price) || 0;
        await appendStockLedgerEntry({
          itemCode: item.item_code,
          warehouseId: item.warehouse_id,
          voucherType: 'Delivery Note',
          voucherId: dnId,
          actualQty: -(parseFloat(item.qty) || 0),
          valuationRate,
          postingDate: now.slice(0, 10),
        });
      }

      const soItemRows = await readSheet(ITEM_SHEET);
      const soItemHeaders = (soItemRows[0] || []).map((h: any) => String(h ?? '').trim());
      const soCol = soItemHeaders.indexOf('so_id');
      const qtyCol = soItemHeaders.indexOf('qty');
      const deliveredCol = soItemHeaders.indexOf('delivered_qty');
      for (let i = 1; i < soItemRows.length; i++) {
        if (soItemRows[i][soCol] === so_id) {
          soItemRows[i][deliveredCol] = soItemRows[i][qtyCol];
        }
      }
      const lastItemCol = String.fromCharCode(65 + soItemHeaders.length - 1);
      await writeSheet(ITEM_SHEET, `A2:${lastItemCol}${soItemRows.length}`, soItemRows.slice(1));

      currentObj.status = 'Delivered';
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    currentObj.modified_by = session?.user.name || '';
    currentObj.modified = now;

    const newRow = objectToRow(headers, currentObj);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating sales order:', error);
    return NextResponse.json({ error: 'Failed to update sales order' }, { status: 500 });
  }
}
