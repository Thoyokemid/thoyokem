import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheetAsObjects, appendSheet, objectToRow } from '@/lib/sheets';
import { appendStockLedgerEntry, getCurrentStockQty } from '@/lib/stock';
import { StockEntry } from '@/types';

const SHEET = 'stock_entry';

async function requireInventoryAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.inventory) {
    return { error: NextResponse.json({ error: 'Forbidden: no inventory access' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const { records } = await readSheetAsObjects<any>(SHEET);
    const entries: StockEntry[] = records.map((r) => ({
      entry_id: r.entry_id || '',
      entry_type: r.entry_type || '',
      item_code: r.item_code || '',
      source_warehouse: r.source_warehouse || '',
      target_warehouse: r.target_warehouse || '',
      qty: parseFloat(r.qty) || 0,
      date: r.date || '',
      remarks: r.remarks || '',
      status: r.status || '',
      owner: r.owner || '',
      creation: r.creation || '',
    }));
    return NextResponse.json(entries.reverse());
  } catch (error) {
    console.error('Error fetching stock entries:', error);
    return NextResponse.json({ error: 'Failed to fetch stock entries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { entry_type, item_code, source_warehouse, target_warehouse, qty, remarks } = data;

    if (!item_code || !qty || qty <= 0) {
      return NextResponse.json({ error: 'item_code dan qty (>0) wajib diisi' }, { status: 400 });
    }
    if (entry_type === 'Material Receipt' && !target_warehouse) {
      return NextResponse.json({ error: 'target_warehouse wajib diisi untuk Material Receipt' }, { status: 400 });
    }
    if (entry_type === 'Material Issue' && !source_warehouse) {
      return NextResponse.json({ error: 'source_warehouse wajib diisi untuk Material Issue' }, { status: 400 });
    }
    if (entry_type === 'Material Transfer' && (!source_warehouse || !target_warehouse)) {
      return NextResponse.json({ error: 'source_warehouse dan target_warehouse wajib diisi untuk Material Transfer' }, { status: 400 });
    }
    if (entry_type === 'Manufacture' && (!source_warehouse || !target_warehouse)) {
      return NextResponse.json({ error: 'source_warehouse dan target_warehouse wajib diisi untuk Manufacture' }, { status: 400 });
    }

    // Look up item's valuation rate for stock value calculation.
    const { records: items } = await readSheetAsObjects<any>('item_list');
    const item = items.find((i) => i.item_code === item_code);
    let valuationRate = item ? parseFloat(item.purchase_price) || 0 : 0;

    // Manufacture: consume BOM components first (need their cost to value the finished item).
    let bomComponents: { component_item_code: string; qty: number; valuationRate: number }[] = [];
    if (entry_type === 'Manufacture') {
      const { records: boms } = await readSheetAsObjects<any>('bom');
      const bom = boms.find((b) => b.item_code === item_code && (b.is_active === '' || b.is_active === 'TRUE' || b.is_active === true));
      if (!bom) {
        return NextResponse.json({ error: `Belum ada BOM aktif untuk item ${item_code}` }, { status: 400 });
      }
      const bomQty = parseFloat(bom.qty) || 1;
      const { records: bomItems } = await readSheetAsObjects<any>('bom_item');
      const lines = bomItems.filter((c) => c.bom_id === bom.bom_id);

      for (const line of lines) {
        const requiredQty = (parseFloat(line.qty) || 0) * (qty / bomQty);
        const available = await getCurrentStockQty(line.component_item_code, source_warehouse);
        if (available < requiredQty) {
          return NextResponse.json(
            { error: `Stok komponen ${line.component_item_code} tidak cukup di ${source_warehouse} (tersedia ${available}, butuh ${requiredQty})` },
            { status: 400 }
          );
        }
        const compItem = items.find((i) => i.item_code === line.component_item_code);
        bomComponents.push({
          component_item_code: line.component_item_code,
          qty: requiredQty,
          valuationRate: compItem ? parseFloat(compItem.purchase_price) || 0 : 0,
        });
      }

      const totalComponentCost = bomComponents.reduce((sum, c) => sum + c.qty * c.valuationRate, 0);
      valuationRate = qty > 0 ? totalComponentCost / qty : 0;
    }

    const { headers, records } = await readSheetAsObjects<any>(SHEET);
    const newId = String(records.length + 1);
    const now = new Date().toISOString();
    const postingDate = data.date || now.slice(0, 10);

    const newRow = objectToRow(headers, {
      entry_id: newId,
      entry_type,
      item_code,
      source_warehouse: source_warehouse || '',
      target_warehouse: target_warehouse || '',
      qty,
      date: postingDate,
      remarks: remarks || '',
      status: 'Submitted',
      owner: guard.session?.user.name || '',
      creation: now,
    });
    await appendSheet(SHEET, [newRow]);

    // Write to the stock ledger — the source of truth for stock balance.
    if (entry_type === 'Material Receipt') {
      await appendStockLedgerEntry({
        itemCode: item_code,
        warehouseId: target_warehouse,
        voucherType: 'Stock Entry',
        voucherId: newId,
        actualQty: qty,
        valuationRate,
        postingDate,
      });
    } else if (entry_type === 'Material Issue') {
      await appendStockLedgerEntry({
        itemCode: item_code,
        warehouseId: source_warehouse,
        voucherType: 'Stock Entry',
        voucherId: newId,
        actualQty: -qty,
        valuationRate,
        postingDate,
      });
    } else if (entry_type === 'Material Transfer') {
      await appendStockLedgerEntry({
        itemCode: item_code,
        warehouseId: source_warehouse,
        voucherType: 'Stock Entry',
        voucherId: newId,
        actualQty: -qty,
        valuationRate,
        postingDate,
      });
      await appendStockLedgerEntry({
        itemCode: item_code,
        warehouseId: target_warehouse,
        voucherType: 'Stock Entry',
        voucherId: newId,
        actualQty: qty,
        valuationRate,
        postingDate,
      });
    } else if (entry_type === 'Manufacture') {
      for (const comp of bomComponents) {
        await appendStockLedgerEntry({
          itemCode: comp.component_item_code,
          warehouseId: source_warehouse,
          voucherType: 'Stock Entry',
          voucherId: newId,
          actualQty: -comp.qty,
          valuationRate: comp.valuationRate,
          postingDate,
        });
      }
      await appendStockLedgerEntry({
        itemCode: item_code,
        warehouseId: target_warehouse,
        voucherType: 'Stock Entry',
        voucherId: newId,
        actualQty: qty,
        valuationRate,
        postingDate,
      });
    }

    return NextResponse.json({ success: true, entry_id: newId });
  } catch (error) {
    console.error('Error creating stock entry:', error);
    return NextResponse.json({ error: 'Failed to create stock entry' }, { status: 500 });
  }
}
