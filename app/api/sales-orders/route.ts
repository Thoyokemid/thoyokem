import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getNextDocId, getAmendedDocId } from '@/lib/numbering';
import { appendStockLedgerEntry, getCurrentStockQty } from '@/lib/stock';
import { logActivity } from '@/lib/activityLog';

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
    const orders = await prisma.salesOrder.findMany({
      include: { items: true },
      orderBy: { creation: 'desc' },
    });
    const customers = await prisma.customer.findMany({ select: { customerId: true, customerName: true } });
    const customerMap = new Map(customers.map((c) => [c.customerId, c.customerName]));

    const result = orders.map((so) => ({
      so_id: so.soId,
      customer_id: so.customerId,
      customer_name: customerMap.get(so.customerId) || so.customerId,
      order_date: so.orderDate,
      delivery_date: so.deliveryDate || '',
      status: so.status,
      approval_status: so.approvalStatus || 'Pending',
      approved_by: so.approvedBy || '',
      total_amount: Number(so.totalAmount),
      owner: so.owner,
      creation: so.creation,
      amended_from: so.amendedFrom || '',
      items: so.items.map((i) => ({
        so_id: i.soId,
        item_code: i.itemCode,
        item_name: i.itemName,
        uom: i.uom,
        qty: Number(i.qty),
        rate: Number(i.rate),
        amount: Number(i.amount),
        delivered_qty: Number(i.deliveredQty),
        warehouse_id: i.warehouseId,
      })),
    }));

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
    const totalAmount = items.reduce((sum: number, i: any) => sum + i.qty * i.rate, 0);
    const itemMaster = await prisma.item.findMany();
    const itemMasterMap = new Map(itemMaster.map((i) => [i.itemCode, i]));

    await prisma.salesOrder.create({
      data: {
        soId,
        customerId: customer_id,
        orderDate: now.slice(0, 10),
        deliveryDate: delivery_date || null,
        status: 'Draft',
        totalAmount,
        approvalStatus: 'Pending',
        owner: guard.session?.user.name || '',
        creation: now,
        modifiedBy: guard.session?.user.name || '',
        modified: now,
        items: {
          create: items.map((i: any) => ({
            itemCode: i.item_code,
            itemName: itemMasterMap.get(i.item_code)?.itemName || i.item_code,
            uom: itemMasterMap.get(i.item_code)?.unit || '',
            qty: i.qty,
            rate: i.rate,
            amount: i.qty * i.rate,
            deliveredQty: 0,
            warehouseId: i.warehouse_id,
          })),
        },
      },
    });

    await logActivity({
      doctype: 'Sales Order',
      documentId: soId,
      action: 'Created',
      changedBy: guard.session?.user.name || '',
      before: null,
      after: { so_id: soId, customer_id, delivery_date: delivery_date || '', status: 'Draft', total_amount: totalAmount },
    });

    return NextResponse.json({ success: true, so_id: soId });
  } catch (error) {
    console.error('Error creating sales order:', error);
    return NextResponse.json({ error: 'Failed to create sales order' }, { status: 500 });
  }
}

