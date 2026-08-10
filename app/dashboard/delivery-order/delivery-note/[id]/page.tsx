'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import { DetailView, DetailSection, FieldGrid, DetailTable } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import { AlertCircle, XCircle, History } from 'lucide-react';

interface DeliveryNoteWithItems {
  dn_id: string;
  so_id: string;
  customer_id: string;
  customer_name: string;
  posting_date: string;
  status: string;
  owner: string;
  amended_from?: string;
  items: { item_code: string; delivered_qty: number; warehouse_id: string }[];
}

export default function DeliveryNoteDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id));
  const [dn, setDn] = useState<DeliveryNoteWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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

  const runAction = async (action: 'cancel' | 'amend') => {
    if (action === 'cancel' && !confirm('Batalkan delivery ini? Stok yang sudah keluar akan dikembalikan.')) return;
    if (action === 'amend' && !confirm('Kirim ulang delivery ini (buat DN baru)?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/delivery-notes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dn_id: id, action }) });
      if (res.ok) {
        if (action === 'amend') {
          const data = await res.json();
          router.push(`/dashboard/delivery-order/delivery-note/${encodeURIComponent(data.dn_id)}`);
        } else {
          fetchData();
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal memproses aksi');
      }
    } catch (error) {
      console.error('Error running action:', error);
    } finally {
      setBusy(false);
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
        badges={dn && <StatusBadge label={dn.status} tone={dn.status === 'Cancelled' ? 'red' : 'green'} />}
        actions={
          dn && (
            <>
              {dn.status !== 'Cancelled' && (
                <Button variant="danger" disabled={busy} onClick={() => runAction('cancel')}><XCircle size={14} className="mr-1.5" />Cancel</Button>
              )}
              {dn.status === 'Cancelled' && (
                <Button variant="secondary" disabled={busy} onClick={() => runAction('amend')}><History size={14} className="mr-1.5" />Amend</Button>
              )}
            </>
          )
        }
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
                  {
                    label: 'Amended From',
                    value: dn.amended_from ? (
                      <Link href={`/dashboard/delivery-order/delivery-note/${encodeURIComponent(dn.amended_from)}`} className="text-primary hover:underline">
                        {dn.amended_from}
                      </Link>
                    ) : '-',
                  },
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
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Delivery Note" documentId={dn.dn_id} />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
