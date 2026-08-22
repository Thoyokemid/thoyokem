import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getNextDocId, getAmendedDocId } from '@/lib/numbering';
import { appendStockLedgerEntry } from '@/lib/stock';
import { logActivity } from '@/lib/activityLog';
import { broadcastNotificationsChanged } from '@/lib/realtime';
import { validate, purchaseOrderCreateSchema, purchaseOrderActionSchema } from '@/lib/validation';
import { hasDoctypePermission, requiresOwnerMatch, PermissionAction } from '@/lib/permissions';

async function requireAccess(action: PermissionAction) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!(await hasDoctypePermission(session, 'Purchase Order', action))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireAccess('read');
  if (guard.error) return guard.error;

  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: { items: true },
      orderBy: { creation: 'desc' },
    });
    const suppliers = await prisma.supplier.findMany({ select: { supplierId: true, supplierName: true } });
    const supplierMap = new Map(suppliers.map((s) => [s.supplierId, s.supplierName]));

    const result = orders.map((po) => ({
      po_id: po.poId,
      supplier_id: po.supplierId,
      supplier_name: supplierMap.get(po.supplierId) || po.supplierId,
      order_date: po.orderDate,
      expected_date: po.expectedDate || '',
      status: po.status,
      approval_status: po.approvalStatus || 'Pending',
      approved_by: po.approvedBy || '',
      total_amount: Number(po.totalAmount),
      owner: po.owner,
      creation: po.creation,
      amended_from: po.amendedFrom || '',
      items: po.items.map((i) => ({
        po_id: i.poId,
        item_code: i.itemCode,
        item_name: i.itemName,
        uom: i.uom,
        qty: Number(i.qty),
        rate: Number(i.rate),
        amount: Number(i.amount),
        received_qty: Number(i.receivedQty),
        warehouse_id: i.warehouseId,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAccess('create');
  if (guard.error) return guard.error;

  try {
    const parsed = validate(purchaseOrderCreateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { supplier_id, expected_date, items } = parsed.data;

    const poId = await getNextDocId('PO');
    const now = new Date().toISOString();
    const totalAmount = items.reduce((sum: number, i: any) => sum + i.qty * i.rate, 0);
    const itemMaster = await prisma.item.findMany();
    const itemMasterMap = new Map(itemMaster.map((i) => [i.itemCode, i]));

    await prisma.purchaseOrder.create({
      data: {
        poId,
        supplierId: supplier_id,
        orderDate: now.slice(0, 10),
        expectedDate: expected_date || null,
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
            receivedQty: 0,
            warehouseId: i.warehouse_id,
          })),
        },
      },
    });

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

const PO_ACTION_PERMISSION: Record<string, PermissionAction> = {
  submit: 'submit', cancel: 'cancel', amend: 'amend', approve: 'approve', reject: 'approve', receive: 'write',
};

// PATCH performs a status-transition action: submit | receive | cancel | amend | approve | reject
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = validate(purchaseOrderActionSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { po_id, action } = parsed.data;

    if (!(await hasDoctypePermission(session, 'Purchase Order', PO_ACTION_PERMISSION[action] || 'write'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const guard = { session };

    const current = await prisma.purchaseOrder.findUnique({ where: { poId: po_id } });
    if (!current) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    if (await requiresOwnerMatch(guard.session!, 'Purchase Order') && current.owner !== guard.session!.user.name) {
      return NextResponse.json({ error: 'Anda hanya bisa mengubah Purchase Order yang Anda buat sendiri' }, { status: 403 });
    }

    const original = { ...current };

    const now = new Date().toISOString();
    let logAction: any = 'Updated';
    const updateData: Record<string, any> = {};

    if (action === 'submit') {
      if (current.status !== 'Draft') {
        return NextResponse.json({ error: 'Hanya PO berstatus Draft yang bisa di-submit' }, { status: 400 });
      }
      updateData.status = 'Submitted';
      logAction = 'Submitted';
    } else if (action === 'cancel') {
      if (current.status === 'Cancelled') {
        return NextResponse.json({ error: 'PO sudah dibatalkan' }, { status: 400 });
      }

      if (current.status === 'Received') {
        const invoiceCount = await prisma.purchaseInvoice.count({ where: { poId: po_id, status: { not: 'Cancelled' } } });
        if (invoiceCount > 0) {
          return NextResponse.json({ error: 'Batalkan Purchase Invoice yang terkait PO ini dulu sebelum membatalkan PO' }, { status: 400 });
        }

        // Reverse the stock impact of the receipt.
        const poItems = await prisma.purchaseOrderItem.findMany({ where: { poId: po_id } });
        for (const item of poItems) {
          const receivedQty = Number(item.receivedQty);
          if (receivedQty <= 0) continue;
          await appendStockLedgerEntry({
            itemCode: item.itemCode,
            warehouseId: item.warehouseId,
            voucherType: 'Purchase Order Cancellation',
            voucherId: po_id,
            actualQty: -receivedQty,
            valuationRate: Number(item.rate),
            postingDate: now.slice(0, 10),
          });
        }

        // Mark linked purchase receipts as cancelled too (cosmetic, for traceability).
        await prisma.purchaseReceipt.updateMany({ where: { poId: po_id }, data: { status: 'Cancelled' } });
      }

      updateData.status = 'Cancelled';
      logAction = 'Cancelled';
    } else if (action === 'amend') {
      if (current.status !== 'Cancelled') {
        return NextResponse.json({ error: 'Hanya PO yang sudah dibatalkan yang bisa di-amend' }, { status: 400 });
      }

      const allPoIds = (await prisma.purchaseOrder.findMany({ select: { poId: true } })).map((p) => p.poId);
      const newPoId = getAmendedDocId(po_id, allPoIds);

      const poItems = await prisma.purchaseOrderItem.findMany({ where: { poId: po_id } });

      await prisma.purchaseOrder.create({
        data: {
          poId: newPoId,
          supplierId: current.supplierId,
          orderDate: now.slice(0, 10),
          expectedDate: current.expectedDate,
          status: 'Draft',
          totalAmount: current.totalAmount,
          approvalStatus: 'Pending',
          owner: guard.session?.user.name || '',
          creation: now,
          modifiedBy: guard.session?.user.name || '',
          modified: now,
          amendedFrom: po_id,
          items: {
            create: poItems.map((i) => ({
              itemCode: i.itemCode,
              itemName: i.itemName,
              uom: i.uom,
              qty: i.qty,
              rate: i.rate,
              amount: i.amount,
              receivedQty: 0,
              warehouseId: i.warehouseId,
            })),
          },
        },
      });

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
      // Permission already checked above via hasDoctypePermission(..., 'approve').
      if (current.status !== 'Submitted') {
        return NextResponse.json({ error: 'PO harus berstatus Submitted sebelum di-approve/reject' }, { status: 400 });
      }
      updateData.approvalStatus = action === 'approve' ? 'Approved' : 'Rejected';
      updateData.approvedBy = guard.session?.user.name || '';
      updateData.approvedAt = now;
      logAction = action === 'approve' ? 'Approved' : 'Rejected';
    } else if (action === 'receive') {
      if (current.status !== 'Submitted') {
        return NextResponse.json({ error: 'PO harus berstatus Submitted sebelum diterima' }, { status: 400 });
      }
      if (current.approvalStatus !== 'Approved') {
        return NextResponse.json({ error: 'PO harus di-approve dulu sebelum barang diterima' }, { status: 400 });
      }

      // Full receipt: bring in the full ordered qty for every line item.
      const poItems = await prisma.purchaseOrderItem.findMany({ where: { poId: po_id } });
      const itemMaster = await prisma.item.findMany();

      const prId = await getNextDocId('PR');
      await prisma.purchaseReceipt.create({
        data: {
          prId,
          poId: po_id,
          supplierId: current.supplierId,
          postingDate: now.slice(0, 10),
          status: 'Submitted',
          approvalStatus: 'Approved',
          owner: guard.session?.user.name || '',
          creation: now,
        },
      });

      await prisma.purchaseReceiptItem.createMany({
        data: poItems.map((i) => ({
          prId,
          poId: po_id,
          itemCode: i.itemCode,
          receivedQty: i.qty,
          warehouseId: i.warehouseId,
          rate: i.rate,
        })),
      });

      for (const item of poItems) {
        const master = itemMaster.find((m) => m.itemCode === item.itemCode);
        const valuationRate = Number(item.rate) || (master ? Number(master.purchasePrice) : 0) || 0;
        await appendStockLedgerEntry({
          itemCode: item.itemCode,
          warehouseId: item.warehouseId,
          voucherType: 'Purchase Receipt',
          voucherId: prId,
          actualQty: Number(item.qty),
          valuationRate,
          postingDate: now.slice(0, 10),
        });
      }

      // Mark all PO item lines as fully received.
      await prisma.$transaction(
        poItems.map((i) =>
          prisma.purchaseOrderItem.update({ where: { id: i.id }, data: { receivedQty: i.qty } })
        )
      );

      updateData.status = 'Received';
      logAction = 'Received';
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    updateData.modifiedBy = guard.session?.user.name || '';
    updateData.modified = now;

    const updated = await prisma.purchaseOrder.update({ where: { poId: po_id }, data: updateData });

    await logActivity({ doctype: 'Purchase Order', documentId: po_id, action: logAction, changedBy: guard.session?.user.name || '', before: original, after: updated });

    await broadcastNotificationsChanged();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
  }
}
