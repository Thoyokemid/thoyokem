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
import AttachmentSection from '@/components/ui/AttachmentSection';
import { AlertCircle, Send, XCircle, FileText, Check, Ban, History, Printer, Copy } from 'lucide-react';

interface SalesOrderWithItems {
  so_id: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  delivery_date: string;
  status: string;
  approval_status: string;
  approved_by: string;
  total_amount: number;
  owner: string;
  amended_from?: string;
  items: { item_code: string; item_name: string; uom: string; qty: number; rate: number; amount: number; delivered_qty: number; warehouse_id: string }[];
}

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'orange' | 'green' | 'red'> = {
  Draft: 'gray',
  Confirmed: 'blue',
  'In Delivery': 'orange',
  Delivered: 'green',
  Cancelled: 'red',
};

const APPROVAL_TONE: Record<string, 'gray' | 'orange' | 'green' | 'red'> = {
  Pending: 'orange',
  Approved: 'green',
  Rejected: 'red',
};

export default function SalesOrderDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id));
  const [so, setSo] = useState<SalesOrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canApprove = !!session?.user.permissions.can_approve;

  useEffect(() => {
    if (session?.user.permissions.sales_order) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/sales-orders');
      if (res.ok) {
        const list: SalesOrderWithItems[] = await res.json();
        setSo(list.find((s) => s.so_id === id) || null);
      }
    } catch (error) {
      console.error('Error fetching sales order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runAction = async (action: 'submit' | 'cancel' | 'approve' | 'reject' | 'amend') => {
    if (action === 'cancel' && !confirm('Batalkan SO ini? Kalau sudah Delivered, stok yang sudah keluar akan dibalik.')) return;
    if (action === 'amend' && !confirm('Buat draft baru dari SO ini?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/sales-orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ so_id: id, action }) });
      if (res.ok) {
        if (action === 'amend') {
          const data = await res.json();
          router.push(`/dashboard/sales-order/sales-order/${encodeURIComponent(data.so_id)}`);
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

  const duplicateOrder = async () => {
    if (!so || !confirm(`Buat Sales Order baru sebagai salinan dari ${so.so_id}?`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: so.customer_id,
          delivery_date: so.delivery_date,
          items: so.items.map((i) => ({ item_code: i.item_code, qty: i.qty, rate: i.rate, warehouse_id: i.warehouse_id })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/sales-order/sales-order/${encodeURIComponent(data.so_id)}`);
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menduplikasi SO');
      }
    } catch (error) {
      console.error('Error duplicating sales order:', error);
    } finally {
      setBusy(false);
    }
  };

  const createInvoice = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/sales-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ so_id: id, due_date: '' }) });
      if (res.ok) alert('Invoice berhasil dibuat. Cek tab Invoices.');
      else {
        const err = await res.json();
        alert(err.error || 'Gagal membuat invoice');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
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
        backLabel="Sales Orders"
        title={so?.so_id || id}
        subtitle={so ? `${so.customer_name} · dibuat oleh ${so.owner || '-'}` : undefined}
        isLoading={isLoading}
        notFound={!isLoading && !so}
        badges={
          so && (
            <>
              <StatusBadge label={so.status} tone={STATUS_TONE[so.status] || 'gray'} />
              {so.status === 'Confirmed' && <StatusBadge label={so.approval_status} tone={APPROVAL_TONE[so.approval_status] || 'gray'} />}
            </>
          )
        }
        actions={
          so && (
            <>
              <Button variant="secondary" onClick={() => router.push(`/dashboard/sales-order/sales-order/${encodeURIComponent(id)}/print?size=a4`)}>
                <Printer size={14} className="mr-1.5" />Print
              </Button>
              <Button variant="secondary" disabled={busy} onClick={duplicateOrder}>
                <Copy size={14} className="mr-1.5" />Duplicate
              </Button>
              {so.status === 'Draft' && (
                <Button variant="secondary" disabled={busy} onClick={() => runAction('submit')}><Send size={14} className="mr-1.5" />Confirm</Button>
              )}
              {so.status === 'Confirmed' && so.approval_status === 'Pending' && canApprove && (
                <>
                  <Button variant="secondary" disabled={busy} onClick={() => runAction('approve')}><Check size={14} className="mr-1.5" />Approve</Button>
                  <Button variant="danger" disabled={busy} onClick={() => runAction('reject')}><Ban size={14} className="mr-1.5" />Reject</Button>
                </>
              )}
              {so.status === 'Delivered' && (
                <Button variant="secondary" disabled={busy} onClick={createInvoice}><FileText size={14} className="mr-1.5" />Create Invoice</Button>
              )}
              {(so.status === 'Draft' || so.status === 'Confirmed' || so.status === 'Delivered') && (
                <Button variant="danger" disabled={busy} onClick={() => runAction('cancel')}><XCircle size={14} className="mr-1.5" />Cancel</Button>
              )}
              {so.status === 'Cancelled' && (
                <Button variant="secondary" disabled={busy} onClick={() => runAction('amend')}><History size={14} className="mr-1.5" />Amend</Button>
              )}
            </>
          )
        }
      >
        {so && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  {
                    label: 'Customer',
                    value: (
                      <Link href={`/dashboard/sales-order/customer/${encodeURIComponent(so.customer_id)}`} className="text-primary hover:underline">
                        {so.customer_name}
                      </Link>
                    ),
                  },
                  { label: 'Order Date', value: so.order_date },
                  { label: 'Delivery Date', value: so.delivery_date || '-' },
                  { label: 'Total Amount', value: `Rp${so.total_amount.toLocaleString('id-ID')}` },
                  { label: 'Approved By', value: so.approved_by || '-' },
                  { label: 'Owner', value: so.owner || '-' },
                  {
                    label: 'Amended From',
                    value: so.amended_from ? (
                      <Link href={`/dashboard/sales-order/sales-order/${encodeURIComponent(so.amended_from)}`} className="text-primary hover:underline">
                        {so.amended_from}
                      </Link>
                    ) : '-',
                  },
                ]}
              />
            </DetailSection>
            <DetailSection title="Items">
              <DetailTable
                columns={[
                  { key: 'item_name', header: 'Item' },
                  { key: 'warehouse_id', header: 'Warehouse' },
                  { key: 'qty', header: 'Qty', align: 'right' },
                  { key: 'uom', header: 'Unit' },
                  { key: 'delivered_qty', header: 'Delivered', align: 'right' },
                  { key: 'rate', header: 'Rate', align: 'right' },
                  { key: 'amount', header: 'Amount', align: 'right' },
                ]}
                rows={so.items.map((i) => ({
                  item_name: (
                    <Link href={`/dashboard/inventory/item/${encodeURIComponent(i.item_code)}`} className="text-primary hover:underline">
                      {i.item_name} ({i.item_code})
                    </Link>
                  ),
                  warehouse_id: (
                    <Link href={`/dashboard/inventory/warehouse/${encodeURIComponent(i.warehouse_id)}`} className="text-primary hover:underline">
                      {i.warehouse_id}
                    </Link>
                  ),
                  qty: i.qty,
                  uom: i.uom,
                  delivered_qty: i.delivered_qty,
                  rate: `Rp${i.rate.toLocaleString('id-ID')}`,
                  amount: `Rp${i.amount.toLocaleString('id-ID')}`,
                }))}
              />
            </DetailSection>
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Sales Order" documentId={so.so_id} />
              <AttachmentSection doctype="Sales Order" documentId={so.so_id} />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
