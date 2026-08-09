import { readSheet, appendSheet, readSheetAsObjects, objectToRow } from '@/lib/sheets';
import { StockLedgerEntry, StockBalance, Item } from '@/types';

const LEDGER_SHEET = 'stock_ledger_entry';

/**
 * Get the current qty on hand for an item in a warehouse, based on the most
 * recent stock_ledger_entry row for that item+warehouse combination.
 */
export async function getCurrentStockQty(itemCode: string, warehouseId: string): Promise<number> {
  const { records } = await readSheetAsObjects<any>(LEDGER_SHEET);
  const relevant = records.filter(
    (r) => r.item_code === itemCode && r.warehouse_id === warehouseId
  );
  if (relevant.length === 0) return 0;

  relevant.sort((a, b) => Number(a.entry_id) - Number(b.entry_id));
  return parseFloat(relevant[relevant.length - 1].qty_after_transaction) || 0;
}

/**
 * Append a new stock_ledger_entry row. Computes qty_after_transaction from
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
  const { headers, records } = await readSheetAsObjects<any>(LEDGER_SHEET);
  const currentQty = await getCurrentStockQty(params.itemCode, params.warehouseId);
  const qtyAfter = currentQty + params.actualQty;
  const newId = String(records.length + 1);

  const row = objectToRow(headers, {
    entry_id: newId,
    posting_date: params.postingDate,
    item_code: params.itemCode,
    warehouse_id: params.warehouseId,
    voucher_type: params.voucherType,
    voucher_id: params.voucherId,
    actual_qty: params.actualQty,
    valuation_rate: params.valuationRate,
    qty_after_transaction: qtyAfter,
    stock_value: qtyAfter * params.valuationRate,
  });

  await appendSheet(LEDGER_SHEET, [row]);
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
