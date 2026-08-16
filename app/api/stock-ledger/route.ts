import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { StockLedgerEntry } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.user.permissions.inventory) {
      return NextResponse.json({ error: 'Forbidden: no inventory access' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const itemCode = searchParams.get('item_code');
    const warehouseId = searchParams.get('warehouse_id');

    const records = await prisma.stockLedgerEntry.findMany({
      where: {
        ...(itemCode ? { itemCode } : {}),
        ...(warehouseId ? { warehouseId } : {}),
      },
      orderBy: { entryId: 'asc' },
    });

    const entries: StockLedgerEntry[] = records.map((r) => ({
      entry_id: String(r.entryId),
      posting_date: r.postingDate,
      item_code: r.itemCode,
      warehouse_id: r.warehouseId,
      voucher_type: r.voucherType,
      voucher_id: r.voucherId,
      actual_qty: Number(r.actualQty),
      valuation_rate: Number(r.valuationRate),
      qty_after_transaction: Number(r.qtyAfterTransaction),
      stock_value: Number(r.stockValue),
    }));

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching stock ledger:', error);
    return NextResponse.json({ error: 'Failed to fetch stock ledger' }, { status: 500 });
  }
}
