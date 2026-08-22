'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { SkeletonList } from '@/components/ui/Skeleton';
import BulkImportModal, { ImportColumn } from '@/components/ui/BulkImportModal';
import { ListViewLayout, ListRow, StatusBadge, ListSelectionBar } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { Item } from '@/types';
import { itemImportRowSchema, itemCreateSchema } from '@/lib/validation';
import { fetchUsdIdrRate, toIDR } from '@/lib/currency';
import { Plus, Edit, Trash2, Search, Package, RefreshCw, Upload, Ban, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const itemFormSchema = itemCreateSchema.extend({
  item_name: z.string().min(1, 'Nama item wajib diisi'),
});
type ItemFormInput = z.input<typeof itemFormSchema>;
type ItemFormValues = z.output<typeof itemFormSchema>;

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'item_code', label: 'Item Code (kosongkan untuk auto)', example: '' },
  { key: 'item_name', label: 'Nama Item', example: 'Contoh Item', required: true },
  { key: 'item_group', label: 'Group (Liquid/Non-Liquid)', example: 'Non-Liquid' },
  { key: 'unit', label: 'Unit (PCS/KG/G/L/M)', example: 'PCS' },
  { key: 'purchase_price', label: 'Harga Beli', example: '10000' },
  { key: 'selling_price', label: 'Harga Jual', example: '15000' },
  { key: 'reorder_level', label: 'Reorder Level', example: '10' },
  { key: 'valuation_method', label: 'Valuation Method (Average/FIFO)', example: 'Average' },
  { key: 'opening_qty', label: 'Opening Qty', example: '0' },
  { key: 'opening_valuation_rate', label: 'Opening Valuation Rate', example: '0' },
  { key: 'currency', label: 'Currency (IDR/USD)', example: 'IDR' },
  { key: 'item_type', label: 'Item Type (Trading/Regular)', example: 'Regular' },
];

const ITEM_GROUPS = ['Liquid', 'Non-Liquid'];
const ITEM_UNITS = ['PCS', 'KG', 'G', 'L', 'M'];

// TY + L/NL + random alphanumeric, always exactly 10 chars, no separators.
function generateItemCode(group: string): string {
  const prefix = `TY${group === 'Liquid' ? 'L' : 'NL'}`;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 10 - prefix.length; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix + random;
}

const REPORT_COLUMNS: ReportColumn<Item>[] = [
  { key: 'item_code', header: 'Item Code' },
  { key: 'item_name', header: 'Item Name' },
  { key: 'item_group', header: 'Group' },
  { key: 'item_type', header: 'Type' },
  { key: 'unit', header: 'Unit' },
  { key: 'currency', header: 'Currency' },
  { key: 'purchase_price', header: 'Purchase Price', align: 'right', render: (r) => r.purchase_price.toLocaleString('id-ID') },
  { key: 'selling_price', header: 'Selling Price', align: 'right', render: (r) => r.selling_price.toLocaleString('id-ID') },
  { key: 'reorder_level', header: 'Reorder Level', align: 'right' },
  { key: 'valuation_method', header: 'Valuation Method' },
  { key: 'is_active', header: 'Status', render: (r) => <StatusBadge label={r.is_active ? 'Active' : 'Inactive'} tone={r.is_active ? 'green' : 'gray'} />, exportValue: (r) => (r.is_active ? 'Active' : 'Inactive') },
];
const DEFAULT_VISIBLE = REPORT_COLUMNS.map((c) => c.key);

function UsdConversionHint({ purchasePrice, sellingPrice }: { purchasePrice: number; sellingPrice: number }) {
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    fetchUsdIdrRate().then(setRate);
  }, []);

  if (rate === null) return null;
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
      Kurs saat ini: $1 = Rp{rate.toLocaleString('id-ID')} · ≈ Rp{toIDR(purchasePrice, 'USD', rate).toLocaleString('id-ID')} (beli) / Rp{toIDR(sellingPrice, 'USD', rate).toLocaleString('id-ID')} (jual)
    </p>
  );
}

