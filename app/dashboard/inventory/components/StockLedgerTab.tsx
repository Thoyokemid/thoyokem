'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import { ListRow, StatusBadge } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { StockLedgerEntry, Item, Warehouse } from '@/types';
import { Search, ArrowLeftRight } from 'lucide-react';
import { formatDate } from '@/lib/date';

// Maps a ledger entry's source voucher to its detail page, when one exists.
// Purchase Receipt and correction entries have no dedicated detail page, so those stay non-clickable.
function voucherRoute(voucherType: string, voucherId: string): string | null {
  if (voucherType === 'Delivery Note' || voucherType === 'Delivery Note Cancellation') {
    return `/dashboard/delivery-order/delivery-note/${encodeURIComponent(voucherId)}`;
  }
  if (voucherType === 'Stock Entry') {
    return `/dashboard/inventory/stock-entry/${encodeURIComponent(voucherId)}`;
  }
  if (voucherType === 'Sales Order Cancellation') {
    return `/dashboard/sales-order/sales-order/${encodeURIComponent(voucherId)}`;
  }
  if (voucherType === 'Purchase Order Cancellation') {
    return `/dashboard/purchasing/purchase-order/${encodeURIComponent(voucherId)}`;
  }
  return null;
}

export default function StockLedgerTab() {
  const router = useRouter();
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [viewMode, setViewMode] = useViewMode('inventory_stock_ledger_view');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [ledgerRes, itemsRes, whRes] = await Promise.all([
        fetch('/api/stock-ledger'),
        fetch('/api/items'),
        fetch('/api/warehouses'),
      ]);
      if (ledgerRes.ok) setLedger(await ledgerRes.json());
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (whRes.ok) setWarehouses(await whRes.json());
    } catch (error) {
      console.error('Error fetching stock ledger:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const itemName = (code: string) => items.find((i) => i.item_code === code)?.item_name || code;
  const warehouseName = (id: string) => warehouses.find((w) => w.warehouse_id === id)?.warehouse_name || id;

  const REPORT_COLUMNS: ReportColumn<StockLedgerEntry>[] = [
    { key: 'posting_date', header: 'Tanggal', render: (r) => formatDate(r.posting_date), exportValue: (r) => formatDate(r.posting_date) },
    { key: 'item_code', header: 'Item', render: (r) => itemName(r.item_code), exportValue: (r) => itemName(r.item_code) },
    { key: 'warehouse_id', header: 'Warehouse', render: (r) => warehouseName(r.warehouse_id), exportValue: (r) => warehouseName(r.warehouse_id) },
    { key: 'voucher_type', header: 'Voucher Type' },
    { key: 'voucher_id', header: 'Voucher ID' },
    {
      key: 'actual_qty',
      header: 'Qty In/Out',
      align: 'right',
      render: (r) => (
        <span className={r.actual_qty >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          {r.actual_qty >= 0 ? '+' : ''}{r.actual_qty.toLocaleString('id-ID')}
        </span>
      ),
    },
    { key: 'valuation_rate', header: 'Valuation Rate', align: 'right', render: (r) => r.valuation_rate.toLocaleString('id-ID') },
    { key: 'qty_after_transaction', header: 'Saldo Qty', align: 'right' },
    { key: 'stock_value', header: 'Nilai Stok', align: 'right', render: (r) => r.stock_value.toLocaleString('id-ID') },
  ];
  const DEFAULT_VISIBLE = REPORT_COLUMNS.map((c) => c.key);
  const [visibleCols, setVisibleCols] = useVisibleColumns('inventory_stock_ledger_cols', DEFAULT_VISIBLE);

  const filtered = useMemo(() => {
    let rows = [...ledger].sort((a, b) => Number(b.entry_id) - Number(a.entry_id));
    if (warehouseFilter) rows = rows.filter((r) => r.warehouse_id === warehouseFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(
        (r) => itemName(r.item_code).toLowerCase().includes(q) || r.item_code.toLowerCase().includes(q) || r.voucher_id.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [ledger, searchTerm, warehouseFilter, items]);

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Cari item atau nomor voucher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className="input-field md:w-48">
            <option value="">Semua warehouse</option>
            {warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>
            ))}
          </select>
          <ReportViewControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            columns={REPORT_COLUMNS}
            visibleColumns={visibleCols}
            onVisibleColumnsChange={setVisibleCols}
            onExport={() => exportToExcel(filtered, REPORT_COLUMNS, 'stock_ledger', 'Stock Ledger')}
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {filtered.length} pergerakan
          </div>
        </div>
      </Card>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {viewMode === 'report' ? (
          <ReportTable columns={REPORT_COLUMNS} visibleColumns={visibleCols} rows={filtered} keyField={(r) => r.entry_id} />
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">Belum ada pergerakan stok</p>
        ) : (
          filtered.map((r) => (
            <ListRow
              key={r.entry_id}
              onClick={(() => {
                const route = voucherRoute(r.voucher_type, r.voucher_id);
                return route ? () => router.push(route) : undefined;
              })()}
              avatar={
                <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center">
                  <ArrowLeftRight size={14} />
                </span>
              }
              title={itemName(r.item_code)}
              subtitle={`${warehouseName(r.warehouse_id)} · ${r.voucher_type} ${r.voucher_id}`}
              meta={formatDate(r.posting_date)}
              badges={
                <>
                  <StatusBadge
                    label={`${r.actual_qty >= 0 ? '+' : ''}${r.actual_qty.toLocaleString('id-ID')}`}
                    tone={r.actual_qty >= 0 ? 'green' : 'red'}
                  />
                  <StatusBadge label={`Saldo ${r.qty_after_transaction.toLocaleString('id-ID')}`} tone="gray" />
                </>
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