// PATCH performs a status-transition action: submit | deliver | cancel | amend | approve | reject
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

    const current = await prisma.salesOrder.findUnique({ where: { soId: so_id } });
    if (!current) return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
    const original = { ...current };

    const now = new Date().toISOString();
    const session = guard.session;
    let logAction: any = 'Updated';
    const updateData: Record<string, any> = {};

    if (action === 'submit') {
      if (current.status !== 'Draft') {
        return NextResponse.json({ error: 'Hanya SO berstatus Draft yang bisa di-submit' }, { status: 400 });
      }
      updateData.status = 'Confirmed';
      logAction = 'Submitted';
    } else if (action === 'cancel') {
      if (current.status === 'Cancelled') {
        return NextResponse.json({ error: 'SO sudah dibatalkan' }, { status: 400 });
      }

      if (current.status === 'Delivered') {
        const invoiceCount = await prisma.salesInvoice.count({ where: { soId: so_id } });
        if (invoiceCount > 0) {
          return NextResponse.json({ error: 'Batalkan/hapus Sales Invoice yang terkait SO ini dulu sebelum membatalkan SO' }, { status: 400 });
        }

        // Reverse the stock impact of the delivery.
        const soItems = await prisma.salesOrderItem.findMany({ where: { soId: so_id } });
        const itemMaster = await prisma.item.findMany();
        for (const item of soItems) {
          const deliveredQty = Number(item.deliveredQty);
          if (deliveredQty <= 0) continue;
          const master = itemMaster.find((m) => m.itemCode === item.itemCode);
          await appendStockLedgerEntry({
            itemCode: item.itemCode,
            warehouseId: item.warehouseId,
            voucherType: 'Sales Order Cancellation',
            voucherId: so_id,
            actualQty: deliveredQty,
            valuationRate: master ? Number(master.purchasePrice) : 0,
            postingDate: now.slice(0, 10),
          });
        }

        // Mark linked delivery notes as cancelled too (cosmetic, for traceability).
        await prisma.deliveryNote.updateMany({ where: { soId: so_id }, data: { status: 'Cancelled' } });
      } else if (current.status === 'In Delivery') {
        // DN hasn't reached Good Issued yet — nothing has left the warehouse, so just
        // void the in-flight delivery note(s) instead of reversing any stock.
        await prisma.deliveryNote.updateMany({
          where: { soId: so_id, status: { not: 'Good Issued' } },
          data: { status: 'Cancelled' },
        });
      }

      updateData.status = 'Cancelled';
      logAction = 'Cancelled';
    } else if (action === 'amend') {
      if (current.status !== 'Cancelled') {
        return NextResponse.json({ error: 'Hanya SO yang sudah dibatalkan yang bisa di-amend' }, { status: 400 });
      }

      const allSoIds = (await prisma.salesOrder.findMany({ select: { soId: true } })).map((s) => s.soId);
      const newSoId = getAmendedDocId(so_id, allSoIds);

      const soItems = await prisma.salesOrderItem.findMany({ where: { soId: so_id } });

      await prisma.salesOrder.create({
        data: {
          soId: newSoId,
          customerId: current.customerId,
          orderDate: now.slice(0, 10),
          deliveryDate: current.deliveryDate,
          status: 'Draft',
          totalAmount: current.totalAmount,
          approvalStatus: 'Pending',
          owner: session?.user.name || '',
          creation: now,
          modifiedBy: session?.user.name || '',
          modified: now,
          amendedFrom: so_id,
          items: {
            create: soItems.map((i) => ({
              itemCode: i.itemCode,
              itemName: i.itemName,
              uom: i.uom,
              qty: i.qty,
              rate: i.rate,
              amount: i.amount,
              deliveredQty: 0,
              warehouseId: i.warehouseId,
            })),
          },
        },
      });

      await logActivity({
        doctype: 'Sales Order',
        documentId: newSoId,
        action: 'Amended',
        changedBy: session?.user.name || '',
        before: null,
        after: { so_id: newSoId, amended_from: so_id, status: 'Draft' },
      });

      return NextResponse.json({ success: true, so_id: newSoId });
    } else if (action === 'approve' || action === 'reject') {
      if (!session?.user.permissions.can_approve) {
        return NextResponse.json({ error: 'Kamu tidak punya izin approve' }, { status: 403 });
      }
      if (current.status !== 'Confirmed') {
        return NextResponse.json({ error: 'SO harus berstatus Confirmed sebelum di-approve/reject' }, { status: 400 });
      }
      updateData.approvalStatus = action === 'approve' ? 'Approved' : 'Rejected';
      updateData.approvedBy = session?.user.name || '';
      updateData.approvedAt = now;
      logAction = action === 'approve' ? 'Approved' : 'Rejected';
    } else if (action === 'deliver') {
      if (current.status !== 'Confirmed') {
        return NextResponse.json({ error: 'SO harus berstatus Confirmed sebelum dikirim' }, { status: 400 });
      }
      if (current.approvalStatus !== 'Approved') {
        return NextResponse.json({ error: 'SO harus di-approve dulu sebelum dikirim' }, { status: 400 });
      }

      const soItems = await prisma.salesOrderItem.findMany({ where: { soId: so_id } });

      // Guard against negative stock.
      for (const item of soItems) {
        const available = await getCurrentStockQty(item.itemCode, item.warehouseId);
        if (available < Number(item.qty)) {
          return NextResponse.json(
            { error: `Stok tidak cukup untuk ${item.itemCode} di ${item.warehouseId} (tersedia ${available}, butuh ${item.qty})` },
            { status: 400 }
          );
        }
      }

      // Stock is NOT deducted here — the DN starts in the warehouse fulfillment
      // pipeline (Unallocated -> Pick Confirmed -> Packing Completed -> Good Issued)
      // and only Good Issue actually moves stock. See app/api/delivery-notes/route.ts action=good_issue.
      const dnId = await getNextDocId('DN');
      await prisma.deliveryNote.create({
        data: {
          dnId,
          soId: so_id,
          customerId: current.customerId,
          postingDate: now.slice(0, 10),
          status: 'Unallocated',
          approvalStatus: 'Approved',
          owner: session?.user.name || '',
          creation: now,
          items: {
            create: soItems.map((i) => ({
              soId: so_id,
              itemCode: i.itemCode,
              itemName: i.itemName,
              uom: i.uom,
              deliveredQty: i.qty,
              warehouseId: i.warehouseId,
              rate: i.rate,
            })),
          },
        },
      });

      updateData.status = 'In Delivery';
      logAction = 'Updated';
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    updateData.modifiedBy = session?.user.name || '';
    updateData.modified = now;

    const updated = await prisma.salesOrder.update({ where: { soId: so_id }, data: updateData });

    await logActivity({ doctype: 'Sales Order', documentId: so_id, action: logAction, changedBy: session?.user.name || '', before: original, after: updated });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating sales order:', error);
    return NextResponse.json({ error: 'Failed to update sales order' }, { status: 500 });
  }
}