export default function ItemsTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openNew();
      const params = new URLSearchParams(searchParams.toString());
      params.delete('new');
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const { data: session } = useSession();
  const isSuperAdmin = !!session?.user.isSuperAdmin;
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useViewMode('inventory_items_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('inventory_items_cols', DEFAULT_VISIBLE);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const res = await fetch('/api/items');
      if (!res.ok) throw new Error('Failed to fetch items');
      return (await res.json()) as Item[];
    },
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  const {
    register,
    handleSubmit: handleFormSubmit,
    reset: resetForm,
    watch,
    setValue,
    formState: { errors: formErrors },
  } = useForm<ItemFormInput, any, ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      item_code: generateItemCode('Liquid'),
      item_name: '',
      item_group: 'Liquid',
      unit: 'PCS',
      purchase_price: 0,
      selling_price: 0,
      reorder_level: 0,
      valuation_method: 'Average',
      currency: 'IDR',
      item_type: 'Regular',
    },
  });
  const watchedItemGroup = watch('item_group');
  const watchedCurrency = watch('currency');
  const watchedPurchasePrice = watch('purchase_price');
  const watchedSellingPrice = watch('selling_price');

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(
      (i) => i.item_name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q)
    );
  }, [items, searchTerm]);

  // Bulk actions must only ever touch rows currently visible under the search filter —
  // otherwise "N dipilih" can silently include hidden rows the user can no longer see.
  const visibleSelectedIds = useMemo(
    () => new Set(filteredItems.filter((i) => selectedIds.has(i.item_code)).map((i) => i.item_code)),
    [filteredItems, selectedIds]
  );

  const openNew = () => {
    setEditingItem(null);
    resetForm({
      item_code: generateItemCode('Liquid'),
      item_name: '',
      item_group: 'Liquid',
      unit: 'PCS',
      purchase_price: 0,
      selling_price: 0,
      reorder_level: 0,
      valuation_method: 'Average',
      currency: 'IDR',
      item_type: 'Regular',
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleGroupChange = (group: string) => {
    setValue('item_group', group);
    if (!editingItem) setValue('item_code', generateItemCode(group));
  };

  const regenerateCode = () => {
    setValue('item_code', generateItemCode(watchedItemGroup || 'Liquid'));
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    resetForm({
      item_code: item.item_code,
      item_name: item.item_name,
      item_group: item.item_group,
      unit: item.unit,
      purchase_price: item.purchase_price,
      selling_price: item.selling_price,
      reorder_level: item.reorder_level,
      valuation_method: item.valuation_method,
      currency: item.currency || 'IDR',
      item_type: item.item_type || 'Regular',
    });
    setError('');
    setIsModalOpen(true);
  };

  const onSubmit = async (data: ItemFormValues) => {
    setIsSaving(true);
    setError('');
    try {
      const res = editingItem
        ? await fetch('/api/items', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        : await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

      if (res.ok) {
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['items'] });
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan item');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setError('Gagal menyimpan item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (itemCode: string) => {
    if (!confirm('Hapus item ini?')) return;
    const removed = queryClient.getQueryData<Item[]>(['items'])?.find((i) => i.item_code === itemCode);
    queryClient.setQueryData<Item[]>(['items'], (old) => (old ?? []).filter((i) => i.item_code !== itemCode));
    const restore = () => {
      if (!removed) return;
      queryClient.setQueryData<Item[]>(['items'], (old) =>
        (old ?? []).some((i) => i.item_code === itemCode) ? old! : [...(old ?? []), removed]
      );
    };
    try {
      const res = await fetch(`/api/items?item_code=${itemCode}`, { method: 'DELETE' });
      if (!res.ok) {
        restore();
        toast.error('Gagal menghapus item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      restore();
      toast.error('Gagal menghapus item');
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkDeactivate = async () => {
    if (!confirm(`Nonaktifkan ${visibleSelectedIds.size} item terpilih?`)) return;
    setIsBulkBusy(true);
    try {
      const results = await Promise.all(
        Array.from(visibleSelectedIds).map((id) =>
          fetch('/api/items', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_code: id, is_active: false }),
          })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      toast[failed > 0 ? 'error' : 'success'](
        failed > 0 ? `${failed} dari ${visibleSelectedIds.size} gagal dinonaktifkan` : `${visibleSelectedIds.size} item dinonaktifkan`
      );
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['items'] });
    } catch (error) {
      console.error('Error bulk-deactivating items:', error);
      toast.error('Gagal menonaktifkan item terpilih');
    } finally {
      setIsBulkBusy(false);
    }
  };

  const handleBulkExport = () => {
    const rows = filteredItems.filter((i) => visibleSelectedIds.has(i.item_code));
    exportToExcel(rows, REPORT_COLUMNS, 'items_selected', 'Items');
  };

  return (
    <ListViewLayout
      primaryAction={
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Button variant="secondary" onClick={() => setIsImportOpen(true)}>
              <Upload size={14} className="mr-1.5" />
              Import
            </Button>
          )}
          <Button onClick={openNew}>
            <Plus size={14} className="mr-1.5" />
            Add Item
          </Button>
        </div>
      }
      toolbar={
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Cari nama atau kode item..."
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
            onExport={() => exportToExcel(filteredItems, REPORT_COLUMNS, 'items', 'Items')}
          />
        </div>
      }
    >
      {viewMode === 'list' && (
        <ListSelectionBar
          count={visibleSelectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          actions={[
            { label: 'Export', icon: Download, onClick: handleBulkExport },
            { label: 'Nonaktifkan', icon: Ban, variant: 'danger', disabled: isBulkBusy, onClick: handleBulkDeactivate },
          ]}
        />
      )}
      {isLoading ? (
        <SkeletonList />
      ) : viewMode === 'report' ? (
        <ReportTable columns={REPORT_COLUMNS} visibleColumns={visibleCols} rows={filteredItems} keyField={(r) => r.item_code} />
      ) : filteredItems.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No items found</p>
      ) : (
        filteredItems.map((item) => (
          <ListRow
            key={item.item_code}
            onClick={() => router.push(`/dashboard/inventory/item/${encodeURIComponent(item.item_code)}`)}
            avatar={
              <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center">
                <Package size={14} />
              </span>
            }
            title={item.item_name}
            statusTone={item.is_active ? 'green' : 'red'}
            subtitle={`${item.item_code} · ${item.item_group || '-'} · ${item.unit || '-'}`}
            meta={`Jual: ${item.currency === 'USD' ? '$' : 'Rp'}${item.selling_price.toLocaleString('id-ID')}`}
            selected={selectedIds.has(item.item_code)}
            onSelectChange={(checked) => toggleSelect(item.item_code, checked)}
            badges={
              <>
                <StatusBadge label={item.item_type} tone={item.item_type === 'Trading' ? 'purple' : 'blue'} />
                {!item.is_active && <StatusBadge label="Inactive" tone="red" />}
              </>
            }
            actions={
              <>
                <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                  <Edit size={14} />
                </button>
                <button onClick={() => handleDelete(item.item_code)} className="text-red-600 hover:text-red-800 dark:text-red-400">
                  <Trash2 size={14} />
                </button>
              </>
            }
          />
        ))
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Item' : 'Add Item'} size="sm">
        <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="label-field">Item Code</label>
            <div className="relative">
              <input
                type="text"
                {...register('item_code')}
                className="input-field pr-8 font-mono"
                disabled
              />
              {!editingItem && (
                <button
                  type="button"
                  onClick={regenerateCode}
                  title="Generate ulang kode"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary"
                >
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Auto-generate: TY + L/NL + kode acak, 10 karakter</p>
          </div>
          <div>
            <label className="label-field">Item Name</label>
            <input type="text" {...register('item_name')} className="input-field" />
            {formErrors.item_name && <p className="text-xs text-red-600 mt-1">{formErrors.item_name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Group</label>
              <select value={watchedItemGroup ?? ''} onChange={(e) => handleGroupChange(e.target.value)} className="input-field">
                {ITEM_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Unit</label>
              <select {...register('unit')} className="input-field">
                {ITEM_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-field">Currency</label>
              <select {...register('currency')} className="input-field">
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="label-field">Purchase Price</label>
              <input type="number" min={0} {...register('purchase_price')} className="input-field" />
            </div>
            <div>
              <label className="label-field">Selling Price</label>
              <input type="number" min={0} {...register('selling_price')} className="input-field" />
            </div>
          </div>
          {watchedCurrency === 'USD' && (parseFloat(String(watchedPurchasePrice)) > 0 || parseFloat(String(watchedSellingPrice)) > 0) && (
            <UsdConversionHint purchasePrice={parseFloat(String(watchedPurchasePrice)) || 0} sellingPrice={parseFloat(String(watchedSellingPrice)) || 0} />
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-field">Item Type</label>
              <select {...register('item_type')} className="input-field">
                <option value="Regular">Regular</option>
                <option value="Trading">Trading</option>
              </select>
            </div>
            <div>
              <label className="label-field">Reorder Level</label>
              <input type="number" min={0} {...register('reorder_level')} className="input-field" />
            </div>
            <div>
              <label className="label-field">Valuation Method</label>
              <select {...register('valuation_method')} className="input-field">
                <option value="Average">Average</option>
                <option value="FIFO">FIFO</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>{editingItem ? 'Update' : 'Add'} Item</Button>
          </div>
        </form>
      </Modal>

      {isSuperAdmin && (
        <BulkImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          title="Import Item"
          columns={IMPORT_COLUMNS}
          apiEndpoint="/api/items/import"
          templateFilename="template_item"
          onImported={() => queryClient.invalidateQueries({ queryKey: ['items'] })}
          rowSchema={itemImportRowSchema}
        />
      )}
    </ListViewLayout>
  );
}
