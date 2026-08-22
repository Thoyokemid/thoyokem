'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import { SkeletonList } from '@/components/ui/Skeleton';
import { ListRow, StatusBadge } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { StockBalance } from '@/types';
import { Search, Boxes } from 'lucide-react';

const REPORT_COLUMNS: ReportColumn<StockBalance>[] = [
  { key: 'item_name', header: 'Item' },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'qty_on_hand', header: 'Qty on Hand', align: 'right' },
  { key: 'valuation_rate', header: 'Valuation Rate', align: 'right', render: (r) => r.valuation_rate.toLocaleString('id-ID') },
  { key: 'stock_value', header: 'Stock Value', align: 'right', render: (r) => r.stock_value.toLocaleString('id-ID') },
  { key: 'last_transaction_date', header: 'Last Transaction' },
];
const DEFAULT_VISIBLE = REPORT_COLUMNS.map((c) => c.key);

export default function StockBalanceTab() {
  const router = useRouter();
  const [viewMode, setViewMode] = useViewMode('inventory_stock_balance_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('inventory_stock_balance_cols', DEFAULT_VISIBLE);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const res = await fetch('/api/stock-balance');
      if (res.ok) setBalances(await res.json());
    } catch (error) {
      console.error('Error fetching stock balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return balances;
    const q = searchTerm.toLowerCase();
    return balances.filter((b) => b.item_name.toLowerCase().includes(q) || b.item_code.toLowerCase().includes(q));
  }, [balances, searchTerm]);

  const totalValue = filtered.reduce((sum, b) => sum + b.stock_value, 0);

  if (isLoading) {
    return (
      <Card>
        <SkeletonList />
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
              placeholder="Cari item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <ReportViewControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            columns={REPORT_COLUMNS}
            visibleColumns={visibleCols}
            onVisibleColumnsChange={setVisibleCols}
            onExport={() => exportToExcel(filtered, REPORT_COLUMNS, 'stock_balance', 'Stock Balance')}
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Total nilai stok: <span className="font-semibold text-gray-900 dark:text-gray-100">Rp{totalValue.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </Card>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {viewMode === 'report' ? (
          <ReportTable columns={REPORT_COLUMNS} visibleColumns={visibleCols} rows={filtered} keyField={(r) => `${r.item_code}::${r.warehouse_id}`} />
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">No stock data available</p>
        ) : (
          filtered.map((b) => (
            <ListRow
              key={`${b.item_code}::${b.warehouse_id}`}
              onClick={() => router.push(`/dashboard/inventory/item/${encodeURIComponent(b.item_code)}`)}
              avatar={
                <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center">
                  <Boxes size={14} />
                </span>
              }
              title={b.item_name}
              subtitle={b.warehouse_id}
              meta={`Rp${b.stock_value.toLocaleString('id-ID')}`}
              badges={
                <>
                  <StatusBadge label={`${b.qty_on_hand.toLocaleString('id-ID')} qty`} tone="gray" />
                  {b.qty_on_hand <= 0 && <StatusBadge label="Habis" tone="red" />}
                </>
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
