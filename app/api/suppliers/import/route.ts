import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';

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

    let count = await prisma.supplier.count();
    const errors: { row: number; message: string }[] = [];
    let created = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;

      if (!r.supplier_name) {
        errors.push({ row: rowNum, message: 'Nama supplier wajib diisi' });
        continue;
      }

      count++;
      const supplierId = r.supplier_id || `SUP-${String(count).padStart(3, '0')}`;

      try {
        await prisma.supplier.create({
          data: {
            supplierId,
            supplierName: r.supplier_name,
            contact: r.contact || '',
            phone: r.phone || '',
            email: r.email || '',
            address: r.address || '',
            paymentTerms: r.payment_terms || '',
            isActive: true,
          },
        });
        created++;
      } catch (err: any) {
        errors.push({ row: rowNum, message: err.message || 'Gagal menyimpan baris ini (ID mungkin sudah dipakai)' });
      }
    }

    if (created > 0) {
      await logActivity({
        doctype: 'Supplier',
        documentId: `bulk-import-${Date.now()}`,
        action: 'Created',
        changedBy: session.user.name || '',
        before: null,
        after: { bulk_import: true, created, skipped: errors.length },
      });
    }

    return NextResponse.json({ success: true, created, skipped: errors.length, errors });
  } catch (error) {
    console.error('Error bulk importing suppliers:', error);
    return NextResponse.json({ error: 'Failed to import suppliers' }, { status: 500 });
  }
}
