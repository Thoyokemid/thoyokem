"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";
import { ListViewLayout, ListRow, ListRowAvatar, StatusBadge } from "@/components/ui/ListView";
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from "@/components/ui/ReportView";
import { AlertCircle, Truck, PackageCheck } from "lucide-react";

interface SalesOrderWithItems {
  so_id: string;
  customer_id: string;
  customer_name: string;
  status: string;
  approval_status: string;
  total_amount: number;
  items: { item_code: string; qty: number; warehouse_id: string }[];
}

interface DeliveryNoteWithItems {
  dn_id: string;
  so_id: string;
  customer_id: string;
  customer_name: string;
  posting_date: string;
  status: string;
  items: { item_code: string; delivered_qty: number; warehouse_id: string }[];
}

const READY_COLUMNS: ReportColumn<SalesOrderWithItems>[] = [
  { key: 'so_id', header: 'SO ID' },
  { key: 'customer_name', header: 'Customer' },
  { key: 'items', header: 'Items', render: (r) => r.items.length, exportValue: (r) => r.items.length },
  { key: 'total_amount', header: 'Total', align: 'right', render: (r) => r.total_amount.toLocaleString('id-ID') },
];
const HISTORY_COLUMNS: ReportColumn<DeliveryNoteWithItems>[] = [
  { key: 'dn_id', header: 'DN ID' },
  { key: 'so_id', header: 'SO' },
  { key: 'customer_name', header: 'Customer' },
  { key: 'posting_date', header: 'Posting Date' },
  { key: 'items', header: 'Items', render: (r) => r.items.length, exportValue: (r) => r.items.length },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge label={r.status} tone="green" /> },
];

export default function DeliveryOrderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [readyOrders, setReadyOrders] = useState<SalesOrderWithItems[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryNoteWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [readyViewMode, setReadyViewMode] = useViewMode('delivery_ready_view');
  const [readyVisibleCols, setReadyVisibleCols] = useVisibleColumns('delivery_ready_cols', READY_COLUMNS.map((c) => c.key));
  const [historyViewMode, setHistoryViewMode] = useViewMode('delivery_history_view');
  const [historyVisibleCols, setHistoryVisibleCols] = useVisibleColumns('delivery_history_cols', HISTORY_COLUMNS.map((c) => c.key));

  useEffect(() => {
    if (session?.user.permissions.delivery_order) fetchAll();
    else setIsLoading(false);
  }, [session]);

  const fetchAll = async () => {
    try {
      const [soRes, dnRes] = await Promise.all([fetch('/api/sales-orders'), fetch('/api/delivery-notes')]);
      if (soRes.ok) {
        const orders: SalesOrderWithItems[] = await soRes.json();
        setReadyOrders(orders.filter((o) => o.status === 'Confirmed' && o.approval_status === 'Approved'));
      }
      if (dnRes.ok) setDeliveries(await dnRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeliver = async (so_id: string) => {
    if (!confirm(`Kirim semua item untuk ${so_id}? Ini akan mengurangi stok.`)) return;
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
        alert(err.error || 'Gagal membuat delivery');
      }
    } catch (error) {
      console.error('Error delivering:', error);
    } finally {
      setBusyId(null);
    }
  };

  if (status !== "loading" && !session) redirect("/login");
  if (status === "loading") return null;
  if (!session) return null;

  if (!session.user.permissions.delivery_order) {
    return (
      <DashboardLayout
        user={{
          id: session.user.id,
          username: session.user.email || "",
          name: session.user.name ?? "",
          role: session.user.role,
          permissions: session.user.permissions,
        }}
      >
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
    <DashboardLayout
      user={{
        id: session.user.id,
        username: session.user.email || "",
        name: session.user.name ?? "",
        role: session.user.role,
        permissions: session.user.permissions,
      }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Delivery Order</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Kirim sales order yang sudah dikonfirmasi</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loading size="lg" /></div>
        ) : (
          <>
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ready to Deliver ({readyOrders.length})</h2>
              <ListViewLayout
                primaryAction={
                  <ReportViewControls
                    viewMode={readyViewMode}
                    onViewModeChange={setReadyViewMode}
                    columns={READY_COLUMNS}
                    visibleColumns={readyVisibleCols}
                    onVisibleColumnsChange={setReadyVisibleCols}
                    onExport={() => exportToExcel(readyOrders, READY_COLUMNS, 'ready_to_deliver', 'Ready to Deliver')}
                  />
                }
              >
                {readyViewMode === 'report' ? (
                  <ReportTable columns={READY_COLUMNS} visibleColumns={readyVisibleCols} rows={readyOrders} keyField={(r) => r.so_id} />
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
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Delivery History ({deliveries.length})</h2>
              <ListViewLayout
                primaryAction={
                  <ReportViewControls
                    viewMode={historyViewMode}
                    onViewModeChange={setHistoryViewMode}
                    columns={HISTORY_COLUMNS}
                    visibleColumns={historyVisibleCols}
                    onVisibleColumnsChange={setHistoryVisibleCols}
                    onExport={() => exportToExcel(deliveries, HISTORY_COLUMNS, 'delivery_history', 'Delivery History')}
                  />
                }
              >
                {historyViewMode === 'report' ? (
                  <ReportTable columns={HISTORY_COLUMNS} visibleColumns={historyVisibleCols} rows={deliveries} keyField={(r) => r.dn_id} />
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
                      badges={<StatusBadge label={dn.status} tone="green" />}
                    />
                  ))
                )}
              </ListViewLayout>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
