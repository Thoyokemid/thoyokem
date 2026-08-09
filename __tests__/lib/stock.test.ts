import { calculateStockBalance } from '@/lib/stock';
import { StockLedgerEntry, Item } from '@/types';

function makeEntry(overrides: Partial<StockLedgerEntry>): StockLedgerEntry {
  return {
    entry_id: '1',
    posting_date: '2026-01-01',
    item_code: 'ITM-001',
    warehouse_id: 'WH-001',
    voucher_type: 'Stock Entry',
    voucher_id: '1',
    actual_qty: 10,
    valuation_rate: 1000,
    qty_after_transaction: 10,
    stock_value: 10000,
    ...overrides,
  };
}

const items: Item[] = [
  {
    item_code: 'ITM-001',
    item_name: 'Widget A',
    item_group: 'General',
    unit: 'pcs',
    purchase_price: 1000,
    selling_price: 1500,
    reorder_level: 5,
    valuation_method: 'Average',
    opening_qty: 0,
    opening_valuation_rate: 0,
    is_active: true,
  },
];

describe('calculateStockBalance', () => {
  it('uses the latest ledger entry per item+warehouse as the balance', () => {
    const entries = [
      makeEntry({ entry_id: '1', qty_after_transaction: 10, stock_value: 10000 }),
      makeEntry({ entry_id: '2', qty_after_transaction: 25, stock_value: 25000 }),
    ];

    const balance = calculateStockBalance(entries, items);

    expect(balance).toHaveLength(1);
    expect(balance[0].qty_on_hand).toBe(25);
    expect(balance[0].stock_value).toBe(25000);
  });

  it('keeps item+warehouse combinations separate', () => {
    const entries = [
      makeEntry({ entry_id: '1', warehouse_id: 'WH-001', qty_after_transaction: 10 }),
      makeEntry({ entry_id: '2', warehouse_id: 'WH-002', qty_after_transaction: 5 }),
    ];

    const balance = calculateStockBalance(entries, items);

    expect(balance).toHaveLength(2);
    expect(balance.find((b) => b.warehouse_id === 'WH-001')?.qty_on_hand).toBe(10);
    expect(balance.find((b) => b.warehouse_id === 'WH-002')?.qty_on_hand).toBe(5);
  });

  it('excludes combinations whose latest balance is zero', () => {
    const entries = [
      makeEntry({ entry_id: '1', actual_qty: 10, qty_after_transaction: 10 }),
      makeEntry({ entry_id: '2', actual_qty: -10, qty_after_transaction: 0 }),
    ];

    const balance = calculateStockBalance(entries, items);

    expect(balance).toHaveLength(0);
  });

  it('resolves item_name from the items list, falling back to item_code', () => {
    const entries = [makeEntry({ item_code: 'UNKNOWN-CODE' })];
    const balance = calculateStockBalance(entries, items);

    expect(balance[0].item_name).toBe('UNKNOWN-CODE');
  });
});
