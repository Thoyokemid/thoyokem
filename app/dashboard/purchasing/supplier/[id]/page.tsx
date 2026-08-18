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
import { Supplier } from '@/types';
import { AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/date';

interface PurchaseOrderRow {
  po_id: string;
  supplier_id: string;
  status: string;
  order_date: string;
  total_amount: number;
}

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'green' | 'red'> = {
  Draft: 'gray',
  Submitted: 'blue',
  Received: 'green',
  Cancelled: 'red',
};

export default function SupplierDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id));
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user.permissions.purchasing) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [supRes, poRes] = await Promise.all([fetch('/api/suppliers'), fetch('/api/purchase-orders')]);
      if (supRes.ok) {
        const list: Supplier[] = await supRes.json();
        setSupplier(list.find((s) => s.supplier_id === id) || null);
      }
      if (poRes.ok) {
        const list: PurchaseOrderRow[] = await poRes.json();
        setOrders(list.filter((o) => o.supplier_id === id));
      }
    } catch (error) {
      console.error('Error fetching supplier:', error);
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

  if (!session.user.permissions.purchasing) {
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
        backHref="/dashboard/purchasing"
        backLabel="Suppliers"
        title={supplier?.supplier_name || id}
        subtitle={supplier?.supplier_id}
        isLoading={isLoading}
        notFound={!isLoading && !supplier}
        badges={supplier && <StatusBadge label={supplier.is_active ? 'Active' : 'Inactive'} tone={supplier.is_active ? 'green' : 'gray'} />}
      >
        {supplier && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  { label: 'Contact', value: supplier.contact || '-' },
                  { label: 'Phone', value: supplier.phone || '-' },
                  { label: 'Email', value: supplier.email || '-' },
                  { label: 'Address', value: supplier.address || '-' },
                  { label: 'Payment Terms', value: supplier.payment_terms || '-' },
                ]}
              />
            </DetailSection>
            <DetailSection title={`Purchase Orders (${orders.length})`}>
              <DetailTable
                columns={[
                  { key: 'po_id', header: 'PO' },
                  { key: 'order_date', header: 'Date' },
                  { key: 'status', header: 'Status' },
                  { key: 'total_amount', header: 'Total', align: 'right' },
                ]}
                rows={orders.map((o) => ({
                  po_id: (
                    <button className="text-primary hover:underline" onClick={() => router.push(`/dashboard/purchasing/purchase-order/${encodeURIComponent(o.po_id)}`)}>
                      {o.po_id}
                    </button>
                  ),
                  order_date: formatDate(o.order_date),
                  status: <StatusBadge label={o.status} tone={STATUS_TONE[o.status] || 'gray'} />,
                  total_amount: `Rp${o.total_amount.toLocaleString('id-ID')}`,
                }))}
              />
            </DetailSection>
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Supplier" documentId={supplier.supplier_id} />
              <AttachmentSection doctype="Supplier" documentId={supplier.supplier_id} />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
