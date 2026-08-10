import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheetAsObjects } from '@/lib/sheets';

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
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ groups: [] });

  const perms = session.user.permissions;
  const groups: SearchGroup[] = [];

  const match = (...values: (string | undefined)[]) =>
    values.some((v) => (v || '').toLowerCase().includes(q));

  try {
    const jobs: Promise<void>[] = [];

    if (perms.purchasing) {
      jobs.push(
        readSheetAsObjects<any>('purchase_order').then(({ records }) => {
          const results = records
            .filter((r) => match(r.po_id, r.supplier_id))
            .slice(0, MAX_PER_GROUP)
            .map((r) => ({ id: r.po_id, label: r.po_id, subtitle: r.status, href: `/dashboard/purchasing/purchase-order/${encodeURIComponent(r.po_id)}` }));
          if (results.length) groups.push({ type: 'Purchase Order', results });
        })
      );
      jobs.push(
        readSheetAsObjects<any>('purchase_invoice').then(({ records }) => {
          const results = records
            .filter((r) => match(r.pi_id, r.po_id))
            .slice(0, MAX_PER_GROUP)
            .map((r) => ({ id: r.pi_id, label: r.pi_id, subtitle: r.status, href: `/dashboard/purchasing/purchase-invoice/${encodeURIComponent(r.pi_id)}` }));
          if (results.length) groups.push({ type: 'Purchase Invoice', results });
        })
      );
      jobs.push(
        readSheetAsObjects<any>('supplier_list').then(({ records }) => {
          const results = records
            .filter((r) => match(r.supplier_id, r.supplier_name))
            .slice(0, MAX_PER_GROUP)
            .map((r) => ({ id: r.supplier_id, label: r.supplier_name || r.supplier_id, subtitle: r.supplier_id, href: `/dashboard/purchasing/supplier/${encodeURIComponent(r.supplier_id)}` }));
          if (results.length) groups.push({ type: 'Supplier', results });
        })
      );
    }

    if (perms.sales_order) {
      jobs.push(
        readSheetAsObjects<any>('sales_order').then(({ records }) => {
          const results = records
            .filter((r) => match(r.so_id, r.customer_id))
            .slice(0, MAX_PER_GROUP)
            .map((r) => ({ id: r.so_id, label: r.so_id, subtitle: r.status, href: `/dashboard/sales-order/sales-order/${encodeURIComponent(r.so_id)}` }));
          if (results.length) groups.push({ type: 'Sales Order', results });
        })
      );
      jobs.push(
        readSheetAsObjects<any>('sales_invoice').then(({ records }) => {
          const results = records
            .filter((r) => match(r.si_id, r.so_id))
            .slice(0, MAX_PER_GROUP)
            .map((r) => ({ id: r.si_id, label: r.si_id, subtitle: r.status, href: `/dashboard/sales-order/sales-invoice/${encodeURIComponent(r.si_id)}` }));
          if (results.length) groups.push({ type: 'Sales Invoice', results });
        })
      );
      jobs.push(
        readSheetAsObjects<any>('customer_list').then(({ records }) => {
          const results = records
            .filter((r) => match(r.customer_id, r.customer_name))
            .slice(0, MAX_PER_GROUP)
            .map((r) => ({ id: r.customer_id, label: r.customer_name || r.customer_id, subtitle: r.customer_id, href: `/dashboard/sales-order/customer/${encodeURIComponent(r.customer_id)}` }));
          if (results.length) groups.push({ type: 'Customer', results });
        })
      );
    }

    if (perms.delivery_order || perms.sales_order) {
      jobs.push(
        readSheetAsObjects<any>('delivery_note').then(({ records }) => {
          const results = records
            .filter((r) => match(r.dn_id, r.so_id))
            .slice(0, MAX_PER_GROUP)
            .map((r) => ({ id: r.dn_id, label: r.dn_id, subtitle: r.status, href: `/dashboard/delivery-order/delivery-note/${encodeURIComponent(r.dn_id)}` }));
          if (results.length) groups.push({ type: 'Delivery Note', results });
        })
      );
    }

    if (perms.inventory) {
      jobs.push(
        readSheetAsObjects<any>('item_list').then(({ records }) => {
          const results = records
            .filter((r) => match(r.item_code, r.item_name))
            .slice(0, MAX_PER_GROUP)
            .map((r) => ({ id: r.item_code, label: r.item_name || r.item_code, subtitle: r.item_code, href: `/dashboard/inventory/item/${encodeURIComponent(r.item_code)}` }));
          if (results.length) groups.push({ type: 'Item', results });
        })
      );
      jobs.push(
        readSheetAsObjects<any>('warehouse_list').then(({ records }) => {
          const results = records
            .filter((r) => match(r.warehouse_id, r.warehouse_name))
            .slice(0, MAX_PER_GROUP)
            .map((r) => ({ id: r.warehouse_id, label: r.warehouse_name || r.warehouse_id, subtitle: r.warehouse_id, href: `/dashboard/inventory/warehouse/${encodeURIComponent(r.warehouse_id)}` }));
          if (results.length) groups.push({ type: 'Warehouse', results });
        })
      );
    }

    if (perms.staff) {
      jobs.push(
        readSheetAsObjects<any>('staff_list').then(({ records }) => {
          const results = records
            .filter((r) => match(r.employee_name))
            .slice(0, MAX_PER_GROUP)
            .map((r) => ({ id: r.employee_id, label: r.employee_name, subtitle: 'Staff', href: `/dashboard/staff` }));
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
