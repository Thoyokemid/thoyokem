'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DetailView, DetailSection, FieldGrid, DetailTable } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import { AlertCircle } from 'lucide-react';

interface DeliveryNoteWithItems {
  dn_id: string;
  so_id: string;
  customer_id: string;
  customer_name: string;
  posting_date: string;
  status: string;
  owner: string;
  items: { item_code: string; delivered_qty: number; warehouse_id: string }[];
}

export default function DeliveryNoteDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [dn, setDn] = useState<DeliveryNoteWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasAccess = !!(session?.user.permissions.delivery_order || session?.user.permissions.sales_order);

  useEffect(() => {
    if (hasAccess) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/delivery-notes');
      if (res.ok) {
        const list: DeliveryNoteWithItems[] = await res.json();
        setDn(list.find((d) => d.dn_id === id) || null);
      }
    } catch (error) {
      console.error('Error fetching delivery note:', error);
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

  if (!hasAccess) {
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
        backHref="/dashboard/delivery-order"
        backLabel="Delivery Order"
        title={dn?.dn_id || id}
        subtitle={dn ? `${dn.customer_name} · SO ${dn.so_id} · dikirim oleh ${dn.owner || '-'}` : undefined}
        isLoading={isLoading}
        notFound={!isLoading && !dn}
        badges={dn && <StatusBadge label={dn.status} tone="green" />}
      >
        {dn && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  { label: 'Customer', value: dn.customer_name },
                  { label: 'Sales Order', value: dn.so_id },
                  { label: 'Posting Date', value: dn.posting_date },
                  { label: 'Owner', value: dn.owner || '-' },
                ]}
              />
            </DetailSection>
            <DetailSection title="Items">
              <DetailTable
                columns={[
                  { key: 'item_code', header: 'Item' },
                  { key: 'warehouse_id', header: 'Warehouse' },
                  { key: 'delivered_qty', header: 'Delivered Qty', align: 'right' },
                ]}
                rows={dn.items.map((i) => ({ item_code: i.item_code, warehouse_id: i.warehouse_id, delivered_qty: i.delivered_qty }))}
              />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
