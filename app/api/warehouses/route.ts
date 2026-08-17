import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { Warehouse } from '@/types';
import { validate, warehouseCreateSchema, warehouseUpdateSchema } from '@/lib/validation';

function generateWarehouseId(): string {
  let id = '';
  for (let i = 0; i < 10; i++) id += Math.floor(Math.random() * 10);
  return id;
}

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
    const records = await prisma.warehouse.findMany();
    const warehouses: Warehouse[] = records.map((r) => ({
      warehouse_id: r.warehouseId,
      warehouse_name: r.warehouseName,
      location: r.location,
      is_active: r.isActive,
      pic: r.pic || '',
      phone: r.phone || '',
      address: r.address || '',
      postal_code: r.postalCode || '',
    }));
    return NextResponse.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const parsed = validate(warehouseCreateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    let newId = generateWarehouseId();
    while (await prisma.warehouse.findUnique({ where: { warehouseId: newId } })) {
      newId = generateWarehouseId();
    }

    const created = await prisma.warehouse.create({
      data: {
        warehouseId: newId,
        warehouseName: data.warehouse_name || '',
        location: data.location || '',
        isActive: true,
        pic: data.pic || '',
        phone: data.phone || '',
        address: data.address || '',
        postalCode: data.postal_code || '',
      },
    });

    await logActivity({ doctype: 'Warehouse', documentId: newId, action: 'Created', changedBy: guard.session?.user.name || '', before: null, after: created });

    return NextResponse.json({ success: true, warehouse_id: newId });
  } catch (error) {
    console.error('Error creating warehouse:', error);
    return NextResponse.json({ error: 'Failed to create warehouse' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const parsed = validate(warehouseUpdateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { warehouse_id, ...updates } = parsed.data;

    const current = await prisma.warehouse.findUnique({ where: { warehouseId: warehouse_id } });
    if (!current) return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });

    const updated = await prisma.warehouse.update({
      where: { warehouseId: warehouse_id },
      data: {
        warehouseName: updates.warehouse_name ?? current.warehouseName,
        location: updates.location ?? current.location,
        pic: updates.pic ?? current.pic,
        phone: updates.phone ?? current.phone,
        address: updates.address ?? current.address,
        postalCode: updates.postal_code ?? current.postalCode,
        isActive: updates.is_active !== undefined ? !!updates.is_active : current.isActive,
      },
    });

    await logActivity({ doctype: 'Warehouse', documentId: warehouse_id, action: 'Updated', changedBy: guard.session?.user.name || '', before: current, after: updated });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    return NextResponse.json({ error: 'Failed to update warehouse' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireInventoryAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id');
    if (!warehouseId) return NextResponse.json({ error: 'warehouse_id required' }, { status: 400 });

    const existing = await prisma.warehouse.findUnique({ where: { warehouseId } });
    if (!existing) return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });

    await prisma.warehouse.delete({ where: { warehouseId } });
    await logActivity({ doctype: 'Warehouse', documentId: warehouseId, action: 'Deleted', changedBy: guard.session?.user.name || '', before: null, after: { warehouse_id: warehouseId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    return NextResponse.json({ error: 'Failed to delete warehouse' }, { status: 500 });
  }
}
