'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loading from '@/components/ui/Loading';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { PackageCheck } from 'lucide-react';

interface DeliveryNoteWithItems {
  dn_id: string;
  so_id: string;
  customer_id: string;
  customer_name: string;
  posting_date: string;
  status: string;
  items: { item_code: string; delivered_qty: number; warehouse_id: string }[];
}

const STATUS_TONE: Record<string, 'gray' | 'orange' | 'blue' | 'green' | 'red'> = {
  Unallocated: 'gray',
  'Pick Confirmed': 'orange',
  'Packing Completed': 'blue',
  'Good Issued': 'green',
  Cancelled: 'red',
};

const HISTORY_COLUMNS: ReportColumn<DeliveryNoteWithItems>[] = [
  { key: 'dn_id', header: 'DN ID' },
  { key: 'so_id', header: 'SO' },
  { key: 'customer_name', header: 'Customer' },
  { key: 'posting_date', header: 'Posting Date' },
  { key: 'items', header: 'Items', render: (r) => r.items.length, exportValue: (r) => r.items.length },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge label={r.status} tone={STATUS_TONE[r.status] || 'gray'} /> },
];

export default function DeliveryHistoryTab() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<DeliveryNoteWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useViewMode('delivery_history_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('delivery_history_cols', HISTORY_COLUMNS.map((c) => c.key));

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const res = await fetch('/api/delivery-notes');
      if (res.ok) setDeliveries(await res.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ListViewLayout
      primaryAction={
        <ReportViewControls
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          columns={HISTORY_COLUMNS}
          visibleColumns={visibleCols}
          onVisibleColumnsChange={setVisibleCols}
          onExport={() => exportToExcel(deliveries, HISTORY_COLUMNS, 'delivery_history', 'Delivery History')}
        />
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loading size="lg" /></div>
      ) : viewMode === 'report' ? (
        <ReportTable columns={HISTORY_COLUMNS} visibleColumns={visibleCols} rows={deliveries} keyField={(r) => r.dn_id} />
      ) : deliveries.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">Belum ada pengiriman</p>
      ) : (
        deliveries.map((dn) => (
          <ListRow
            key={dn.dn_id}
            onClick={() => router.push(`/dashboard/delivery-order/delivery-note/${encodeURIComponent(dn.dn_id)}`)}
            avatar={
              <span className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center">
                <PackageCheck size={14} />
              </span>
            }
            title={dn.dn_id}
            subtitle={`${dn.customer_name} · SO ${dn.so_id} · ${dn.items.length} item`}
            meta={dn.posting_date}
            badges={<StatusBadge label={dn.status} tone={STATUS_TONE[dn.status] || 'gray'} />}
          />
        ))
      )}
    </ListViewLayout>
  );
}
