import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { Item } from '@/types';

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
    const records = await prisma.item.findMany();
    const items: Item[] = records.map((r) => ({
      item_code: r.itemCode,
      item_name: r.itemName,
      item_group: r.itemGroup,
      unit: r.unit,
      purchase_price: Number(r.purchasePrice),
      selling_price: Number(r.sellingPrice),
      reorder_level: Number(r.reorderLevel),
      valuation_method: r.valuationMethod as 'FIFO' | 'Average',
      opening_qty: Number(r.openingQty),
      opening_valuation_rate: Number(r.openingValuationRate),
      is_active: r.isActive,
      currency: r.currency as 'IDR' | 'USD',
      item_type: r.itemType as 'Trading' | 'Regular',
    }));
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();

    const existing = await prisma.item.findUnique({ where: { itemCode: data.item_code } });
    if (existing) {
      return NextResponse.json({ error: 'Item code sudah dipakai' }, { status: 400 });
    }

    const created = await prisma.item.create({
      data: {
        itemCode: data.item_code || '',
        itemName: data.item_name || '',
        itemGroup: data.item_group || '',
        unit: data.unit || '',
        purchasePrice: data.purchase_price ?? 0,
        sellingPrice: data.selling_price ?? 0,
        reorderLevel: data.reorder_level ?? 0,
        valuationMethod: data.valuation_method || 'Average',
        openingQty: data.opening_qty ?? 0,
        openingValuationRate: data.opening_valuation_rate ?? 0,
        isActive: true,
        currency: data.currency || 'IDR',
        itemType: data.item_type || 'Regular',
      },
    });

    await logActivity({ doctype: 'Item', documentId: data.item_code, action: 'Created', changedBy: guard.session?.user.name || '', before: null, after: created });

    return NextResponse.json({ success: true, item_code: data.item_code });
  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { item_code, ...updates } = data;

    const current = await prisma.item.findUnique({ where: { itemCode: item_code } });
    if (!current) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const updated = await prisma.item.update({
      where: { itemCode: item_code },
      data: {
        itemName: updates.item_name ?? current.itemName,
        itemGroup: updates.item_group ?? current.itemGroup,
        unit: updates.unit ?? current.unit,
        purchasePrice: updates.purchase_price ?? current.purchasePrice,
        sellingPrice: updates.selling_price ?? current.sellingPrice,
        reorderLevel: updates.reorder_level ?? current.reorderLevel,
        valuationMethod: updates.valuation_method ?? current.valuationMethod,
        currency: updates.currency ?? current.currency,
        itemType: updates.item_type ?? current.itemType,
        isActive: updates.is_active !== undefined ? !!updates.is_active : current.isActive,
      },
    });

    await logActivity({ doctype: 'Item', documentId: item_code, action: 'Updated', changedBy: guard.session?.user.name || '', before: current, after: updated });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const itemCode = searchParams.get('item_code');
    if (!itemCode) return NextResponse.json({ error: 'item_code required' }, { status: 400 });

    const existing = await prisma.item.findUnique({ where: { itemCode } });
    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await prisma.item.delete({ where: { itemCode } });
    await logActivity({ doctype: 'Item', documentId: itemCode, action: 'Deleted', changedBy: guard.session?.user.name || '', before: null, after: { item_code: itemCode } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
