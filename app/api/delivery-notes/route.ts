import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheetAsObjects } from '@/lib/sheets';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user.permissions.delivery_order && !session.user.permissions.sales_order) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { records } = await readSheetAsObjects<any>('delivery_note');
    const { records: items } = await readSheetAsObjects<any>('delivery_note_item');
    const { records: customers } = await readSheetAsObjects<any>('customer_list');
    const customerMap = new Map(customers.map((c) => [c.customer_id, c.customer_name]));

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
        items: items
          .filter((i) => i.dn_id === dn.dn_id)
          .map((i) => ({ item_code: i.item_code, delivered_qty: parseFloat(i.delivered_qty) || 0, warehouse_id: i.warehouse_id })),
      }))
      .reverse();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching delivery notes:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery notes' }, { status: 500 });
  }
}
