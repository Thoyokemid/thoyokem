'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loading from '@/components/ui/Loading';
import { ListViewLayout, ListRow, ListRowAvatar } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { Truck } from 'lucide-react';
import toast from 'react-hot-toast';

interface SalesOrderWithItems {
  so_id: string;
  customer_id: string;
  customer_name: string;
  status: string;
  approval_status: string;
  total_amount: number;
  items: { item_code: string; qty: number; warehouse_id: string }[];
}

const READY_COLUMNS: ReportColumn<SalesOrderWithItems>[] = [
  { key: 'so_id', header: 'SO ID' },
  { key: 'customer_name', header: 'Customer' },
  { key: 'items', header: 'Items', render: (r) => r.items.length, exportValue: (r) => r.items.length },
  { key: 'total_amount', header: 'Total', align: 'right', render: (r) => r.total_amount.toLocaleString('id-ID') },
];

export default function ReadyToDeliverTab() {
  const router = useRouter();
  const [readyOrders, setReadyOrders] = useState<SalesOrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useViewMode('delivery_ready_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('delivery_ready_cols', READY_COLUMNS.map((c) => c.key));

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const res = await fetch('/api/sales-orders');
      if (res.ok) {
        const orders: SalesOrderWithItems[] = await res.json();
        setReadyOrders(orders.filter((o) => o.status === 'Confirmed' && o.approval_status === 'Approved'));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeliver = async (so_id: string) => {
    if (!confirm(`Mulai proses pengiriman untuk ${so_id}? Stok baru terpotong setelah Good Issue di tahap Pick/Pack.`)) return;
    setBusyId(so_id);
    try {
      const res = await fetch('/api/sales-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ so_id, action: 'deliver' }),
      });
      if (res.ok) {
        fetchAll();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal membuat delivery');
      }
    } catch (error) {
      console.error('Error delivering:', error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ListViewLayout
      primaryAction={
        <ReportViewControls
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          columns={READY_COLUMNS}
          visibleColumns={visibleCols}
          onVisibleColumnsChange={setVisibleCols}
          onExport={() => exportToExcel(readyOrders, READY_COLUMNS, 'ready_to_deliver', 'Ready to Deliver')}
        />
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loading size="lg" /></div>
      ) : viewMode === 'report' ? (
        <ReportTable columns={READY_COLUMNS} visibleColumns={visibleCols} rows={readyOrders} keyField={(r) => r.so_id} />
      ) : readyOrders.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">Tidak ada SO yang siap dikirim</p>
      ) : (
        readyOrders.map((so) => (
          <ListRow
            key={so.so_id}
            onClick={() => router.push(`/dashboard/sales-order/sales-order/${encodeURIComponent(so.so_id)}`)}
            avatar={<ListRowAvatar initials="SO" />}
            title={so.so_id}
            subtitle={`${so.customer_name} · ${so.items.length} item`}
            meta={`Rp${so.total_amount.toLocaleString('id-ID')}`}
            actions={
              <button
                disabled={busyId === so.so_id}
                onClick={() => handleDeliver(so.so_id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary-600 disabled:opacity-40"
              >
                <Truck size={12} /> Deliver
              </button>
            }
          />
        ))
      )}
    </ListViewLayout>
  );
}
