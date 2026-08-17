import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { validate, bulkRowsSchema } from '@/lib/validation';

function generateItemCode(group: string): string {
  const prefix = `TY${group === 'Liquid' ? 'L' : 'NL'}`;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 10 - prefix.length; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix + random;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden: super admin only' }, { status: 403 });
  }

  try {
    const parsed = validate(bulkRowsSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { rows } = parsed.data;

    const existingCodes = new Set((await prisma.item.findMany({ select: { itemCode: true } })).map((i) => i.itemCode));
    const errors: { row: number; message: string }[] = [];
    let created = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as any;
      const rowNum = i + 2; // +1 header, +1 1-indexed

      if (!r.item_name) {
        errors.push({ row: rowNum, message: 'Nama item wajib diisi' });
        continue;
      }
      const itemGroup = r.item_group === 'Liquid' || r.item_group === 'Non-Liquid' ? r.item_group : 'Non-Liquid';

      let itemCode = r.item_code || generateItemCode(itemGroup);
      while (existingCodes.has(itemCode)) itemCode = generateItemCode(itemGroup);

      try {
        await prisma.item.create({
          data: {
            itemCode,
            itemName: r.item_name,
            itemGroup,
            unit: r.unit || 'PCS',
            purchasePrice: parseFloat(r.purchase_price) || 0,
            sellingPrice: parseFloat(r.selling_price) || 0,
            reorderLevel: parseFloat(r.reorder_level) || 0,
            valuationMethod: r.valuation_method === 'FIFO' ? 'FIFO' : 'Average',
            openingQty: parseFloat(r.opening_qty) || 0,
            openingValuationRate: parseFloat(r.opening_valuation_rate) || 0,
            isActive: true,
            currency: r.currency === 'USD' ? 'USD' : 'IDR',
            itemType: r.item_type === 'Trading' ? 'Trading' : 'Regular',
          },
        });
        existingCodes.add(itemCode);
        created++;
      } catch (err: any) {
        errors.push({ row: rowNum, message: err.message || 'Gagal menyimpan baris ini' });
      }
    }

    if (created > 0) {
      await logActivity({
        doctype: 'Item',
        documentId: `bulk-import-${Date.now()}`,
        action: 'Created',
        changedBy: session.user.name || '',
        before: null,
        after: { bulk_import: true, created, skipped: errors.length },
      });
    }

    return NextResponse.json({ success: true, created, skipped: errors.length, errors });
  } catch (error) {
    console.error('Error bulk importing items:', error);
    return NextResponse.json({ error: 'Failed to import items' }, { status: 500 });
  }
}
