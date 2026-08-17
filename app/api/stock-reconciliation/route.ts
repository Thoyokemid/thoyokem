import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { appendStockLedgerEntry } from '@/lib/stock';
import { logActivity } from '@/lib/activityLog';
import { validate, stockReconciliationCreateSchema } from '@/lib/validation';

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
  const ledger = await prisma.stockLedgerEntry.findMany();
  const index = new Map<string, number>();
  for (const e of ledger) {
    const key = `${e.voucherType}::${e.voucherId}::${e.itemCode}::${e.warehouseId}`;
    index.set(key, (index.get(key) || 0) + Number(e.actualQty));
  }
  return index;
}

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  try {
    const [ledgerIndex, itemMasterData, dnData, dnItemData, prItemData, seData] = await Promise.all([
      buildLedgerIndex(),
      prisma.item.findMany(),
      prisma.deliveryNote.findMany(),
      prisma.deliveryNoteItem.findMany(),
      prisma.purchaseReceiptItem.findMany(),
      prisma.stockEntry.findMany(),
    ]);

    const itemMasterMap = new Map(itemMasterData.map((i) => [i.itemCode, i]));
    const itemName = (code: string, snapshot?: string) => snapshot || itemMasterMap.get(code)?.itemName || code;

    const discrepancies: Discrepancy[] = [];

    // ── Delivery Note: expect -delivered_qty per line, but ONLY once a DN has
    // gone through Good Issue — earlier-stage DNs haven't touched stock yet. ──
    const dnStatusMap = new Map(dnData.map((d) => [d.dnId, d.status]));
    for (const line of dnItemData) {
      if (dnStatusMap.get(line.dnId) !== 'Good Issued') continue;
      const expected = -Number(line.deliveredQty);
      if (expected === 0) continue;
      const key = `Delivery Note::${line.dnId}::${line.itemCode}::${line.warehouseId}`;
      const actual = ledgerIndex.get(key) || 0;
      if (actual !== expected) {
        discrepancies.push({
          source: 'Delivery Note',
          doc_id: line.dnId,
          item_code: line.itemCode,
          item_name: itemName(line.itemCode, line.itemName),
          warehouse_id: line.warehouseId,
          expected_qty: expected,
          actual_qty: actual,
          missing_qty: expected - actual,
        });
      }
    }

    // ── Purchase Receipt: expect +received_qty per line ──
    for (const line of prItemData) {
      const expected = Number(line.receivedQty);
      if (expected === 0) continue;
      const key = `Purchase Receipt::${line.prId}::${line.itemCode}::${line.warehouseId}`;
      const actual = ledgerIndex.get(key) || 0;
      if (actual !== expected) {
        discrepancies.push({
          source: 'Purchase Receipt',
          doc_id: line.prId,
          item_code: line.itemCode,
          item_name: itemName(line.itemCode),
          warehouse_id: line.warehouseId,
          expected_qty: expected,
          actual_qty: actual,
          missing_qty: expected - actual,
        });
      }
    }

    // ── Stock Entry: Receipt / Issue / Transfer have fully predictable legs.
    // Manufacture is skipped — its expected legs depend on the BOM at the time
    // of entry, which may have changed since, so we can't safely recompute it.
    for (const entry of seData) {
      const qty = Number(entry.qty);
      if (qty === 0) continue;
      const legs: { warehouse: string | null; expected: number }[] = [];
      if (entry.entryType === 'Material Receipt') {
        legs.push({ warehouse: entry.targetWarehouse, expected: qty });
      } else if (entry.entryType === 'Material Issue') {
        legs.push({ warehouse: entry.sourceWarehouse, expected: -qty });
      } else if (entry.entryType === 'Material Transfer') {
        legs.push({ warehouse: entry.sourceWarehouse, expected: -qty });
        legs.push({ warehouse: entry.targetWarehouse, expected: qty });
      } else {
        continue;
      }

      for (const leg of legs) {
        if (!leg.warehouse) continue;
        const key = `Stock Entry::${entry.entryId}::${entry.itemCode}::${leg.warehouse}`;
        const actual = ledgerIndex.get(key) || 0;
        if (actual !== leg.expected) {
          discrepancies.push({
            source: 'Stock Entry',
            doc_id: entry.entryId,
            item_code: entry.itemCode,
            item_name: itemName(entry.itemCode),
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
    const parsed = validate(stockReconciliationCreateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { source, doc_id, item_code, warehouse_id, missing_qty } = parsed.data;

    const master = await prisma.item.findUnique({ where: { itemCode: item_code } });
    const valuationRate = master ? Number(master.purchasePrice) : 0;
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
