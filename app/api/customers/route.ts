import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { Customer } from '@/types';

async function requireAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.user.permissions.sales_order) {
    return { error: NextResponse.json({ error: 'Forbidden: no sales access' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const records = await prisma.customer.findMany();
    const customers: Customer[] = records.map((r) => ({
      customer_id: r.customerId,
      customer_name: r.customerName,
      contact: r.contact || '',
      phone: r.phone || '',
      email: r.email || '',
      address: r.address || '',
      payment_terms: r.paymentTerms || '',
      credit_limit: Number(r.creditLimit),
      is_active: r.isActive,
    }));
    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const count = await prisma.customer.count();
    const newId = data.customer_id || `CUST-${String(count + 1).padStart(3, '0')}`;

    const existing = await prisma.customer.findUnique({ where: { customerId: newId } });
    if (existing) {
      return NextResponse.json({ error: 'Customer ID sudah dipakai' }, { status: 400 });
    }

    const created = await prisma.customer.create({
      data: {
        customerId: newId,
        customerName: data.customer_name || '',
        contact: data.contact || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        paymentTerms: data.payment_terms || '',
        creditLimit: data.credit_limit ?? 0,
        isActive: true,
      },
    });

    await logActivity({ doctype: 'Customer', documentId: newId, action: 'Created', changedBy: guard.session?.user.name || '', before: null, after: created });

    return NextResponse.json({ success: true, customer_id: newId });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const data = await request.json();
    const { customer_id, ...updates } = data;

    const current = await prisma.customer.findUnique({ where: { customerId: customer_id } });
    if (!current) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const updated = await prisma.customer.update({
      where: { customerId: customer_id },
      data: {
        customerName: updates.customer_name ?? current.customerName,
        contact: updates.contact ?? current.contact,
        phone: updates.phone ?? current.phone,
        email: updates.email ?? current.email,
        address: updates.address ?? current.address,
        paymentTerms: updates.payment_terms ?? current.paymentTerms,
        creditLimit: updates.credit_limit ?? current.creditLimit,
        isActive: updates.is_active !== undefined ? !!updates.is_active : current.isActive,
      },
    });

    await logActivity({ doctype: 'Customer', documentId: customer_id, action: 'Updated', changedBy: guard.session?.user.name || '', before: current, after: updated });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 });

    const existing = await prisma.customer.findUnique({ where: { customerId } });
    if (!existing) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    await prisma.customer.delete({ where: { customerId } });
    await logActivity({ doctype: 'Customer', documentId: customerId, action: 'Deleted', changedBy: guard.session?.user.name || '', before: null, after: { customer_id: customerId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
