import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { appendStockLedgerEntry, getCurrentStockQty } from '@/lib/stock';
import { logActivity } from '@/lib/activityLog';
import { generateId } from '@/lib/id';
import { StockEntry } from '@/types';
import { validate, stockEntryCreateSchema, stockEntryActionSchema } from '@/lib/validation';
import { hasDoctypePermission, requiresOwnerMatch, PermissionAction } from '@/lib/permissions';

async function requireInventoryAccess(action: PermissionAction) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!(await hasDoctypePermission(session, 'Stock Entry', action))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireInventoryAccess('read');
  if (guard.error) return guard.error;

  try {
    const records = await prisma.stockEntry.findMany({ orderBy: { creation: 'desc' } });
    const entries: StockEntry[] = records.map((r) => ({
      entry_id: r.entryId,
      entry_type: r.entryType as StockEntry['entry_type'],
      item_code: r.itemCode,
      source_warehouse: r.sourceWarehouse || '',
      target_warehouse: r.targetWarehouse || '',
      qty: Number(r.qty),
      date: r.date,
      remarks: r.remarks || '',
      status: r.status,
      owner: r.owner,
      creation: r.creation,
    }));
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching stock entries:', error);
    return NextResponse.json({ error: 'Failed to fetch stock entries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireInventoryAccess('create');
  if (guard.error) return guard.error;

  try {
    const parsed = validate(stockEntryCreateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { entry_type, item_code, source_warehouse, target_warehouse, qty, remarks, date } = parsed.data;

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
    const items = await prisma.item.findMany();
    const item = items.find((i) => i.itemCode === item_code);
    let valuationRate = item ? Number(item.purchasePrice) : 0;

    // Manufacture: consume BOM components first (need their cost to value the finished item).
    let bomComponents: { component_item_code: string; qty: number; valuationRate: number }[] = [];
    if (entry_type === 'Manufacture') {
      const bom = await prisma.bom.findFirst({ where: { itemCode: item_code, isActive: true }, include: { components: true } });
      if (!bom) {
        return NextResponse.json({ error: `Belum ada BOM aktif untuk item ${item_code}` }, { status: 400 });
      }
      const bomQty = Number(bom.qty) || 1;

      for (const line of bom.components) {
        const requiredQty = Number(line.qty) * (qty / bomQty);
        const available = await getCurrentStockQty(line.componentItemCode, source_warehouse!);
        if (available < requiredQty) {
          return NextResponse.json(
            { error: `Stok komponen ${line.componentItemCode} tidak cukup di ${source_warehouse} (tersedia ${available}, butuh ${requiredQty})` },
            { status: 400 }
          );
        }
        const compItem = items.find((i) => i.itemCode === line.componentItemCode);
        bomComponents.push({
          component_item_code: line.componentItemCode,
          qty: requiredQty,
          valuationRate: compItem ? Number(compItem.purchasePrice) : 0,
        });
      }

      const totalComponentCost = bomComponents.reduce((sum, c) => sum + c.qty * c.valuationRate, 0);
      valuationRate = qty > 0 ? totalComponentCost / qty : 0;
    }

    const newId = generateId();
    const now = new Date().toISOString();
    const postingDate = date || now.slice(0, 10);

    const created = await prisma.stockEntry.create({
      data: {
        entryId: newId,
        entryType: entry_type,
        itemCode: item_code,
        sourceWarehouse: source_warehouse || null,
        targetWarehouse: target_warehouse || null,
        qty,
        date: postingDate,
        remarks: remarks || null,
        status: 'Submitted',
        owner: guard.session?.user.name || '',
        creation: now,
      },
    });

    // Write to the stock ledger — the source of truth for stock balance.
    if (entry_type === 'Material Receipt') {
      await appendStockLedgerEntry({
        itemCode: item_code,
        warehouseId: target_warehouse!,
        voucherType: 'Stock Entry',
        voucherId: newId,
        actualQty: qty,
        valuationRate,
        postingDate,
      });
    } else if (entry_type === 'Material Issue') {
      await appendStockLedgerEntry({
        itemCode: item_code,
        warehouseId: source_warehouse!,
        voucherType: 'Stock Entry',
        voucherId: newId,
        actualQty: -qty,
        valuationRate,
        postingDate,
      });
    } else if (entry_type === 'Material Transfer') {
      await appendStockLedgerEntry({
        itemCode: item_code,
        warehouseId: source_warehouse!,
        voucherType: 'Stock Entry',
        voucherId: newId,
        actualQty: -qty,
        valuationRate,
        postingDate,
      });
      await appendStockLedgerEntry({
        itemCode: item_code,
        warehouseId: target_warehouse!,
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
          warehouseId: source_warehouse!,
          voucherType: 'Stock Entry',
          voucherId: newId,
          actualQty: -comp.qty,
          valuationRate: comp.valuationRate,
          postingDate,
        });
      }
      await appendStockLedgerEntry({
        itemCode: item_code,
        warehouseId: target_warehouse!,
        voucherType: 'Stock Entry',
        voucherId: newId,
        actualQty: qty,
        valuationRate,
        postingDate,
      });
    }

    await logActivity({ doctype: 'Stock Entry', documentId: newId, action: 'Created', changedBy: guard.session?.user.name || '', before: null, after: created });

    return NextResponse.json({ success: true, entry_id: newId });
  } catch (error) {
    console.error('Error creating stock entry:', error);
    return NextResponse.json({ error: 'Failed to create stock entry' }, { status: 500 });
  }
}

// PATCH performs a status-transition action: cancel
export async function PATCH(request: NextRequest) {
  const guard = await requireInventoryAccess('cancel');
  if (guard.error) return guard.error;

  try {
    const parsed = validate(stockEntryActionSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { entry_id, action } = parsed.data;

    const current = await prisma.stockEntry.findUnique({ where: { entryId: entry_id } });
    if (!current) return NextResponse.json({ error: 'Stock entry not found' }, { status: 404 });

    if (await requiresOwnerMatch(guard.session!, 'Stock Entry') && current.owner !== guard.session!.user.name) {
      return NextResponse.json({ error: 'Anda hanya bisa membatalkan Stock Entry yang Anda buat sendiri' }, { status: 403 });
    }

    if (action === 'cancel') {
      if (current.status === 'Cancelled') {
        return NextResponse.json({ error: 'Stock entry sudah dibatalkan' }, { status: 400 });
      }

      const now = new Date().toISOString();
      // Reverse every ledger line this entry originally posted — covers Material
      // Receipt/Issue/Transfer (1-2 lines) and Manufacture (N component lines + 1
      // finished-good line) alike, without re-deriving quantities/rates.
      const postedLines = await prisma.stockLedgerEntry.findMany({
        where: { voucherType: 'Stock Entry', voucherId: entry_id },
      });
      for (const line of postedLines) {
        await appendStockLedgerEntry({
          itemCode: line.itemCode,
          warehouseId: line.warehouseId,
          voucherType: 'Stock Entry Cancellation',
          voucherId: entry_id,
          actualQty: -Number(line.actualQty),
          valuationRate: Number(line.valuationRate),
          postingDate: now.slice(0, 10),
        });
      }

      const updated = await prisma.stockEntry.update({ where: { entryId: entry_id }, data: { status: 'Cancelled' } });

      await logActivity({
        doctype: 'Stock Entry',
        documentId: entry_id,
        action: 'Cancelled',
        changedBy: guard.session?.user.name || '',
        before: current,
        after: updated,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating stock entry:', error);
    return NextResponse.json({ error: 'Failed to update stock entry' }, { status: 500 });
  }
}
