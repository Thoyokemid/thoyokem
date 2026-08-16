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

    await Promise.all(jobs);

    return NextResponse.json({ count: items.length, items });
  } catch (error) {
    console.error('Error building notifications:', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}
