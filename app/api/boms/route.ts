import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getNextDocId } from '@/lib/numbering';
import { logActivity } from '@/lib/activityLog';

async function requireAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.inventory) {
    return { error: NextResponse.json({ error: 'Forbidden: no inventory access' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const boms = await prisma.bom.findMany({
      include: { components: true },
      orderBy: { creation: 'desc' },
    });
    const items = await prisma.item.findMany({ select: { itemCode: true, itemName: true } });
    const itemNameMap = new Map(items.map((i) => [i.itemCode, i.itemName]));

    const result = boms.map((b) => ({
      bom_id: b.bomId,
      item_code: b.itemCode,
      item_name: itemNameMap.get(b.itemCode) || b.itemCode,
      qty: Number(b.qty),
      is_active: b.isActive,
      owner: b.owner,
      creation: b.creation,
      components: b.components.map((c) => ({
        bom_id: c.bomId,
        component_item_code: c.componentItemCode,
        component_item_name: itemNameMap.get(c.componentItemCode) || c.componentItemCode,
        qty: Number(c.qty),
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching BOMs:', error);
    return NextResponse.json({ error: 'Failed to fetch BOMs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { item_code, qty, components } = data;

    if (!item_code || !Array.isArray(components) || components.length === 0) {
      return NextResponse.json({ error: 'item_code dan minimal 1 komponen wajib diisi' }, { status: 400 });
    }
    if (components.some((c: any) => c.component_item_code === item_code)) {
      return NextResponse.json({ error: 'Komponen tidak boleh sama dengan produk campuran itu sendiri' }, { status: 400 });
    }

    const bomId = await getNextDocId('BOM');
    const now = new Date().toISOString();

    await prisma.bom.create({
      data: {
        bomId,
        itemCode: item_code,
        qty: qty || 1,
        isActive: true,
        owner: guard.session?.user.name || '',
        creation: now,
        components: {
          create: components.map((c: any) => ({
            componentItemCode: c.component_item_code,
            qty: c.qty,
          })),
        },
      },
    });

    await logActivity({
      doctype: 'BOM',
      documentId: bomId,
      action: 'Created',
      changedBy: guard.session?.user.name || '',
      before: null,
      after: { bom_id: bomId, item_code, qty: qty || 1, components: components.map((c: any) => `${c.component_item_code} x${c.qty}`).join(', ') },
    });

    return NextResponse.json({ success: true, bom_id: bomId });
  } catch (error) {
    console.error('Error creating BOM:', error);
    return NextResponse.json({ error: 'Failed to create BOM' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const bomId = searchParams.get('bom_id');
    if (!bomId) return NextResponse.json({ error: 'bom_id required' }, { status: 400 });

    const existing = await prisma.bom.findUnique({ where: { bomId } });
    if (!existing) return NextResponse.json({ error: 'BOM not found' }, { status: 404 });

    await prisma.bomComponent.deleteMany({ where: { bomId } });
    await prisma.bom.delete({ where: { bomId } });

    await logActivity({ doctype: 'BOM', documentId: bomId, action: 'Deleted', changedBy: guard.session?.user.name || '', before: null, after: { bom_id: bomId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting BOM:', error);
    return NextResponse.json({ error: 'Failed to delete BOM' }, { status: 500 });
  }
}
