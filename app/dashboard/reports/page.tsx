'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Loading from '@/components/ui/Loading';
import { OverflowMenu, OverflowMenuColumns } from '@/components/ui/ListView';
import { ReportTable, ReportColumn, exportToExcel } from '@/components/ui/ReportView';
import { BarChart3, Search, Download, Columns3 } from 'lucide-react';

type PermKey = 'inventory' | 'purchasing' | 'sales_order' | 'staff' | 'leave';

interface DataSource {
  key: string;
  label: string;
  endpoint: string;
  idKey: string;
  /** Module permission gating access to this data source. */
  permKey: PermKey;
}

const DATA_SOURCES: DataSource[] = [
  { key: 'items', label: 'Item', endpoint: '/api/items', idKey: 'item_code', permKey: 'inventory' },
  { key: 'warehouses', label: 'Warehouse', endpoint: '/api/warehouses', idKey: 'warehouse_id', permKey: 'inventory' },
  { key: 'customers', label: 'Customer', endpoint: '/api/customers', idKey: 'customer_id', permKey: 'sales_order' },
  { key: 'suppliers', label: 'Supplier', endpoint: '/api/suppliers', idKey: 'supplier_id', permKey: 'purchasing' },
  { key: 'purchase-orders', label: 'Purchase Order', endpoint: '/api/purchase-orders', idKey: 'po_id', permKey: 'purchasing' },
  { key: 'sales-orders', label: 'Sales Order', endpoint: '/api/sales-orders', idKey: 'so_id', permKey: 'sales_order' },
  { key: 'staff', label: 'Staff', endpoint: '/api/staff', idKey: 'employee_id', permKey: 'staff' },
  { key: 'leave', label: 'Leave', endpoint: '/api/leave', idKey: 'id', permKey: 'leave' },
];

/** Field keys that are arrays/objects (line items, nested records) — not meaningful as flat report columns. */
function isScalar(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const [activeSource, setActiveSource] = useState(DATA_SOURCES[0].key);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCols, setVisibleCols] = useState<string[]>([]);

  const source = DATA_SOURCES.find((s) => s.key === activeSource) || DATA_SOURCES[0];
  const permissions = session?.user.permissions;
  const accessibleSources = DATA_SOURCES.filter((s) => permissions?.[s.permKey]);

  useEffect(() => {
    if (accessibleSources.length > 0 && !accessibleSources.some((s) => s.key === activeSource)) {
      setActiveSource(accessibleSources[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessibleSources.length]);

  useEffect(() => {
    setIsLoading(true);
    setSearchTerm('');
    fetch(source.endpoint)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Record<string, unknown>[]) => {
        setRows(Array.isArray(data) ? data : []);
        const cols = data.length > 0 ? Object.keys(data[0]).filter((k) => isScalar(data[0][k])) : [];
        setVisibleCols(cols);
      })
      .catch(() => {
        setRows([]);
        setVisibleCols([]);
      })
      .finally(() => setIsLoading(false));
  }, [source.endpoint]);

  const columns: ReportColumn<Record<string, unknown>>[] = useMemo(() => {
    const keys = rows.length > 0 ? Object.keys(rows[0]).filter((k) => isScalar(rows[0][k])) : [];
    return keys.map((key) => ({
      key,
      header: humanizeKey(key),
      align: typeof rows[0]?.[key] === 'number' ? 'right' : 'left',
      render: (r) => {
        const v = r[key];
        if (v === null || v === undefined || v === '') return '-';
        if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
        if (typeof v === 'number') return v.toLocaleString('id-ID');
        return String(v);
      },
    }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter((r) => visibleCols.some((k) => String(r[k] ?? '').toLowerCase().includes(q)));
  }, [rows, searchTerm, visibleCols]);

  if (status !== 'loading' && !session) redirect('/login');
  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen"><Loading size="lg" /></div>;
  if (!session) return null;

  const layoutUser = {
    id: session.user.id,
    username: session.user.email || '',
    name: session.user.name ?? '',
    role: session.user.role,
    permissions: session.user.permissions,
  };

  return (
    <DashboardLayout user={layoutUser}>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={22} className="text-primary" />
            Report Builder
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Pilih data, atur kolom yang mau ditampilkan, filter, lalu export ke Excel.
          </p>
        </div>

        {accessibleSources.length === 0 ? (
          <div className="card p-6 text-center text-sm text-gray-500">Tidak ada data yang bisa diakses.</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {accessibleSources.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActiveSource(s.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    s.key === activeSource
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-2.5 flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="text"
                  placeholder={`Cari di kolom yang tampil...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <OverflowMenu>
                  <OverflowMenuColumns columns={columns} visible={visibleCols} onChange={setVisibleCols} />
                </OverflowMenu>
                <button
                  onClick={() => exportToExcel(filteredRows, columns, source.key, source.label)}
                  disabled={filteredRows.length === 0}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
                >
                  <Download size={14} /> Export
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loading size="lg" /></div>
              ) : filteredRows.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-500">Tidak ada data</p>
              ) : (
                <ReportTable columns={columns} visibleColumns={visibleCols} rows={filteredRows} keyField={(r) => String(r[source.idKey])} />
              )}
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Columns3 size={12} /> {filteredRows.length} baris · {visibleCols.length} dari {columns.length} kolom ditampilkan
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
