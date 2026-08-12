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
import { AlertCircle, Send, PackageCheck, XCircle, FileText, Check, Ban, History, Printer } from 'lucide-react';

interface PurchaseOrderWithItems {
  po_id: string;
  supplier_id: string;
  supplier_name: string;
  order_date: string;
  expected_date: string;
  status: string;
  approval_status: string;
  approved_by: string;
  total_amount: number;
  owner: string;
  creation: string;
  amended_from?: string;
  items: { item_code: string; item_name: string; uom: string; qty: number; rate: number; amount: number; received_qty: number; warehouse_id: string }[];
}

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'green' | 'red'> = {
  Draft: 'gray',
  Submitted: 'blue',
  Received: 'green',
  Cancelled: 'red',
};

const APPROVAL_TONE: Record<string, 'gray' | 'orange' | 'green' | 'red'> = {
  Pending: 'orange',
  Approved: 'green',
  Rejected: 'red',
};

export default function PurchaseOrderDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id));
  const [po, setPo] = useState<PurchaseOrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canApprove = !!session?.user.permissions.can_approve;

  useEffect(() => {
    if (session?.user.permissions.purchasing) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/purchase-orders');
      if (res.ok) {
        const list: PurchaseOrderWithItems[] = await res.json();
        setPo(list.find((p) => p.po_id === id) || null);
      }
    } catch (error) {
      console.error('Error fetching purchase order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runAction = async (action: 'submit' | 'receive' | 'cancel' | 'approve' | 'reject' | 'amend') => {
    if (action === 'cancel' && !confirm('Batalkan PO ini? Kalau sudah Received, stok yang sudah masuk akan dibalik.')) return;
    if (action === 'amend' && !confirm('Buat draft baru dari PO ini?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/purchase-orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ po_id: id, action }) });
      if (res.ok) {
        if (action === 'amend') {
          const data = await res.json();
          router.push(`/dashboard/purchasing/purchase-order/${encodeURIComponent(data.po_id)}`);
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

  const createInvoice = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/purchase-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ po_id: id, due_date: '' }) });
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
        backLabel="Purchase Orders"
        title={po?.po_id || id}
        subtitle={po ? `${po.supplier_name} · dibuat oleh ${po.owner || '-'}` : undefined}
        isLoading={isLoading}
        notFound={!isLoading && !po}
        badges={
          po && (
            <>
              <StatusBadge label={po.status} tone={STATUS_TONE[po.status] || 'gray'} />
              {po.status === 'Submitted' && <StatusBadge label={po.approval_status} tone={APPROVAL_TONE[po.approval_status] || 'gray'} />}
            </>
          )
        }
        actions={
          po && (
            <>
              <Button variant="secondary" onClick={() => router.push(`/dashboard/purchasing/purchase-order/${encodeURIComponent(id)}/print?size=a4`)}>
                <Printer size={14} className="mr-1.5" />Print
              </Button>
              {po.status === 'Draft' && (
                <Button variant="secondary" disabled={busy} onClick={() => runAction('submit')}><Send size={14} className="mr-1.5" />Submit</Button>
              )}
              {po.status === 'Submitted' && po.approval_status === 'Pending' && canApprove && (
                <>
                  <Button variant="secondary" disabled={busy} onClick={() => runAction('approve')}><Check size={14} className="mr-1.5" />Approve</Button>
                  <Button variant="danger" disabled={busy} onClick={() => runAction('reject')}><Ban size={14} className="mr-1.5" />Reject</Button>
                </>
              )}
              {po.status === 'Submitted' && po.approval_status === 'Approved' && (
                <Button variant="secondary" disabled={busy} onClick={() => runAction('receive')}><PackageCheck size={14} className="mr-1.5" />Receive</Button>
              )}
              {po.status === 'Received' && (
                <Button variant="secondary" disabled={busy} onClick={createInvoice}><FileText size={14} className="mr-1.5" />Create Invoice</Button>
              )}
              {(po.status === 'Draft' || po.status === 'Submitted' || po.status === 'Received') && (
                <Button variant="danger" disabled={busy} onClick={() => runAction('cancel')}><XCircle size={14} className="mr-1.5" />Cancel</Button>
              )}
              {po.status === 'Cancelled' && (
                <Button variant="secondary" disabled={busy} onClick={() => runAction('amend')}><History size={14} className="mr-1.5" />Amend</Button>
              )}
            </>
          )
        }
      >
        {po && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  {
                    label: 'Supplier',
                    value: (
                      <Link href={`/dashboard/purchasing/supplier/${encodeURIComponent(po.supplier_id)}`} className="text-primary hover:underline">
                        {po.supplier_name}
                      </Link>
                    ),
                  },
                  { label: 'Order Date', value: po.order_date },
                  { label: 'Expected Date', value: po.expected_date || '-' },
                  { label: 'Total Amount', value: `Rp${po.total_amount.toLocaleString('id-ID')}` },
                  { label: 'Approved By', value: po.approved_by || '-' },
                  { label: 'Owner', value: po.owner || '-' },
                  {
                    label: 'Amended From',
                    value: po.amended_from ? (
                      <Link href={`/dashboard/purchasing/purchase-order/${encodeURIComponent(po.amended_from)}`} className="text-primary hover:underline">
                        {po.amended_from}
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
                  { key: 'received_qty', header: 'Received', align: 'right' },
                  { key: 'rate', header: 'Rate', align: 'right' },
                  { key: 'amount', header: 'Amount', align: 'right' },
                ]}
                rows={po.items.map((i) => ({
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
                  received_qty: i.received_qty,
                  rate: `Rp${i.rate.toLocaleString('id-ID')}`,
                  amount: `Rp${i.amount.toLocaleString('id-ID')}`,
                }))}
              />
            </DetailSection>
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Purchase Order" documentId={po.po_id} />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
