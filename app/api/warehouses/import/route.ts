import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';

function generateWarehouseId(): string {
  let id = '';
  for (let i = 0; i < 10; i++) id += Math.floor(Math.random() * 10);
  return id;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden: super admin only' }, { status: 403 });
  }

  try {
    const { rows } = await request.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada baris untuk diimport' }, { status: 400 });
    }

    const existingIds = new Set((await prisma.warehouse.findMany({ select: { warehouseId: true } })).map((w) => w.warehouseId));
    const errors: { row: number; message: string }[] = [];
    let created = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;

      if (!r.warehouse_name) {
        errors.push({ row: rowNum, message: 'Nama warehouse wajib diisi' });
        continue;
      }

      let warehouseId = r.warehouse_id || generateWarehouseId();
      while (existingIds.has(warehouseId)) warehouseId = generateWarehouseId();

      try {
        await prisma.warehouse.create({
          data: {
            warehouseId,
            warehouseName: r.warehouse_name,
            location: r.location || '',
            isActive: true,
            pic: r.pic || '',
            phone: r.phone || '',
            address: r.address || '',
            postalCode: r.postal_code || '',
          },
        });
        existingIds.add(warehouseId);
        created++;
      } catch (err: any) {
        errors.push({ row: rowNum, message: err.message || 'Gagal menyimpan baris ini' });
      }
    }

    if (created > 0) {
      await logActivity({
        doctype: 'Warehouse',
        documentId: `bulk-import-${Date.now()}`,
        action: 'Created',
        changedBy: session.user.name || '',
        before: null,
        after: { bulk_import: true, created, skipped: errors.length },
      });
    }

    return NextResponse.json({ success: true, created, skipped: errors.length, errors });
  } catch (error) {
    console.error('Error bulk importing warehouses:', error);
    return NextResponse.json({ error: 'Failed to import warehouses' }, { status: 500 });
  }
}
