'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { StockEntry, Item, Warehouse, StockEntryType, Bom } from '@/types';
import { Plus, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Layers } from 'lucide-react';

const TYPE_TONE: Record<string, 'green' | 'red' | 'blue' | 'purple'> = {
  'Material Receipt': 'green',
  'Material Issue': 'red',
  'Material Transfer': 'blue',
  'Manufacture': 'purple',
};

const TYPE_ICON: Record<string, React.ElementType> = {
  'Material Receipt': ArrowDownToLine,
  'Material Issue': ArrowUpFromLine,
  'Material Transfer': ArrowLeftRight,
  'Manufacture': Layers,
};

export default function StockEntriesTab() {
  const router = useRouter();
  const [viewMode, setViewMode] = useViewMode('inventory_stock_entries_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('inventory_stock_entries_cols', [
    'entry_id', 'date', 'entry_type', 'item_code', 'source_warehouse', 'target_warehouse', 'qty', 'remarks',
  ]);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    entry_type: 'Material Receipt' as StockEntryType,
    item_code: '',
    source_warehouse: '',
    target_warehouse: '',
    qty: '',
    remarks: '',
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [entriesRes, itemsRes, warehousesRes, bomsRes] = await Promise.all([
        fetch('/api/stock-entries'),
        fetch('/api/items'),
        fetch('/api/warehouses'),
        fetch('/api/boms'),
      ]);
      if (entriesRes.ok) setEntries(await entriesRes.json());
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (warehousesRes.ok) setWarehouses(await warehousesRes.json());
      if (bomsRes.ok) setBoms(await bomsRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openNew = () => {
    setFormData({ entry_type: 'Material Receipt', item_code: '', source_warehouse: '', target_warehouse: '', qty: '', remarks: '' });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const res = await fetch('/api/stock-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, qty: parseFloat(formData.qty) || 0 }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchAll();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan stock entry');
      }
    } catch (error) {
      console.error('Error saving stock entry:', error);
      setError('Gagal menyimpan stock entry');
    } finally {
      setIsSaving(false);
    }
  };

  const itemName = (code: string) => items.find((i) => i.item_code === code)?.item_name || code;
  const warehouseName = (id: string) => warehouses.find((w) => w.warehouse_id === id)?.warehouse_name || id;

  const REPORT_COLUMNS: ReportColumn<StockEntry>[] = [
    { key: 'entry_id', header: 'Entry ID' },
    { key: 'date', header: 'Date' },
    { key: 'entry_type', header: 'Type', render: (r) => <StatusBadge label={r.entry_type} tone={TYPE_TONE[r.entry_type] || 'gray'} /> },
    { key: 'item_code', header: 'Item', render: (r) => itemName(r.item_code), exportValue: (r) => itemName(r.item_code) },
    { key: 'source_warehouse', header: 'Source Warehouse', render: (r) => (r.source_warehouse ? warehouseName(r.source_warehouse) : '-'), exportValue: (r) => (r.source_warehouse ? warehouseName(r.source_warehouse) : '') },
    { key: 'target_warehouse', header: 'Target Warehouse', render: (r) => (r.target_warehouse ? warehouseName(r.target_warehouse) : '-'), exportValue: (r) => (r.target_warehouse ? warehouseName(r.target_warehouse) : '') },
    { key: 'qty', header: 'Qty', align: 'right' },
    { key: 'remarks', header: 'Remarks' },
    { key: 'owner', header: 'Owner' },
  ];

  return (
    <ListViewLayout
      primaryAction={
        <div className="flex items-center gap-2">
          <ReportViewControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            columns={REPORT_COLUMNS}
            visibleColumns={visibleCols}
            onVisibleColumnsChange={setVisibleCols}
            onExport={() => exportToExcel(entries, REPORT_COLUMNS, 'stock_entries', 'Stock Entries')}
          />
          <Button onClick={openNew}>
            <Plus size={14} className="mr-1.5" />
            New Stock Entry
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" />
        </div>
      ) : viewMode === 'report' ? (
        <ReportTable columns={REPORT_COLUMNS} visibleColumns={visibleCols} rows={entries} keyField={(r) => r.entry_id} />
      ) : entries.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No stock entries found</p>
      ) : (
        entries.map((entry) => {
          const Icon = TYPE_ICON[entry.entry_type] || ArrowLeftRight;
          const routeLabel =
            entry.entry_type === 'Material Receipt'
              ? `→ ${warehouseName(entry.target_warehouse)}`
              : entry.entry_type === 'Material Issue'
              ? `${warehouseName(entry.source_warehouse)} →`
              : `${warehouseName(entry.source_warehouse)} → ${warehouseName(entry.target_warehouse)}`;

          return (
            <ListRow
              key={entry.entry_id}
              onClick={() => router.push(`/dashboard/inventory/stock-entry/${encodeURIComponent(entry.entry_id)}`)}
              avatar={
                <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center">
                  <Icon size={14} />
                </span>
              }
              title={itemName(entry.item_code)}
              subtitle={`${routeLabel}${entry.remarks ? ' · ' + entry.remarks : ''}`}
              meta={entry.date}
              badges={
                <>
                  <StatusBadge label={`${entry.qty} qty`} tone="gray" />
                  <StatusBadge label={entry.entry_type} tone={TYPE_TONE[entry.entry_type] || 'gray'} />
                </>
              }
            />
          );
        })
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Stock Entry" size="sm">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label-field">Entry Type</label>
            <select
              value={formData.entry_type}
              onChange={(e) => setFormData({ ...formData, entry_type: e.target.value as StockEntryType })}
              className="input-field"
            >
              <option value="Material Receipt">Material Receipt (barang masuk)</option>
              <option value="Material Issue">Material Issue (barang keluar)</option>
              <option value="Material Transfer">Material Transfer (antar gudang)</option>
              <option value="Manufacture">Manufacture (produksi dari BOM)</option>
            </select>
          </div>

          <div>
            <label className="label-field">{formData.entry_type === 'Manufacture' ? 'Produk (harus punya BOM)' : 'Item'}</label>
            <select
              value={formData.item_code}
              onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
              className="input-field"
              required
            >
              <option value="">Pilih item</option>
              {(formData.entry_type === 'Manufacture' ? items.filter((i) => boms.some((b) => b.item_code === i.item_code && b.is_active)) : items).map((i) => (
                <option key={i.item_code} value={i.item_code}>{i.item_name} ({i.item_code})</option>
              ))}
            </select>
            {formData.entry_type === 'Manufacture' && boms.filter((b) => b.is_active).length === 0 && (
              <p className="text-xs text-orange-500 mt-1">Belum ada BOM aktif. Buat dulu di tab "Product Campuran (BOM)".</p>
            )}
          </div>

          {formData.entry_type === 'Manufacture' && formData.item_code && (() => {
            const bom = boms.find((b) => b.item_code === formData.item_code && b.is_active);
            if (!bom) return null;
            const producedQty = parseFloat(formData.qty) || 0;
            const ratio = producedQty / (bom.qty || 1);
            return (
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-2.5 text-xs space-y-1">
                <p className="font-medium text-gray-700 dark:text-gray-300">Komponen yang akan dipakai (BOM {bom.bom_id}):</p>
                {bom.components.map((c) => (
                  <p key={c.component_item_code} className="text-gray-500 dark:text-gray-400">
                    {c.component_item_name}: {(c.qty * ratio).toLocaleString('id-ID')}
                  </p>
                ))}
              </div>
            );
          })()}

          {(formData.entry_type === 'Material Issue' || formData.entry_type === 'Material Transfer' || formData.entry_type === 'Manufacture') && (
            <div>
              <label className="label-field">{formData.entry_type === 'Manufacture' ? 'Ambil Komponen dari Warehouse' : 'Source Warehouse'}</label>
              <select
                value={formData.source_warehouse}
                onChange={(e) => setFormData({ ...formData, source_warehouse: e.target.value })}
                className="input-field"
                required
              >
                <option value="">Pilih warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>
                ))}
              </select>
            </div>
          )}

          {(formData.entry_type === 'Material Receipt' || formData.entry_type === 'Material Transfer' || formData.entry_type === 'Manufacture') && (
            <div>
              <label className="label-field">Target Warehouse</label>
              <select
                value={formData.target_warehouse}
                onChange={(e) => setFormData({ ...formData, target_warehouse: e.target.value })}
                className="input-field"
                required
              >
                <option value="">Pilih warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label-field">Qty</label>
            <input
              type="number"
              min={0}
              step="any"
              value={formData.qty}
              onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="label-field">Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="input-field"
              rows={2}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>Submit</Button>
          </div>
        </form>
      </Modal>
    </ListViewLayout>
  );
}
