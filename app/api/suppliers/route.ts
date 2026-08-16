import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { Supplier } from '@/types';

async function requireAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.purchasing) {
    return { error: NextResponse.json({ error: 'Forbidden: no purchasing access' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const records = await prisma.supplier.findMany();
    const suppliers: Supplier[] = records.map((r) => ({
      supplier_id: r.supplierId,
      supplier_name: r.supplierName,
      contact: r.contact || '',
      phone: r.phone || '',
      email: r.email || '',
      address: r.address || '',
      payment_terms: r.paymentTerms || '',
      is_active: r.isActive,
    }));
    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const count = await prisma.supplier.count();
    const newId = data.supplier_id || `SUP-${String(count + 1).padStart(3, '0')}`;

    const existing = await prisma.supplier.findUnique({ where: { supplierId: newId } });
    if (existing) {
      return NextResponse.json({ error: 'Supplier ID sudah dipakai' }, { status: 400 });
    }

    const created = await prisma.supplier.create({
      data: {
        supplierId: newId,
        supplierName: data.supplier_name || '',
        contact: data.contact || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        paymentTerms: data.payment_terms || '',
        isActive: true,
      },
    });

    await logActivity({ doctype: 'Supplier', documentId: newId, action: 'Created', changedBy: guard.session?.user.name || '', before: null, after: created });

    return NextResponse.json({ success: true, supplier_id: newId });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { supplier_id, ...updates } = data;

    const current = await prisma.supplier.findUnique({ where: { supplierId: supplier_id } });
    if (!current) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const updated = await prisma.supplier.update({
      where: { supplierId: supplier_id },
      data: {
        supplierName: updates.supplier_name ?? current.supplierName,
        contact: updates.contact ?? current.contact,
        phone: updates.phone ?? current.phone,
        email: updates.email ?? current.email,
        address: updates.address ?? current.address,
        paymentTerms: updates.payment_terms ?? current.paymentTerms,
        isActive: updates.is_active !== undefined ? !!updates.is_active : current.isActive,
      },
    });

    await logActivity({ doctype: 'Supplier', documentId: supplier_id, action: 'Updated', changedBy: guard.session?.user.name || '', before: current, after: updated });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplier_id');
    if (!supplierId) return NextResponse.json({ error: 'supplier_id required' }, { status: 400 });

    const existing = await prisma.supplier.findUnique({ where: { supplierId } });
    if (!existing) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    await prisma.supplier.delete({ where: { supplierId } });
    await logActivity({ doctype: 'Supplier', documentId: supplierId, action: 'Deleted', changedBy: guard.session?.user.name || '', before: null, after: { supplier_id: supplierId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
  }
}
