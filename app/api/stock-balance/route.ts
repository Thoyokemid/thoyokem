import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculateStockBalance } from '@/lib/stock';
import { StockLedgerEntry, Item } from '@/types';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.user.permissions.inventory) {
      return NextResponse.json({ error: 'Forbidden: no inventory access' }, { status: 403 });
    }

    const ledgerRecords = await prisma.stockLedgerEntry.findMany();
    const itemRecords = await prisma.item.findMany();

    const entries: StockLedgerEntry[] = ledgerRecords.map((r) => ({
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

    const items: Item[] = itemRecords.map((r) => ({
      item_code: r.itemCode,
      item_name: r.itemName,
      item_group: r.itemGroup,
      unit: r.unit,
      purchase_price: Number(r.purchasePrice),
      selling_price: Number(r.sellingPrice),
      reorder_level: Number(r.reorderLevel),
      valuation_method: r.valuationMethod as 'FIFO' | 'Average',
      opening_qty: Number(r.openingQty),
      opening_valuation_rate: Number(r.openingValuationRate),
      is_active: r.isActive,
      currency: r.currency as 'IDR' | 'USD',
      item_type: r.itemType as 'Trading' | 'Regular',
    }));

    const balance = calculateStockBalance(entries, items);
    return NextResponse.json(balance);
  } catch (error) {
    console.error('Error calculating stock balance:', error);
    return NextResponse.json({ error: 'Failed to calculate stock balance' }, { status: 500 });
  }
}
