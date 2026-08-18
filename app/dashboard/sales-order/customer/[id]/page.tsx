'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DetailView, DetailSection, FieldGrid, DetailTable } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import AttachmentSection from '@/components/ui/AttachmentSection';
import { Customer } from '@/types';
import { AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/date';

interface SalesOrderRow {
  so_id: string;
  customer_id: string;
  status: string;
  order_date: string;
  total_amount: number;
}

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'green' | 'red'> = {
  Draft: 'gray',
  Confirmed: 'blue',
  Delivered: 'green',
  Cancelled: 'red',
};

export default function CustomerDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id));
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user.permissions.sales_order) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [custRes, soRes] = await Promise.all([fetch('/api/customers'), fetch('/api/sales-orders')]);
      if (custRes.ok) {
        const list: Customer[] = await custRes.json();
        setCustomer(list.find((c) => c.customer_id === id) || null);
      }
      if (soRes.ok) {
        const list: SalesOrderRow[] = await soRes.json();
        setOrders(list.filter((o) => o.customer_id === id));
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status !== 'loading' && !session) redirect('/login');
  if (status === 'loading') return null;
  if (!session) return null;

  const layoutUser = {
    id: session.user.id,
    username: session.user.email || '',
    name: session.user.name ?? '',
    role: session.user.role,
    permissions: session.user.permissions,
  };

  if (!session.user.permissions.sales_order) {
    return (
      <DashboardLayout user={layoutUser}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={layoutUser}>
      <DetailView
        backHref="/dashboard/sales-order"
        backLabel="Customers"
        title={customer?.customer_name || id}
        subtitle={customer?.customer_id}
        isLoading={isLoading}
        notFound={!isLoading && !customer}
        badges={customer && <StatusBadge label={customer.is_active ? 'Active' : 'Inactive'} tone={customer.is_active ? 'green' : 'gray'} />}
      >
        {customer && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  { label: 'Contact', value: customer.contact || '-' },
                  { label: 'Phone', value: customer.phone || '-' },
                  { label: 'Email', value: customer.email || '-' },
                  { label: 'Address', value: customer.address || '-' },
                  { label: 'Payment Terms', value: customer.payment_terms || '-' },
                  { label: 'Credit Limit', value: `Rp${customer.credit_limit.toLocaleString('id-ID')}` },
                ]}
              />
            </DetailSection>
            <DetailSection title={`Sales Orders (${orders.length})`}>
              <DetailTable
                columns={[
                  { key: 'so_id', header: 'SO' },
                  { key: 'order_date', header: 'Date' },
                  { key: 'status', header: 'Status' },
                  { key: 'total_amount', header: 'Total', align: 'right' },
                ]}
                rows={orders.map((o) => ({
                  so_id: (
                    <button className="text-primary hover:underline" onClick={() => router.push(`/dashboard/sales-order/sales-order/${encodeURIComponent(o.so_id)}`)}>
                      {o.so_id}
                    </button>
                  ),
                  order_date: formatDate(o.order_date),
                  status: <StatusBadge label={o.status} tone={STATUS_TONE[o.status] || 'gray'} />,
                  total_amount: `Rp${o.total_amount.toLocaleString('id-ID')}`,
                }))}
              />
            </DetailSection>
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Customer" documentId={customer.customer_id} />
              <AttachmentSection doctype="Customer" documentId={customer.customer_id} />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
