import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

const MAX_PER_GROUP = 5;

interface SearchResult {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
}

interface SearchGroup {
  type: string;
  results: SearchResult[];
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ groups: [] });

  const perms = session.user.permissions;
  const groups: SearchGroup[] = [];
  const contains = { contains: q, mode: 'insensitive' as const };

  try {
    const jobs: Promise<void>[] = [];

    if (perms.purchasing) {
      jobs.push(
        prisma.purchaseOrder
          .findMany({ where: { OR: [{ poId: contains }, { supplierId: contains }] }, take: MAX_PER_GROUP })
          .then((records) => {
            const results = records.map((r) => ({ id: r.poId, label: r.poId, subtitle: r.status, href: `/dashboard/purchasing/purchase-order/${encodeURIComponent(r.poId)}` }));
            if (results.length) groups.push({ type: 'Purchase Order', results });
          })
      );
      jobs.push(
        prisma.purchaseInvoice
          .findMany({ where: { OR: [{ piId: contains }, { poId: contains }] }, take: MAX_PER_GROUP })
          .then((records) => {
            const results = records.map((r) => ({ id: r.piId, label: r.piId, subtitle: r.status, href: `/dashboard/purchasing/purchase-invoice/${encodeURIComponent(r.piId)}` }));
            if (results.length) groups.push({ type: 'Purchase Invoice', results });
          })
      );
      jobs.push(
        prisma.supplier
          .findMany({ where: { OR: [{ supplierId: contains }, { supplierName: contains }] }, take: MAX_PER_GROUP })
          .then((records) => {
            const results = records.map((r) => ({ id: r.supplierId, label: r.supplierName || r.supplierId, subtitle: r.supplierId, href: `/dashboard/purchasing/supplier/${encodeURIComponent(r.supplierId)}` }));
            if (results.length) groups.push({ type: 'Supplier', results });
          })
      );
    }

    if (perms.sales_order) {
      jobs.push(
        prisma.salesOrder
          .findMany({ where: { OR: [{ soId: contains }, { customerId: contains }] }, take: MAX_PER_GROUP })
          .then((records) => {
            const results = records.map((r) => ({ id: r.soId, label: r.soId, subtitle: r.status, href: `/dashboard/sales-order/sales-order/${encodeURIComponent(r.soId)}` }));
            if (results.length) groups.push({ type: 'Sales Order', results });
          })
      );
      jobs.push(
        prisma.salesInvoice
          .findMany({ where: { OR: [{ siId: contains }, { soId: contains }] }, take: MAX_PER_GROUP })
          .then((records) => {
            const results = records.map((r) => ({ id: r.siId, label: r.siId, subtitle: r.status, href: `/dashboard/sales-order/sales-invoice/${encodeURIComponent(r.siId)}` }));
            if (results.length) groups.push({ type: 'Sales Invoice', results });
          })
      );
      jobs.push(
        prisma.customer
          .findMany({ where: { OR: [{ customerId: contains }, { customerName: contains }] }, take: MAX_PER_GROUP })
          .then((records) => {
            const results = records.map((r) => ({ id: r.customerId, label: r.customerName || r.customerId, subtitle: r.customerId, href: `/dashboard/sales-order/customer/${encodeURIComponent(r.customerId)}` }));
            if (results.length) groups.push({ type: 'Customer', results });
          })
      );
    }

    if (perms.delivery_order || perms.sales_order) {
      jobs.push(
        prisma.deliveryNote
          .findMany({ where: { OR: [{ dnId: contains }, { soId: contains }] }, take: MAX_PER_GROUP })
          .then((records) => {
            const results = records.map((r) => ({ id: r.dnId, label: r.dnId, subtitle: r.status, href: `/dashboard/delivery-order/delivery-note/${encodeURIComponent(r.dnId)}` }));
            if (results.length) groups.push({ type: 'Delivery Note', results });
          })
      );
    }

    if (perms.inventory) {
      jobs.push(
        prisma.item
          .findMany({ where: { OR: [{ itemCode: contains }, { itemName: contains }] }, take: MAX_PER_GROUP })
          .then((records) => {
            const results = records.map((r) => ({ id: r.itemCode, label: r.itemName || r.itemCode, subtitle: r.itemCode, href: `/dashboard/inventory/item/${encodeURIComponent(r.itemCode)}` }));
            if (results.length) groups.push({ type: 'Item', results });
          })
      );
      jobs.push(
        prisma.warehouse
          .findMany({ where: { OR: [{ warehouseId: contains }, { warehouseName: contains }] }, take: MAX_PER_GROUP })
          .then((records) => {
            const results = records.map((r) => ({ id: r.warehouseId, label: r.warehouseName || r.warehouseId, subtitle: r.warehouseId, href: `/dashboard/inventory/warehouse/${encodeURIComponent(r.warehouseId)}` }));
            if (results.length) groups.push({ type: 'Warehouse', results });
          })
      );
    }

    if (perms.staff) {
      jobs.push(
        prisma.staffList
          .findMany({ where: { employeeName: contains }, take: MAX_PER_GROUP })
          .then((records) => {
            const results = records.map((r) => ({ id: r.employeeId, label: r.employeeName, subtitle: 'Staff', href: `/dashboard/hr/staff` }));
            if (results.length) groups.push({ type: 'Staff', results });
          })
      );
    }

    await Promise.all(jobs);

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Error running global search:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
