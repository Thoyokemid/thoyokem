import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { validate, bulkRowsSchema } from '@/lib/validation';
import { hasDoctypePermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasDoctypePermission(session, 'Customer', 'import'))) {
    return NextResponse.json({ error: 'Forbidden: no import access' }, { status: 403 });
  }

  try {
    const parsed = validate(bulkRowsSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { rows } = parsed.data;

    let count = await prisma.customer.count();
    const errors: { row: number; message: string }[] = [];
    let created = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as any;
      const rowNum = i + 2;

      if (!r.customer_name) {
        errors.push({ row: rowNum, message: 'Nama customer wajib diisi' });
        continue;
      }

      count++;
      const customerId = r.customer_id || `CUST-${String(count).padStart(3, '0')}`;

      try {
        await prisma.customer.create({
          data: {
            customerId,
            customerName: r.customer_name,
            contact: r.contact || '',
            phone: r.phone || '',
            email: r.email || '',
            address: r.address || '',
            paymentTerms: r.payment_terms || '',
            creditLimit: parseFloat(r.credit_limit) || 0,
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
        doctype: 'Customer',
        documentId: `bulk-import-${Date.now()}`,
        action: 'Imported',
        changedBy: session.user.name || '',
        before: null,
        after: { bulk_import: true, created, skipped: errors.length },
      });
    }

    return NextResponse.json({ success: true, created, skipped: errors.length, errors });
  } catch (error) {
    console.error('Error bulk importing customers:', error);
    return NextResponse.json({ error: 'Failed to import customers' }, { status: 500 });
  }
}
