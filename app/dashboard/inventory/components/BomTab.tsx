'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { SkeletonList } from '@/components/ui/Skeleton';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { Bom, Item } from '@/types';
import { Plus, Trash2, Layers } from 'lucide-react';

const bomFormSchema = z.object({
  item_code: z.string().min(1, 'Produk wajib dipilih'),
  output_qty: z.coerce.number().gt(0, 'Qty output wajib diisi'),
  components: z
    .array(
      z.object({
        component_item_code: z.string().min(1, 'Item komponen wajib dipilih'),
        qty: z.coerce.number().gt(0, 'Qty wajib diisi'),
      })
    )
    .min(1, 'Minimal 1 komponen'),
});
type BomFormInput = z.input<typeof bomFormSchema>;
type BomFormValues = z.output<typeof bomFormSchema>;

const REPORT_COLUMNS: ReportColumn<Bom>[] = [
  { key: 'bom_id', header: 'BOM ID' },
  { key: 'item_name', header: 'Produk' },
  { key: 'qty', header: 'Output Qty', align: 'right' },
  {
    key: 'components',
    header: 'Komponen',
    render: (r) => r.components.map((c) => `${c.component_item_name} x${c.qty}`).join(', '),
    exportValue: (r) => r.components.map((c) => `${c.component_item_name} x${c.qty}`).join(', '),
  },
  { key: 'is_active', header: 'Status', render: (r) => <StatusBadge label={r.is_active ? 'Active' : 'Inactive'} tone={r.is_active ? 'green' : 'gray'} />, exportValue: (r) => (r.is_active ? 'Active' : 'Inactive') },
  { key: 'owner', header: 'Owner' },
];
const DEFAULT_VISIBLE = REPORT_COLUMNS.map((c) => c.key);

export default function BomTab() {
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
  const [viewMode, setViewMode] = useViewMode('inventory_bom_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('inventory_bom_cols', DEFAULT_VISIBLE);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    control,
    handleSubmit: handleFormSubmit,
    reset: resetForm,
    formState: { errors: formErrors },
  } = useForm<BomFormInput, any, BomFormValues>({
    resolver: zodResolver(bomFormSchema),
    defaultValues: { item_code: '', output_qty: 1, components: [{ component_item_code: '', qty: 0 }] },
  });
  const { fields: componentFields, append: appendComponent, remove: removeComponentField } = useFieldArray({ control, name: 'components' });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [bomsRes, itemsRes] = await Promise.all([fetch('/api/boms'), fetch('/api/items')]);
      if (bomsRes.ok) setBoms(await bomsRes.json());
      if (itemsRes.ok) setItems(await itemsRes.json());
    } catch (error) {
      console.error('Error fetching BOMs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openNew = () => {
    resetForm({ item_code: '', output_qty: 1, components: [{ component_item_code: '', qty: 0 }] });
    setError('');
    setIsModalOpen(true);
  };

  const onSubmit = async (data: BomFormValues) => {
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        item_code: data.item_code,
        qty: data.output_qty,
        components: data.components.map((c) => ({ component_item_code: c.component_item_code, qty: c.qty })),
      };
      const res = await fetch('/api/boms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        setIsModalOpen(false);
        fetchAll();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal membuat BOM');
      }
    } catch (error) {
      console.error('Error creating BOM:', error);
      setError('Gagal membuat BOM');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (bomId: string) => {
    if (!confirm('Hapus BOM ini?')) return;
    try {
      const res = await fetch(`/api/boms?bom_id=${bomId}`, { method: 'DELETE' });
      if (res.ok) fetchAll();
    } catch (error) {
      console.error('Error deleting BOM:', error);
    }
  };

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
            onExport={() => exportToExcel(boms, REPORT_COLUMNS, 'bom', 'BOM')}
          />
          <Button onClick={openNew}><Plus size={14} className="mr-1.5" />New BOM</Button>
        </div>
      }
    >
      <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
        BOM (Bill of Materials) mendefinisikan produk yang merupakan campuran/rakitan dari beberapa item lain. Produksinya lewat Stock Entries → tipe "Manufacture".
      </div>
      {isLoading ? (
        <SkeletonList />
      ) : viewMode === 'report' ? (
        <ReportTable columns={REPORT_COLUMNS} visibleColumns={visibleCols} rows={boms} keyField={(r) => r.bom_id} />
      ) : boms.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">Belum ada BOM. Buat BOM untuk produk campuran.</p>
      ) : (
        boms.map((b) => (
          <ListRow
            key={b.bom_id}
            onClick={() => router.push(`/dashboard/inventory/bom/${encodeURIComponent(b.bom_id)}`)}
            avatar={<span className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center"><Layers size={14} /></span>}
            title={b.item_name || b.item_code}
            statusTone={b.is_active ? 'green' : 'gray'}
            subtitle={`${b.bom_id} · Output ${b.qty} · ${b.components.length} komponen`}
            meta={b.components.map((c) => `${c.component_item_name} x${c.qty}`).join(', ')}
            badges={<StatusBadge label={b.is_active ? 'Active' : 'Inactive'} tone={b.is_active ? 'green' : 'gray'} />}
            actions={
              <button onClick={() => handleDelete(b.bom_id)} className="text-red-600 hover:text-red-800 dark:text-red-400"><Trash2 size={14} /></button>
            }
          />
        ))
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New BOM (Produk Campuran)" size="lg">
        <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Produk Hasil Campuran</label>
              <select {...register('item_code')} className="input-field">
                <option value="">Pilih item</option>
                {items.map((i) => (
                  <option key={i.item_code} value={i.item_code}>{i.item_name}</option>
                ))}
              </select>
              {formErrors.item_code && <p className="text-xs text-red-600 mt-1">{formErrors.item_code.message}</p>}
            </div>
            <div>
              <label className="label-field">Qty Output per Produksi</label>
              <input type="number" min={0.01} step="any" {...register('output_qty')} className="input-field" />
            </div>
          </div>

          <div>
            <label className="label-field">Komponen</label>
            <div className="space-y-2">
              {componentFields.map((line, idx) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                  <select {...register(`components.${idx}.component_item_code`)} className="input-field col-span-8 text-xs">
                    <option value="">Item komponen</option>
                    {items.map((i) => (
                      <option key={i.item_code} value={i.item_code}>{i.item_name}</option>
                    ))}
                  </select>
                  <input type="number" min={0} step="any" placeholder="Qty" {...register(`components.${idx}.qty`)} className="input-field col-span-3 text-xs" />
                  <button
                    type="button"
                    onClick={() => (componentFields.length > 1 ? removeComponentField(idx) : undefined)}
                    className="col-span-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => appendComponent({ component_item_code: '', qty: 0 })}
              className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Plus size={12} /> Add row
            </button>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>Create BOM</Button>
          </div>
        </form>
      </Modal>
    </ListViewLayout>
  );
}
