import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { getNextDocId, getAmendedDocId } from '@/lib/numbering';
import { appendStockLedgerEntry } from '@/lib/stock';
import { logActivity } from '@/lib/activityLog';

const SHEET = 'purchase_order';
const ITEM_SHEET = 'purchase_order_item';

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
    const { records: orders } = await readSheetAsObjects<any>(SHEET);
    const { records: items } = await readSheetAsObjects<any>(ITEM_SHEET);
    const { records: suppliers } = await readSheetAsObjects<any>('supplier_list');
    const { records: itemMaster } = await readSheetAsObjects<any>('item_list');

    const supplierMap = new Map(suppliers.map((s) => [s.supplier_id, s.supplier_name]));
    const itemMasterMap = new Map(itemMaster.map((i) => [i.item_code, i]));

    const result = orders
      .map((po) => ({
        po_id: po.po_id,
        supplier_id: po.supplier_id,
        supplier_name: supplierMap.get(po.supplier_id) || po.supplier_id,
        order_date: po.order_date,
        expected_date: po.expected_date,
        status: po.status,
        approval_status: po.approval_status || 'Pending',
        approved_by: po.approved_by || '',
        total_amount: parseFloat(po.total_amount) || 0,
        owner: po.owner,
        creation: po.creation,
        amended_from: po.amended_from || '',
        items: items
          .filter((i) => i.po_id === po.po_id)
          .map((i) => ({
            po_id: i.po_id,
            item_code: i.item_code,
            item_name: i.item_name || itemMasterMap.get(i.item_code)?.item_name || i.item_code,
            uom: i.uom || itemMasterMap.get(i.item_code)?.unit || '-',
            qty: parseFloat(i.qty) || 0,
            rate: parseFloat(i.rate) || 0,
            amount: parseFloat(i.amount) || 0,
            received_qty: parseFloat(i.received_qty) || 0,
            warehouse_id: i.warehouse_id,
          })),
      }))
      .reverse();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { supplier_id, expected_date, items } = data;

    if (!supplier_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'supplier_id dan minimal 1 item wajib diisi' }, { status: 400 });
    }

    const poId = await getNextDocId('PO');
    const now = new Date().toISOString();
    const totalAmount = items.reduce((sum: number, i: any) => sum + (i.qty * i.rate), 0);
    const { records: itemMaster } = await readSheetAsObjects<any>('item_list');
    const itemMasterMap = new Map(itemMaster.map((i) => [i.item_code, i]));

    const { headers: poHeaders } = await readSheetAsObjects<any>(SHEET);
    const poRow = objectToRow(poHeaders, {
      po_id: poId,
      supplier_id,
      order_date: now.slice(0, 10),
      expected_date: expected_date || '',
      status: 'Draft',
      total_amount: totalAmount,
      approval_status: 'Pending',
      owner: guard.session?.user.name || '',
      creation: now,
      modified_by: guard.session?.user.name || '',
      modified: now,
    });
    await appendSheet(SHEET, [poRow]);

    const { headers: itemHeaders } = await readSheetAsObjects<any>(ITEM_SHEET);
    const itemRows = items.map((i: any) =>
      objectToRow(itemHeaders, {
        po_id: poId,
        item_code: i.item_code,
        item_name: itemMasterMap.get(i.item_code)?.item_name || i.item_code,
        uom: itemMasterMap.get(i.item_code)?.unit || '',
        qty: i.qty,
        rate: i.rate,
        amount: i.qty * i.rate,
        received_qty: 0,
        warehouse_id: i.warehouse_id,
      })
    );
    await appendSheet(ITEM_SHEET, itemRows);

    await logActivity({
      doctype: 'Purchase Order',
      documentId: poId,
      action: 'Created',
      changedBy: guard.session?.user.name || '',
      before: null,
      after: { po_id: poId, supplier_id, expected_date: expected_date || '', status: 'Draft', total_amount: totalAmount },
    });

    return NextResponse.json({ success: true, po_id: poId });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 });
  }
}

