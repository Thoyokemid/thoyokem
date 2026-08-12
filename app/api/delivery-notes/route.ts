import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, writeSheet, appendSheet, readSheetAsObjects, objectToRow, findRowIndexByField } from '@/lib/sheets';
import { getAmendedDocId } from '@/lib/numbering';
import { appendStockLedgerEntry, getCurrentStockQty } from '@/lib/stock';
import { logActivity } from '@/lib/activityLog';

const SHEET = 'delivery_note';
const ITEM_SHEET = 'delivery_note_item';

function requireAccess(session: any) {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user.permissions.delivery_order && !session.user.permissions.sales_order) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = requireAccess(session);
  if (err) return err;

  try {
    const { records } = await readSheetAsObjects<any>(SHEET);
    const { records: items } = await readSheetAsObjects<any>(ITEM_SHEET);
    const { records: customers } = await readSheetAsObjects<any>('customer_list');
    const { records: itemMaster } = await readSheetAsObjects<any>('item_list');
    const customerMap = new Map(customers.map((c) => [c.customer_id, c.customer_name]));
    const itemMasterMap = new Map(itemMaster.map((i) => [i.item_code, i]));

    const result = records
      .map((dn) => ({
        dn_id: dn.dn_id,
        so_id: dn.so_id,
        customer_id: dn.customer_id,
        customer_name: customerMap.get(dn.customer_id) || dn.customer_id,
        posting_date: dn.posting_date,
        status: dn.status,
        owner: dn.owner,
        creation: dn.creation,
        amended_from: dn.amended_from || '',
        items: items
          .filter((i) => i.dn_id === dn.dn_id)
          .map((i) => ({
            item_code: i.item_code,
            item_name: i.item_name || itemMasterMap.get(i.item_code)?.item_name || i.item_code,
            uom: i.uom || itemMasterMap.get(i.item_code)?.unit || '-',
            delivered_qty: parseFloat(i.delivered_qty) || 0,
            warehouse_id: i.warehouse_id,
            rate: parseFloat(i.rate) || 0,
          })),
      }))
      .reverse();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching delivery notes:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery notes' }, { status: 500 });
  }
}

