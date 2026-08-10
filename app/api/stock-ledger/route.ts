import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheetAsObjects } from '@/lib/sheets';
import { StockLedgerEntry } from '@/types';

const SHEET = 'stock_ledger_entry';

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

    const { records } = await readSheetAsObjects<any>(SHEET);
    let entries: StockLedgerEntry[] = records.map((r) => ({
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

    if (itemCode) entries = entries.filter((e) => e.item_code === itemCode);
    if (warehouseId) entries = entries.filter((e) => e.warehouse_id === warehouseId);

    entries.sort((a, b) => Number(a.entry_id) - Number(b.entry_id));

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching stock ledger:', error);
    return NextResponse.json({ error: 'Failed to fetch stock ledger' }, { status: 500 });
  }
}
