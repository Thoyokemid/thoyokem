import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheetAsObjects } from '@/lib/sheets';

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
        readSheetAsObjects<any>('purchase_order').then(({ records }) => {
          for (const po of records) {
            if (po.status === 'Submitted' && (po.approval_status || 'Pending') === 'Pending') {
              items.push({
                doctype: 'Purchase Order',
                id: po.po_id,
                label: po.po_id,
                subtitle: 'Menunggu approval PO',
                href: `/dashboard/purchasing/purchase-order/${encodeURIComponent(po.po_id)}`,
                action: 'Approve',
              });
            }
          }
        })
      );
      jobs.push(
        readSheetAsObjects<any>('sales_order').then(({ records }) => {
          for (const so of records) {
            if (so.status === 'Confirmed' && (so.approval_status || 'Pending') === 'Pending') {
              items.push({
                doctype: 'Sales Order',
                id: so.so_id,
                label: so.so_id,
                subtitle: 'Menunggu approval SO',
                href: `/dashboard/sales-order/sales-order/${encodeURIComponent(so.so_id)}`,
                action: 'Approve',
              });
            }
          }
        })
      );
    }

    if (perms.delivery_order || perms.sales_order) {
      jobs.push(
        readSheetAsObjects<any>('delivery_note').then(({ records }) => {
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
                id: dn.dn_id,
                label: dn.dn_id,
                subtitle: `Perlu ${action} — status: ${dn.status}`,
                href: `/dashboard/delivery-order/delivery-note/${encodeURIComponent(dn.dn_id)}`,
                action,
              });
            }
          }
        })
      );
    }

    if (perms.registration_request) {
      jobs.push(
        readSheetAsObjects<any>('registration').then(({ records }) => {
          for (const r of records) {
            if ((r.status || 'pending') === 'pending') {
              items.push({
                doctype: 'Registration',
                id: r.id,
                label: r.name || r.email,
                subtitle: 'Menunggu approval registrasi',
                href: `/dashboard/registration/${encodeURIComponent(r.id)}`,
                action: 'Approve',
              });
            }
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
