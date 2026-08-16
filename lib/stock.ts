import { prisma } from '@/lib/db';
import { StockLedgerEntry, StockBalance, Item } from '@/types';

/**
 * Get the current qty on hand for an item in a warehouse, based on the most
 * recent stock_ledger_entry row for that item+warehouse combination.
 */
export async function getCurrentStockQty(itemCode: string, warehouseId: string): Promise<number> {
  const latest = await prisma.stockLedgerEntry.findFirst({
    where: { itemCode, warehouseId },
    orderBy: { entryId: 'desc' },
  });
  return latest ? Number(latest.qtyAfterTransaction) : 0;
}

/**
 * Insert a new stock_ledger_entry row. Computes qty_after_transaction from
 * the current balance + actual_qty (positive = in, negative = out).
 * This is the ONLY way stock_ledger_entry should be written — never edit
 * existing rows, it's an append-only audit trail.
 */
export async function appendStockLedgerEntry(params: {
  itemCode: string;
  warehouseId: string;
  voucherType: string;
  voucherId: string;
  actualQty: number;
  valuationRate: number;
  postingDate: string;
}): Promise<void> {
  const currentQty = await getCurrentStockQty(params.itemCode, params.warehouseId);
  const qtyAfter = currentQty + params.actualQty;

  await prisma.stockLedgerEntry.create({
    data: {
      postingDate: params.postingDate,
      itemCode: params.itemCode,
      warehouseId: params.warehouseId,
      voucherType: params.voucherType,
      voucherId: params.voucherId,
      actualQty: params.actualQty,
      valuationRate: params.valuationRate,
      qtyAfterTransaction: qtyAfter,
      stockValue: qtyAfter * params.valuationRate,
    },
  });
}

/**
 * Summarize the ledger into current balances: one row per item+warehouse,
 * using the latest ledger entry (by entry_id) for that combination.
 * Mirrors the AttendanceRecap pattern — never stored, always computed.
 */
export function calculateStockBalance(
  entries: StockLedgerEntry[],
  items: Item[]
): StockBalance[] {
  const itemMap = new Map(items.map((i) => [i.item_code, i.item_name]));
  const latestByKey = new Map<string, StockLedgerEntry>();

  const sorted = [...entries].sort((a, b) => Number(a.entry_id) - Number(b.entry_id));
  for (const entry of sorted) {
    const key = `${entry.item_code}::${entry.warehouse_id}`;
    latestByKey.set(key, entry);
  }

  return Array.from(latestByKey.values())
    .filter((e) => e.qty_after_transaction !== 0)
    .map((e) => ({
      item_code: e.item_code,
      item_name: itemMap.get(e.item_code) || e.item_code,
      warehouse_id: e.warehouse_id,
      qty_on_hand: e.qty_after_transaction,
      valuation_rate: e.valuation_rate,
      stock_value: e.stock_value,
      last_transaction_date: e.posting_date,
    }))
    .sort((a, b) => a.item_name.localeCompare(b.item_name));
}
