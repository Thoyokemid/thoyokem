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
import AssignedToSection from '@/components/ui/AssignedToSection';
import AttachmentSection from '@/components/ui/AttachmentSection';
import { AlertCircle, XCircle, History, Printer, ChevronDown, ClipboardCheck, PackageCheck, Truck } from 'lucide-react';
import { formatDate } from '@/lib/date';
import toast from 'react-hot-toast';

const STATUS_TONE: Record<string, 'gray' | 'orange' | 'blue' | 'green' | 'red'> = {
  Unallocated: 'gray',
  'Pick Confirmed': 'orange',
  'Packing Completed': 'blue',
  'Good Issued': 'green',
  Cancelled: 'red',
};

interface DeliveryNoteWithItems {
  dn_id: string;
  so_id: string;
  customer_id: string;
  customer_name: string;
  posting_date: string;
  status: string;
  owner: string;
  amended_from?: string;
  items: { item_code: string; item_name: string; uom: string; delivered_qty: number; warehouse_id: string }[];
}

export default function DeliveryNoteDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id));
  const [dn, setDn] = useState<DeliveryNoteWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);

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

  const runAction = async (action: 'confirm_pick' | 'complete_pack' | 'good_issue' | 'cancel' | 'amend') => {
    if (action === 'cancel' && !confirm(dn?.status === 'Good Issued' ? 'Batalkan delivery ini? Stok yang sudah keluar akan dikembalikan.' : 'Batalkan delivery ini?')) return;
    if (action === 'amend' && !confirm('Kirim ulang delivery ini (buat DN baru)?')) return;
    if (action === 'good_issue' && !confirm('Konfirmasi Good Issue? Stok akan langsung terpotong dan tidak bisa dibatalkan tanpa proses Cancel.')) return;
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
        toast.error(err.error || 'Gagal memproses aksi');
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
        badges={dn && <StatusBadge label={dn.status} tone={STATUS_TONE[dn.status] || 'gray'} />}
        actions={
          dn && (
            <>
              {dn.status === 'Good Issued' && (
                <div className="relative">
                  <Button variant="secondary" onClick={() => setIsPrintMenuOpen((v) => !v)}>
                    <Printer size={14} className="mr-1.5" />Print Surat Jalan<ChevronDown size={14} className="ml-1.5" />
                  </Button>
                  {isPrintMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsPrintMenuOpen(false)} />
                      <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-20">
                        {[
                          { size: 'a4', label: 'A4' },
                          { size: 'f4', label: 'F4' },
                          { size: 'thermal', label: 'Thermal' },
                        ].map((opt) => (
                          <button
                            key={opt.size}
                            onClick={() => {
                              setIsPrintMenuOpen(false);
                              router.push(`/dashboard/delivery-order/delivery-note/${encodeURIComponent(id)}/print?size=${opt.size}`);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {dn.status === 'Unallocated' && (
                <Button variant="secondary" disabled={busy} onClick={() => runAction('confirm_pick')}><ClipboardCheck size={14} className="mr-1.5" />Confirm Pick</Button>
              )}
              {dn.status === 'Pick Confirmed' && (
                <Button variant="secondary" disabled={busy} onClick={() => runAction('complete_pack')}><PackageCheck size={14} className="mr-1.5" />Complete Packing</Button>
              )}
              {dn.status === 'Packing Completed' && (
                <Button variant="primary" disabled={busy} onClick={() => runAction('good_issue')}><Truck size={14} className="mr-1.5" />Good Issue</Button>
              )}
              {dn.status !== 'Cancelled' && (
                <Button variant="danger" disabled={busy} onClick={() => runAction('cancel')}><XCircle size={14} className="mr-1.5" />Cancel</Button>
              )}
              {dn.status === 'Cancelled' && (
                <Button variant="secondary" disabled={busy} onClick={() => runAction('amend')}><History size={14} className="mr-1.5" />Amend</Button>
              )}
            </>
          )
        }
        sidebar={
          dn && (
            <>
              <AssignedToSection doctype="Delivery Note" documentId={dn.dn_id} />
              <DetailSection title="Riwayat">
                <ActivityLogView doctype="Delivery Note" documentId={dn.dn_id} />
                <AttachmentSection doctype="Delivery Note" documentId={dn.dn_id} />
              </DetailSection>
            </>
          )
        }
      >
        {dn && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  {
                    label: 'Customer',
                    value: (
                      <Link href={`/dashboard/sales-order/customer/${encodeURIComponent(dn.customer_id)}`} className="text-primary hover:underline">
                        {dn.customer_name}
                      </Link>
                    ),
                  },
                  {
                    label: 'Sales Order',
                    value: (
                      <Link href={`/dashboard/sales-order/sales-order/${encodeURIComponent(dn.so_id)}`} className="text-primary hover:underline">
                        {dn.so_id}
                      </Link>
                    ),
                  },
                  { label: 'Posting Date', value: formatDate(dn.posting_date) },
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
                  { key: 'item_name', header: 'Item' },
                  { key: 'warehouse_id', header: 'Warehouse' },
                  { key: 'delivered_qty', header: 'Delivered Qty', align: 'right' },
                  { key: 'uom', header: 'Unit' },
                ]}
                rows={dn.items.map((i) => ({
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
                  delivered_qty: i.delivered_qty,
                  uom: i.uom,
                }))}
              />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