// PATCH performs a status-transition action: submit | receive | cancel
export async function PATCH(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const { po_id, action } = await request.json();
    if (!po_id || !action) {
      return NextResponse.json({ error: 'po_id dan action wajib diisi' }, { status: 400 });
    }

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'po_id', po_id);
    if (dataRowIndex === -1) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));
    const originalObj = { ...currentObj };

    const now = new Date().toISOString();
    let logAction: any = 'Updated';

    if (action === 'submit') {
      if (currentObj.status !== 'Draft') {
        return NextResponse.json({ error: 'Hanya PO berstatus Draft yang bisa di-submit' }, { status: 400 });
      }
      currentObj.status = 'Submitted';
      logAction = 'Submitted';
    } else if (action === 'cancel') {
      if (currentObj.status === 'Cancelled') {
        return NextResponse.json({ error: 'PO sudah dibatalkan' }, { status: 400 });
      }

      if (currentObj.status === 'Received') {
        const { records: invoices } = await readSheetAsObjects<any>('purchase_invoice');
        const hasInvoice = invoices.some((inv) => inv.po_id === po_id);
        if (hasInvoice) {
          return NextResponse.json({ error: 'Batalkan/hapus Purchase Invoice yang terkait PO ini dulu sebelum membatalkan PO' }, { status: 400 });
        }

        // Reverse the stock impact of the receipt.
        const { records: poItems } = await readSheetAsObjects<any>(ITEM_SHEET);
        const items = poItems.filter((i) => i.po_id === po_id);
        for (const item of items) {
          const receivedQty = parseFloat(item.received_qty) || 0;
          if (receivedQty <= 0) continue;
          await appendStockLedgerEntry({
            itemCode: item.item_code,
            warehouseId: item.warehouse_id,
            voucherType: 'Purchase Order Cancellation',
            voucherId: po_id,
            actualQty: -receivedQty,
            valuationRate: parseFloat(item.rate) || 0,
            postingDate: now.slice(0, 10),
          });
        }

        // Mark linked purchase receipts as cancelled too (cosmetic, for traceability).
        const prRows = await readSheet('purchase_receipt');
        const prHeaders = (prRows[0] || []).map((h: any) => String(h ?? '').trim());
        const prPoCol = prHeaders.indexOf('po_id');
        const prStatusCol = prHeaders.indexOf('status');
        for (let i = 1; i < prRows.length; i++) {
          if (prRows[i][prPoCol] === po_id) prRows[i][prStatusCol] = 'Cancelled';
        }
        if (prRows.length > 1) {
          const lastCol = String.fromCharCode(65 + prHeaders.length - 1);
          await writeSheet('purchase_receipt', `A2:${lastCol}${prRows.length}`, prRows.slice(1));
        }
      }

      currentObj.status = 'Cancelled';
      logAction = 'Cancelled';
    } else if (action === 'amend') {
      if (currentObj.status !== 'Cancelled') {
        return NextResponse.json({ error: 'Hanya PO yang sudah dibatalkan yang bisa di-amend' }, { status: 400 });
      }

      const { records: allPos } = await readSheetAsObjects<any>(SHEET);
      const newPoId = getAmendedDocId(po_id, allPos.map((p) => p.po_id));

      const { records: poItems, headers: poItemHeaders } = await readSheetAsObjects<any>(ITEM_SHEET);
      const items = poItems.filter((i) => i.po_id === po_id);

      const { headers: poHeaders } = await readSheetAsObjects<any>(SHEET);
      const newPoRow = objectToRow(poHeaders, {
        po_id: newPoId,
        supplier_id: currentObj.supplier_id,
        order_date: now.slice(0, 10),
        expected_date: currentObj.expected_date || '',
        status: 'Draft',
        total_amount: currentObj.total_amount,
        approval_status: 'Pending',
        owner: guard.session?.user.name || '',
        creation: now,
        modified_by: guard.session?.user.name || '',
        modified: now,
        amended_from: po_id,
      });
      await appendSheet(SHEET, [newPoRow]);

      const newItemRows = items.map((i) =>
        objectToRow(poItemHeaders, {
          po_id: newPoId,
          item_code: i.item_code,
          item_name: i.item_name || i.item_code,
          uom: i.uom || '',
          qty: i.qty,
          rate: i.rate,
          amount: i.amount,
          received_qty: 0,
          warehouse_id: i.warehouse_id,
        })
      );
      await appendSheet(ITEM_SHEET, newItemRows);

      await logActivity({
        doctype: 'Purchase Order',
        documentId: newPoId,
        action: 'Amended',
        changedBy: guard.session?.user.name || '',
        before: null,
        after: { po_id: newPoId, amended_from: po_id, status: 'Draft' },
      });

      return NextResponse.json({ success: true, po_id: newPoId });
    } else if (action === 'approve' || action === 'reject') {
      if (!guard.session?.user.permissions.can_approve) {
        return NextResponse.json({ error: 'Kamu tidak punya izin approve' }, { status: 403 });
      }
      if (currentObj.status !== 'Submitted') {
        return NextResponse.json({ error: 'PO harus berstatus Submitted sebelum di-approve/reject' }, { status: 400 });
      }
      currentObj.approval_status = action === 'approve' ? 'Approved' : 'Rejected';
      currentObj.approved_by = guard.session?.user.name || '';
      currentObj.approved_at = now;
      logAction = action === 'approve' ? 'Approved' : 'Rejected';
    } else if (action === 'receive') {
      if (currentObj.status !== 'Submitted') {
        return NextResponse.json({ error: 'PO harus berstatus Submitted sebelum diterima' }, { status: 400 });
      }
      if (currentObj.approval_status !== 'Approved') {
        return NextResponse.json({ error: 'PO harus di-approve dulu sebelum barang diterima' }, { status: 400 });
      }

      // Full receipt: bring in the full ordered qty for every line item.
      const { records: items } = await readSheetAsObjects<any>(ITEM_SHEET);
      const { records: itemMaster } = await readSheetAsObjects<any>('item_list');
      const poItems = items.filter((i) => i.po_id === po_id);

      const prId = await getNextDocId('PR');
      const { headers: prHeaders } = await readSheetAsObjects<any>('purchase_receipt');
      const prRow = objectToRow(prHeaders, {
        pr_id: prId,
        po_id,
        supplier_id: currentObj.supplier_id,
        posting_date: now.slice(0, 10),
        status: 'Submitted',
        approval_status: 'Approved',
        owner: guard.session?.user.name || '',
        creation: now,
      });
      await appendSheet('purchase_receipt', [prRow]);

      const { headers: prItemHeaders } = await readSheetAsObjects<any>('purchase_receipt_item');
      const prItemRows = poItems.map((i) =>
        objectToRow(prItemHeaders, {
          pr_id: prId,
          po_id,
          item_code: i.item_code,
          received_qty: i.qty,
          warehouse_id: i.warehouse_id,
          rate: i.rate,
        })
      );
      await appendSheet('purchase_receipt_item', prItemRows);

      for (const item of poItems) {
        const master = itemMaster.find((m) => m.item_code === item.item_code);
        const valuationRate = parseFloat(item.rate) || (master ? parseFloat(master.purchase_price) : 0) || 0;
        await appendStockLedgerEntry({
          itemCode: item.item_code,
          warehouseId: item.warehouse_id,
          voucherType: 'Purchase Receipt',
          voucherId: prId,
          actualQty: parseFloat(item.qty) || 0,
          valuationRate,
          postingDate: now.slice(0, 10),
        });
      }

      // Mark all PO item lines as fully received.
      const poItemRows = await readSheet(ITEM_SHEET);
      const poItemHeaders = (poItemRows[0] || []).map((h: any) => String(h ?? '').trim());
      const poCol = poItemHeaders.indexOf('po_id');
      const qtyCol = poItemHeaders.indexOf('qty');
      const receivedCol = poItemHeaders.indexOf('received_qty');
      for (let i = 1; i < poItemRows.length; i++) {
        if (poItemRows[i][poCol] === po_id) {
          poItemRows[i][receivedCol] = poItemRows[i][qtyCol];
        }
      }
      const lastItemCol = String.fromCharCode(65 + poItemHeaders.length - 1);
      await writeSheet(ITEM_SHEET, `A2:${lastItemCol}${poItemRows.length}`, poItemRows.slice(1));

      currentObj.status = 'Received';
      logAction = 'Received';
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    currentObj.modified_by = guard.session?.user.name || '';
    currentObj.modified = now;

    const newRow = objectToRow(headers, currentObj);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    await logActivity({ doctype: 'Purchase Order', documentId: po_id, action: logAction, changedBy: guard.session?.user.name || '', before: originalObj, after: currentObj });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
  }
}
