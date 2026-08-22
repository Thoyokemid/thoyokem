import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface NotificationItem {
  doctype: string;
  id: string;
  label: string;
  subtitle: string;
  href: string;
  action: string;
}

// Maps a doctype to its detail page — kept in sync with app/dashboard/audit-log/page.tsx's DOCTYPE_HREF.
const DOCTYPE_HREF: Record<string, (id: string) => string> = {
  'Purchase Order': (id) => `/dashboard/purchasing/purchase-order/${encodeURIComponent(id)}`,
  'Purchase Invoice': (id) => `/dashboard/purchasing/purchase-invoice/${encodeURIComponent(id)}`,
  Supplier: (id) => `/dashboard/purchasing/supplier/${encodeURIComponent(id)}`,
  'Sales Order': (id) => `/dashboard/sales-order/sales-order/${encodeURIComponent(id)}`,
  'Sales Invoice': (id) => `/dashboard/sales-order/sales-invoice/${encodeURIComponent(id)}`,
  Customer: (id) => `/dashboard/sales-order/customer/${encodeURIComponent(id)}`,
  'Delivery Note': (id) => `/dashboard/delivery-order/delivery-note/${encodeURIComponent(id)}`,
  Item: (id) => `/dashboard/inventory/item/${encodeURIComponent(id)}`,
  Warehouse: (id) => `/dashboard/inventory/warehouse/${encodeURIComponent(id)}`,
  'Stock Entry': (id) => `/dashboard/inventory/stock-entry/${encodeURIComponent(id)}`,
  BOM: (id) => `/dashboard/inventory/bom/${encodeURIComponent(id)}`,
  Staff: (id) => `/dashboard/hr/staff/${encodeURIComponent(id)}`,
  Leave: (id) => `/dashboard/hr/leave/${encodeURIComponent(id)}`,
  Registration: (id) => `/dashboard/registration/${encodeURIComponent(id)}`,
  Role: (id) => `/dashboard/settings/role/${encodeURIComponent(id)}`,
  User: (id) => `/dashboard/settings/user/${encodeURIComponent(id)}`,
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const perms = session.user.permissions;
  const items: NotificationItem[] = [];

  try {
    const jobs: Promise<void>[] = [];

    if (perms.can_approve) {
      jobs.push(
        prisma.purchaseOrder.findMany({ where: { status: 'Submitted', approvalStatus: 'Pending' } }).then((records) => {
          for (const po of records) {
            items.push({
              doctype: 'Purchase Order',
              id: po.poId,
              label: po.poId,
              subtitle: 'Menunggu approval PO',
              href: `/dashboard/purchasing/purchase-order/${encodeURIComponent(po.poId)}`,
              action: 'Approve',
            });
          }
        })
      );
      jobs.push(
        prisma.salesOrder.findMany({ where: { status: 'Confirmed', approvalStatus: 'Pending' } }).then((records) => {
          for (const so of records) {
            items.push({
              doctype: 'Sales Order',
              id: so.soId,
              label: so.soId,
              subtitle: 'Menunggu approval SO',
              href: `/dashboard/sales-order/sales-order/${encodeURIComponent(so.soId)}`,
              action: 'Approve',
            });
          }
        })
      );
    }

    if (perms.delivery_order || perms.sales_order) {
      jobs.push(
        prisma.deliveryNote.findMany({ where: { status: { in: ['Unallocated', 'Pick Confirmed', 'Packing Completed'] } } }).then((records) => {
          const stageAction: Record<string, string> = {
            Unallocated: 'Confirm Pick',
            'Pick Confirmed': 'Complete Packing',
            'Packing Completed': 'Good Issue',
          };
          for (const dn of records) {
            const action = stageAction[dn.status];
            if (action) {
              items.push({
                doctype: 'Delivery Note',
                id: dn.dnId,
                label: dn.dnId,
                subtitle: `Perlu ${action} — status: ${dn.status}`,
                href: `/dashboard/delivery-order/delivery-note/${encodeURIComponent(dn.dnId)}`,
                action,
              });
            }
          }
        })
      );
    }

    if (perms.registration_request) {
      jobs.push(
        prisma.registration.findMany({ where: { status: 'pending' } }).then((records) => {
          for (const r of records) {
            items.push({
              doctype: 'Registration',
              id: r.id,
              label: r.name || r.email,
              subtitle: 'Menunggu approval registrasi',
              href: `/dashboard/registration/${encodeURIComponent(r.id)}`,
              action: 'Approve',
            });
          }
        })
      );
    }

    jobs.push(
      prisma.assignment.findMany({ where: { assignedTo: session.user.id }, orderBy: { timestamp: 'desc' } }).then((records) => {
        for (const a of records) {
          const hrefFn = DOCTYPE_HREF[a.doctype];
          if (!hrefFn) continue;
          items.push({
            doctype: a.doctype,
            id: a.documentId,
            label: a.documentId,
            subtitle: `Di-assign oleh ${a.assignedBy}${a.note ? `: ${a.note}` : ''}`,
            href: hrefFn(a.documentId),
            action: 'Lihat',
          });
        }
      })
    );

    await Promise.all(jobs);

    return NextResponse.json({ count: items.length, items });
  } catch (error) {
    console.error('Error building notifications:', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}