// PATCH performs a status-transition action: confirm_pick | complete_pack | good_issue | cancel | amend
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = requireAccess(session);
  if (err) return err;

  try {
    const { dn_id, action } = await request.json();
    if (!dn_id || !action) {
      return NextResponse.json({ error: 'dn_id dan action wajib diisi' }, { status: 400 });
    }

    const rows = await readSheet(SHEET);
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'dn_id', dn_id);
    if (dataRowIndex === -1) return NextResponse.json({ error: 'Delivery note not found' }, { status: 404 });

    const sheetRowIndex = dataRowIndex + 1;
    const currentRow = rows[sheetRowIndex] || [];
    const currentObj: Record<string, any> = {};
    headers.forEach((h, i) => (currentObj[h] = currentRow[i] ?? ''));
    const originalObj = { ...currentObj };

    const now = new Date().toISOString();
    const { records: dnItems } = await readSheetAsObjects<any>(ITEM_SHEET);
    const items = dnItems.filter((i) => i.dn_id === dn_id);

    let logAction: 'Updated' | 'Cancelled' = 'Updated';

    if (action === 'confirm_pick') {
      if (currentObj.status !== 'Unallocated') {
        return NextResponse.json({ error: 'Hanya delivery note berstatus Unallocated yang bisa di-Pick Confirm' }, { status: 400 });
      }
      currentObj.status = 'Pick Confirmed';
    } else if (action === 'complete_pack') {
      if (currentObj.status !== 'Pick Confirmed') {
        return NextResponse.json({ error: 'Hanya delivery note berstatus Pick Confirmed yang bisa ditandai Packing Completed' }, { status: 400 });
      }
      currentObj.status = 'Packing Completed';
    } else if (action === 'good_issue') {
      if (currentObj.status !== 'Packing Completed') {
        return NextResponse.json({ error: 'Hanya delivery note berstatus Packing Completed yang bisa di-Good Issue' }, { status: 400 });
      }

      const { records: itemMaster } = await readSheetAsObjects<any>('item_list');

      // Guard against negative stock — time has passed since picking started.
      for (const item of items) {
        const qty = parseFloat(item.delivered_qty) || 0;
        if (qty <= 0) continue;
        const available = await getCurrentStockQty(item.item_code, item.warehouse_id);
        if (available < qty) {
          return NextResponse.json(
            { error: `Stok tidak cukup untuk ${item.item_code} di ${item.warehouse_id} (tersedia ${available}, butuh ${qty})` },
            { status: 400 }
          );
        }
      }

      // This is the moment stock actually leaves the warehouse — the only place
      // a Delivery Note is allowed to touch the stock ledger.
      for (const item of items) {
        const qty = parseFloat(item.delivered_qty) || 0;
        if (qty <= 0) continue;
        const master = itemMaster.find((m) => m.item_code === item.item_code);
        await appendStockLedgerEntry({
          itemCode: item.item_code,
          warehouseId: item.warehouse_id,
          voucherType: 'Delivery Note',
          voucherId: dn_id,
          actualQty: -qty,
          valuationRate: parseFloat(master?.purchase_price) || 0,
          postingDate: now.slice(0, 10),
        });
      }

      // Mark the SO line items delivered, and the SO itself as fully Delivered.
      const soItemRows = await readSheet('sales_order_item');
      const soItemHeaders = (soItemRows[0] || []).map((h: any) => String(h ?? '').trim());
      const siSoCol = soItemHeaders.indexOf('so_id');
      const siItemCol = soItemHeaders.indexOf('item_code');
      const siQtyCol = soItemHeaders.indexOf('qty');
      const siDeliveredCol = soItemHeaders.indexOf('delivered_qty');
      for (let i = 1; i < soItemRows.length; i++) {
        if (soItemRows[i][siSoCol] === currentObj.so_id) {
          const match = items.find((it) => it.item_code === soItemRows[i][siItemCol]);
          if (match) soItemRows[i][siDeliveredCol] = soItemRows[i][siQtyCol];
        }
      }
      if (soItemRows.length > 1) {
        const lastCol = String.fromCharCode(65 + soItemHeaders.length - 1);
        await writeSheet('sales_order_item', `A2:${lastCol}${soItemRows.length}`, soItemRows.slice(1));
      }

      const soRows = await readSheet('sales_order');
      const soHeaders = (soRows[0] || []).map((h: any) => String(h ?? '').trim());
      const soIdCol = soHeaders.indexOf('so_id');
      const soStatusCol = soHeaders.indexOf('status');
      for (let i = 1; i < soRows.length; i++) {
        if (soRows[i][soIdCol] === currentObj.so_id) soRows[i][soStatusCol] = 'Delivered';
      }
      if (soRows.length > 1) {
        const lastCol = String.fromCharCode(65 + soHeaders.length - 1);
        await writeSheet('sales_order', `A2:${lastCol}${soRows.length}`, soRows.slice(1));
      }

      currentObj.status = 'Good Issued';
    } else if (action === 'cancel') {
      if (currentObj.status === 'Cancelled') {
        return NextResponse.json({ error: 'Delivery note sudah dibatalkan' }, { status: 400 });
      }

      const wasGoodIssued = currentObj.status === 'Good Issued';

      if (wasGoodIssued) {
        const { records: invoices } = await readSheetAsObjects<any>('sales_invoice');
        const hasInvoice = invoices.some((inv) => inv.dn_id === dn_id);
        if (hasInvoice) {
          return NextResponse.json({ error: 'Batalkan/hapus Sales Invoice yang terkait delivery ini dulu' }, { status: 400 });
        }

        // Stock already left the warehouse — reverse it back.
        const { records: itemMaster } = await readSheetAsObjects<any>('item_list');
        for (const item of items) {
          const qty = parseFloat(item.delivered_qty) || 0;
          if (qty <= 0) continue;
          const master = itemMaster.find((m) => m.item_code === item.item_code);
          await appendStockLedgerEntry({
            itemCode: item.item_code,
            warehouseId: item.warehouse_id,
            voucherType: 'Delivery Note Cancellation',
            voucherId: dn_id,
            actualQty: qty,
            valuationRate: parseFloat(master?.purchase_price) || 0,
            postingDate: now.slice(0, 10),
          });
        }
      }
      // If it hadn't reached Good Issued yet, nothing was ever deducted — no reversal needed.

      // Reopen the parent SO so it can be re-delivered (via amend, or a fresh deliver action).
      const soRows = await readSheet('sales_order');
      const soHeaders = (soRows[0] || []).map((h: any) => String(h ?? '').trim());
      const soIdCol = soHeaders.indexOf('so_id');
      const soStatusCol = soHeaders.indexOf('status');
      for (let i = 1; i < soRows.length; i++) {
        if (soRows[i][soIdCol] === currentObj.so_id && (soRows[i][soStatusCol] === 'Delivered' || soRows[i][soStatusCol] === 'In Delivery')) {
          soRows[i][soStatusCol] = 'Confirmed';
        }
      }
      if (soRows.length > 1) {
        const lastCol = String.fromCharCode(65 + soHeaders.length - 1);
        await writeSheet('sales_order', `A2:${lastCol}${soRows.length}`, soRows.slice(1));
      }

      if (wasGoodIssued) {
        const soItemRows = await readSheet('sales_order_item');
        const soItemHeaders = (soItemRows[0] || []).map((h: any) => String(h ?? '').trim());
        const siSoCol = soItemHeaders.indexOf('so_id');
        const siDeliveredCol = soItemHeaders.indexOf('delivered_qty');
        for (let i = 1; i < soItemRows.length; i++) {
          if (soItemRows[i][siSoCol] === currentObj.so_id) soItemRows[i][siDeliveredCol] = 0;
        }
        if (soItemRows.length > 1) {
          const lastCol = String.fromCharCode(65 + soItemHeaders.length - 1);
          await writeSheet('sales_order_item', `A2:${lastCol}${soItemRows.length}`, soItemRows.slice(1));
        }
      }

      currentObj.status = 'Cancelled';
      logAction = 'Cancelled';
    } else if (action === 'amend') {
      if (currentObj.status !== 'Cancelled') {
        return NextResponse.json({ error: 'Hanya delivery note yang sudah dibatalkan yang bisa di-amend' }, { status: 400 });
      }

      const { records: allDns } = await readSheetAsObjects<any>(SHEET);
      const newDnId = getAmendedDocId(dn_id, allDns.map((d) => d.dn_id));

      const { headers: dnHeaders } = await readSheetAsObjects<any>(SHEET);
      const newDnRow = objectToRow(dnHeaders, {
        dn_id: newDnId,
        so_id: currentObj.so_id,
        customer_id: currentObj.customer_id,
        posting_date: now.slice(0, 10),
        status: 'Unallocated',
        approval_status: 'Approved',
        owner: session!.user.name || '',
        creation: now,
        amended_from: dn_id,
      });
      await appendSheet(SHEET, [newDnRow]);

      const { headers: dnItemHeaders } = await readSheetAsObjects<any>(ITEM_SHEET);
      const newItemRows = items.map((i) =>
        objectToRow(dnItemHeaders, {
          dn_id: newDnId,
          so_id: currentObj.so_id,
          item_code: i.item_code,
          item_name: i.item_name || i.item_code,
          uom: i.uom || '',
          delivered_qty: i.delivered_qty,
          warehouse_id: i.warehouse_id,
          rate: i.rate,
        })
      );
      await appendSheet(ITEM_SHEET, newItemRows);

      // Restart the fulfillment pipeline for the parent SO — stock only moves
      // again once this new DN goes through Pack + Good Issue.
      const soRows = await readSheet('sales_order');
      const soHeaders = (soRows[0] || []).map((h: any) => String(h ?? '').trim());
      const soIdCol = soHeaders.indexOf('so_id');
      const soStatusCol = soHeaders.indexOf('status');
      for (let i = 1; i < soRows.length; i++) {
        if (soRows[i][soIdCol] === currentObj.so_id) soRows[i][soStatusCol] = 'In Delivery';
      }
      if (soRows.length > 1) {
        const lastCol = String.fromCharCode(65 + soHeaders.length - 1);
        await writeSheet('sales_order', `A2:${lastCol}${soRows.length}`, soRows.slice(1));
      }

      await logActivity({
        doctype: 'Delivery Note',
        documentId: newDnId,
        action: 'Amended',
        changedBy: session!.user.name || '',
        before: null,
        after: { dn_id: newDnId, amended_from: dn_id, status: 'Unallocated' },
      });

      return NextResponse.json({ success: true, dn_id: newDnId });
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const newRow = objectToRow(headers, currentObj);
    const lastCol = String.fromCharCode(65 + headers.length - 1);
    await writeSheet(SHEET, `A${sheetRowIndex + 1}:${lastCol}${sheetRowIndex + 1}`, [newRow]);

    await logActivity({ doctype: 'Delivery Note', documentId: dn_id, action: logAction, changedBy: session!.user.name || '', before: originalObj, after: currentObj });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating delivery note:', error);
    return NextResponse.json({ error: 'Failed to update delivery note' }, { status: 500 });
  }
}
