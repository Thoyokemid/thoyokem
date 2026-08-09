import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheetAsObjects } from '@/lib/sheets';
import { calculateStockBalance } from '@/lib/stock';
import { StockLedgerEntry, Item } from '@/types';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.user.permissions.inventory) {
      return NextResponse.json({ error: 'Forbidden: no inventory access' }, { status: 403 });
    }

    const { records: ledgerRecords } = await readSheetAsObjects<any>('stock_ledger_entry');
    const { records: itemRecords } = await readSheetAsObjects<any>('item_list');

    const entries: StockLedgerEntry[] = ledgerRecords.map((r) => ({
      entry_id: r.entry_id || '',
      posting_date: r.posting_date || '',
      item_code: r.item_code || '',
      warehouse_id: r.warehouse_id || '',
      voucher_type: r.voucher_type || '',
      voucher_id: r.voucher_id || '',
      actual_qty: parseFloat(r.actual_qty) || 0,
      valuation_rate: parseFloat(r.valuation_rate) || 0,
      qty_after_transaction: parseFloat(r.qty_after_transaction) || 0,
      stock_value: parseFloat(r.stock_value) || 0,
    }));

    const items: Item[] = itemRecords.map((r) => ({
      item_code: r.item_code || '',
      item_name: r.item_name || '',
      item_group: r.item_group || '',
      unit: r.unit || '',
      purchase_price: parseFloat(r.purchase_price) || 0,
      selling_price: parseFloat(r.selling_price) || 0,
      reorder_level: parseFloat(r.reorder_level) || 0,
      valuation_method: (r.valuation_method || 'Average') as 'FIFO' | 'Average',
      opening_qty: parseFloat(r.opening_qty) || 0,
      opening_valuation_rate: parseFloat(r.opening_valuation_rate) || 0,
      is_active: true,
    }));

    const balance = calculateStockBalance(entries, items);
    return NextResponse.json(balance);
  } catch (error) {
    console.error('Error calculating stock balance:', error);
    return NextResponse.json({ error: 'Failed to calculate stock balance' }, { status: 500 });
  }
}
