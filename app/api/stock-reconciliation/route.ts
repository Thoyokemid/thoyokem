import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheetAsObjects } from '@/lib/sheets';
import { appendStockLedgerEntry } from '@/lib/stock';
import { logActivity } from '@/lib/activityLog';

interface Discrepancy {
  source: 'Delivery Note' | 'Purchase Receipt' | 'Stock Entry';
  doc_id: string;
  item_code: string;
  item_name: string;
  warehouse_id: string;
  expected_qty: number;
  actual_qty: number;
  missing_qty: number;
}

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.isSuperAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden: super admin only' }, { status: 403 }) };
  }
  return { session };
}

async function buildLedgerIndex() {
  const { records: ledger } = await readSheetAsObjects<any>('stock_ledger_entry');
  const index = new Map<string, number>();
  for (const e of ledger) {
    const key = `${e.voucher_type}::${e.voucher_id}::${e.item_code}::${e.warehouse_id}`;
    index.set(key, (index.get(key) || 0) + (parseFloat(e.actual_qty) || 0));
  }
  return index;
}

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  try {
    const [ledgerIndex, itemMasterData, dnData, dnItemData, prData, prItemData, seData] = await Promise.all([
      buildLedgerIndex(),
      readSheetAsObjects<any>('item_list'),
      readSheetAsObjects<any>('delivery_note'),
      readSheetAsObjects<any>('delivery_note_item'),
      readSheetAsObjects<any>('purchase_receipt'),
      readSheetAsObjects<any>('purchase_receipt_item'),
      readSheetAsObjects<any>('stock_entry'),
    ]);

    const itemMasterMap = new Map(itemMasterData.records.map((i) => [i.item_code, i]));
    const itemName = (code: string, snapshot?: string) => snapshot || itemMasterMap.get(code)?.item_name || code;

    const discrepancies: Discrepancy[] = [];

    // ── Delivery Note: expect -delivered_qty per line for every non-cancelled DN ──
    const dnStatusMap = new Map(dnData.records.map((d) => [d.dn_id, d.status]));
    for (const line of dnItemData.records) {
      if (dnStatusMap.get(line.dn_id) === 'Cancelled') continue;
      const expected = -(parseFloat(line.delivered_qty) || 0);
      if (expected === 0) continue;
      const key = `Delivery Note::${line.dn_id}::${line.item_code}::${line.warehouse_id}`;
      const actual = ledgerIndex.get(key) || 0;
      if (actual !== expected) {
        discrepancies.push({
          source: 'Delivery Note',
          doc_id: line.dn_id,
          item_code: line.item_code,
          item_name: itemName(line.item_code, line.item_name),
          warehouse_id: line.warehouse_id,
          expected_qty: expected,
          actual_qty: actual,
          missing_qty: expected - actual,
        });
      }
    }

    // ── Purchase Receipt: expect +received_qty per line ──
    for (const line of prItemData.records) {
      const expected = parseFloat(line.received_qty) || 0;
      if (expected === 0) continue;
      const key = `Purchase Receipt::${line.pr_id}::${line.item_code}::${line.warehouse_id}`;
      const actual = ledgerIndex.get(key) || 0;
      if (actual !== expected) {
        discrepancies.push({
          source: 'Purchase Receipt',
          doc_id: line.pr_id,
          item_code: line.item_code,
          item_name: itemName(line.item_code),
          warehouse_id: line.warehouse_id,
          expected_qty: expected,
          actual_qty: actual,
          missing_qty: expected - actual,
        });
      }
    }

    // ── Stock Entry: Receipt / Issue / Transfer have fully predictable legs.
    // Manufacture is skipped — its expected legs depend on the BOM at the time
    // of entry, which may have changed since, so we can't safely recompute it.
    for (const entry of seData.records) {
      const qty = parseFloat(entry.qty) || 0;
      if (qty === 0) continue;
      const legs: { warehouse: string; expected: number }[] = [];
      if (entry.entry_type === 'Material Receipt') {
        legs.push({ warehouse: entry.target_warehouse, expected: qty });
      } else if (entry.entry_type === 'Material Issue') {
        legs.push({ warehouse: entry.source_warehouse, expected: -qty });
      } else if (entry.entry_type === 'Material Transfer') {
        legs.push({ warehouse: entry.source_warehouse, expected: -qty });
        legs.push({ warehouse: entry.target_warehouse, expected: qty });
      } else {
        continue;
      }

      for (const leg of legs) {
        if (!leg.warehouse) continue;
        const key = `Stock Entry::${entry.entry_id}::${entry.item_code}::${leg.warehouse}`;
        const actual = ledgerIndex.get(key) || 0;
        if (actual !== leg.expected) {
          discrepancies.push({
            source: 'Stock Entry',
            doc_id: entry.entry_id,
            item_code: entry.item_code,
            item_name: itemName(entry.item_code),
            warehouse_id: leg.warehouse,
            expected_qty: leg.expected,
            actual_qty: actual,
            missing_qty: leg.expected - actual,
          });
        }
      }
    }

    return NextResponse.json(discrepancies);
  } catch (error) {
    console.error('Error scanning stock reconciliation:', error);
    return NextResponse.json({ error: 'Failed to scan for discrepancies' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { source, doc_id, item_code, warehouse_id, missing_qty } = data as Discrepancy;

    if (!source || !doc_id || !item_code || !warehouse_id || !missing_qty) {
      return NextResponse.json({ error: 'Data koreksi tidak lengkap' }, { status: 400 });
    }

    const { records: itemMaster } = await readSheetAsObjects<any>('item_list');
    const master = itemMaster.find((i) => i.item_code === item_code);
    const valuationRate = parseFloat(master?.purchase_price) || 0;
    const postingDate = new Date().toISOString().slice(0, 10);

    await appendStockLedgerEntry({
      itemCode: item_code,
      warehouseId: warehouse_id,
      voucherType: `${source} (Correction)`,
      voucherId: doc_id,
      actualQty: missing_qty,
      valuationRate,
      postingDate,
    });

    await logActivity({
      doctype: 'Stock Reconciliation',
      documentId: doc_id,
      action: 'Updated',
      changedBy: guard.session?.user.name || '',
      before: null,
      after: { source, item_code, warehouse_id, corrected_qty: missing_qty },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error applying stock reconciliation fix:', error);
    return NextResponse.json({ error: 'Failed to apply correction' }, { status: 500 });
  }
}
