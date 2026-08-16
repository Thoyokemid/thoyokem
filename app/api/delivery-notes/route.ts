import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getAmendedDocId } from '@/lib/numbering';
import { appendStockLedgerEntry, getCurrentStockQty } from '@/lib/stock';
import { logActivity } from '@/lib/activityLog';

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
    const records = await prisma.deliveryNote.findMany({
      include: { items: true },
      orderBy: { creation: 'desc' },
    });
    const customers = await prisma.customer.findMany({ select: { customerId: true, customerName: true } });
    const customerMap = new Map(customers.map((c) => [c.customerId, c.customerName]));

    const result = records.map((dn) => ({
      dn_id: dn.dnId,
      so_id: dn.soId,
      customer_id: dn.customerId,
      customer_name: customerMap.get(dn.customerId) || dn.customerId,
      posting_date: dn.postingDate,
      status: dn.status,
      owner: dn.owner,
      creation: dn.creation,
      amended_from: dn.amendedFrom || '',
      items: dn.items.map((i) => ({
        item_code: i.itemCode,
        item_name: i.itemName,
        uom: i.uom,
        delivered_qty: Number(i.deliveredQty),
        warehouse_id: i.warehouseId,
        rate: Number(i.rate),
      })),
    }));

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

    const current = await prisma.deliveryNote.findUnique({ where: { dnId: dn_id } });
    if (!current) return NextResponse.json({ error: 'Delivery note not found' }, { status: 404 });
    const original = { ...current };

    const now = new Date().toISOString();
    const items = await prisma.deliveryNoteItem.findMany({ where: { dnId: dn_id } });

    let logAction: 'Updated' | 'Cancelled' = 'Updated';
    const updateData: Record<string, any> = {};

    if (action === 'confirm_pick') {
      if (current.status !== 'Unallocated') {
        return NextResponse.json({ error: 'Hanya delivery note berstatus Unallocated yang bisa di-Pick Confirm' }, { status: 400 });
      }
      updateData.status = 'Pick Confirmed';
    } else if (action === 'complete_pack') {
      if (current.status !== 'Pick Confirmed') {
        return NextResponse.json({ error: 'Hanya delivery note berstatus Pick Confirmed yang bisa ditandai Packing Completed' }, { status: 400 });
      }
      updateData.status = 'Packing Completed';
    } else if (action === 'good_issue') {
      if (current.status !== 'Packing Completed') {
        return NextResponse.json({ error: 'Hanya delivery note berstatus Packing Completed yang bisa di-Good Issue' }, { status: 400 });
      }

      const itemMaster = await prisma.item.findMany();

      // Guard against negative stock — time has passed since picking started.
      for (const item of items) {
        const qty = Number(item.deliveredQty);
        if (qty <= 0) continue;
        const available = await getCurrentStockQty(item.itemCode, item.warehouseId);
        if (available < qty) {
          return NextResponse.json(
            { error: `Stok tidak cukup untuk ${item.itemCode} di ${item.warehouseId} (tersedia ${available}, butuh ${qty})` },
            { status: 400 }
          );
        }
      }

      // This is the moment stock actually leaves the warehouse — the only place
      // a Delivery Note is allowed to touch the stock ledger.
      for (const item of items) {
        const qty = Number(item.deliveredQty);
        if (qty <= 0) continue;
        const master = itemMaster.find((m) => m.itemCode === item.itemCode);
        await appendStockLedgerEntry({
          itemCode: item.itemCode,
          warehouseId: item.warehouseId,
          voucherType: 'Delivery Note',
          voucherId: dn_id,
          actualQty: -qty,
          valuationRate: master ? Number(master.purchasePrice) : 0,
          postingDate: now.slice(0, 10),
        });
      }

      // Mark the SO line items delivered, and the SO itself as fully Delivered.
      const soItems = await prisma.salesOrderItem.findMany({ where: { soId: current.soId } });
      await prisma.$transaction(
        soItems
          .filter((si) => items.some((it) => it.itemCode === si.itemCode))
          .map((si) => prisma.salesOrderItem.update({ where: { id: si.id }, data: { deliveredQty: si.qty } }))
      );

      await prisma.salesOrder.update({ where: { soId: current.soId }, data: { status: 'Delivered' } });

      updateData.status = 'Good Issued';
    } else if (action === 'cancel') {
      if (current.status === 'Cancelled') {
        return NextResponse.json({ error: 'Delivery note sudah dibatalkan' }, { status: 400 });
      }

      const wasGoodIssued = current.status === 'Good Issued';

      if (wasGoodIssued) {
        const invoiceCount = await prisma.salesInvoice.count({ where: { dnId: dn_id } });
        if (invoiceCount > 0) {
          return NextResponse.json({ error: 'Batalkan/hapus Sales Invoice yang terkait delivery ini dulu' }, { status: 400 });
        }

        // Stock already left the warehouse — reverse it back.
        const itemMaster = await prisma.item.findMany();
        for (const item of items) {
          const qty = Number(item.deliveredQty);
          if (qty <= 0) continue;
          const master = itemMaster.find((m) => m.itemCode === item.itemCode);
          await appendStockLedgerEntry({
            itemCode: item.itemCode,
            warehouseId: item.warehouseId,
            voucherType: 'Delivery Note Cancellation',
            voucherId: dn_id,
            actualQty: qty,
            valuationRate: master ? Number(master.purchasePrice) : 0,
            postingDate: now.slice(0, 10),
          });
        }
      }
      // If it hadn't reached Good Issued yet, nothing was ever deducted — no reversal needed.

      // Reopen the parent SO so it can be re-delivered (via amend, or a fresh deliver action).
      const parentSo = await prisma.salesOrder.findUnique({ where: { soId: current.soId } });
      if (parentSo && (parentSo.status === 'Delivered' || parentSo.status === 'In Delivery')) {
        await prisma.salesOrder.update({ where: { soId: current.soId }, data: { status: 'Confirmed' } });
      }

      if (wasGoodIssued) {
        await prisma.salesOrderItem.updateMany({ where: { soId: current.soId }, data: { deliveredQty: 0 } });
      }

      updateData.status = 'Cancelled';
      logAction = 'Cancelled';
    } else if (action === 'amend') {
      if (current.status !== 'Cancelled') {
        return NextResponse.json({ error: 'Hanya delivery note yang sudah dibatalkan yang bisa di-amend' }, { status: 400 });
      }

      const allDnIds = (await prisma.deliveryNote.findMany({ select: { dnId: true } })).map((d) => d.dnId);
      const newDnId = getAmendedDocId(dn_id, allDnIds);

      await prisma.deliveryNote.create({
        data: {
          dnId: newDnId,
          soId: current.soId,
          customerId: current.customerId,
          postingDate: now.slice(0, 10),
          status: 'Unallocated',
          approvalStatus: 'Approved',
          owner: session!.user.name || '',
          creation: now,
          amendedFrom: dn_id,
          items: {
            create: items.map((i) => ({
              soId: current.soId,
              itemCode: i.itemCode,
              itemName: i.itemName,
              uom: i.uom,
              deliveredQty: i.deliveredQty,
              warehouseId: i.warehouseId,
              rate: i.rate,
            })),
          },
        },
      });

      // Restart the fulfillment pipeline for the parent SO — stock only moves
      // again once this new DN goes through Pack + Good Issue.
      await prisma.salesOrder.update({ where: { soId: current.soId }, data: { status: 'In Delivery' } });

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

    const updated = await prisma.deliveryNote.update({ where: { dnId: dn_id }, data: updateData });

    await logActivity({ doctype: 'Delivery Note', documentId: dn_id, action: logAction, changedBy: session!.user.name || '', before: original, after: updated });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating delivery note:', error);
    return NextResponse.json({ error: 'Failed to update delivery note' }, { status: 500 });
  }
}
