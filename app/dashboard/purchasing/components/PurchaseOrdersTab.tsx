'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { SkeletonList } from '@/components/ui/Skeleton';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { Supplier, Item, Warehouse } from '@/types';
import { fetchUsdIdrRate, toIDR } from '@/lib/currency';
import { Plus, Trash2, Send, PackageCheck, XCircle, FileText, ShoppingCart, Check, Ban, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const poFormSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier wajib dipilih'),
  expected_date: z.string().optional(),
  lines: z
    .array(
      z.object({
        item_code: z.string().min(1, 'Item wajib dipilih'),
        warehouse_id: z.string().min(1, 'Warehouse wajib dipilih'),
        qty: z.coerce.number().gt(0, 'Qty wajib diisi'),
        rate: z.coerce.number().min(0),
      })
    )
    .min(1, 'Minimal 1 baris item'),
});
type POFormInput = z.input<typeof poFormSchema>;
type POFormValues = z.output<typeof poFormSchema>;

interface PurchaseOrderWithItems {
  po_id: string;
  supplier_id: string;
  supplier_name: string;
  order_date: string;
  expected_date: string;
  status: string;
  approval_status: string;
  approved_by: string;
  total_amount: number;
  items: { item_code: string; qty: number; rate: number; amount: number; received_qty: number; warehouse_id: string }[];
}

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'green' | 'red'> = {
  Draft: 'gray',
  Submitted: 'blue',
  Received: 'green',
  Cancelled: 'red',
};

const APPROVAL_TONE: Record<string, 'gray' | 'orange' | 'green' | 'red'> = {
  Pending: 'orange',
  Approved: 'green',
  Rejected: 'red',
};

const REPORT_COLUMNS: ReportColumn<PurchaseOrderWithItems>[] = [
  { key: 'po_id', header: 'PO ID' },
  { key: 'supplier_name', header: 'Supplier' },
  { key: 'order_date', header: 'Order Date' },
  { key: 'expected_date', header: 'Expected Date' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge label={r.status} tone={STATUS_TONE[r.status] || 'gray'} /> },
  { key: 'approval_status', header: 'Approval', render: (r) => <StatusBadge label={r.approval_status} tone={APPROVAL_TONE[r.approval_status] || 'gray'} /> },
  { key: 'approved_by', header: 'Approved By' },
  { key: 'total_amount', header: 'Total', align: 'right', render: (r) => r.total_amount.toLocaleString('id-ID') },
];
const DEFAULT_VISIBLE = REPORT_COLUMNS.map((c) => c.key);

export default function PurchaseOrdersTab() {
  const { data: session } = useSession();
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
  const canApprove = !!session?.user.permissions.can_approve;
  const [viewMode, setViewMode] = useViewMode('purchasing_orders_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('purchasing_orders_cols', DEFAULT_VISIBLE);
  const [orders, setOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [usdRate, setUsdRate] = useState(15800);

  const {
    register,
    control,
    handleSubmit: handleFormSubmit,
    reset: resetForm,
    watch,
    setValue,
    formState: { errors: formErrors },
  } = useForm<POFormInput, any, POFormValues>({
    resolver: zodResolver(poFormSchema),
    defaultValues: { supplier_id: '', expected_date: '', lines: [{ item_code: '', qty: 0, rate: 0, warehouse_id: '' }] },
  });
  const { fields: lineFields, append: appendLine, remove: removeLineField } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');

  useEffect(() => {
    fetchAll();
    fetchUsdIdrRate().then(setUsdRate);
  }, []);

  const fetchAll = async () => {
    try {
      const [ordersRes, suppliersRes, itemsRes, warehousesRes] = await Promise.all([
        fetch('/api/purchase-orders'),
        fetch('/api/suppliers'),
        fetch('/api/items'),
        fetch('/api/warehouses'),
      ]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (warehousesRes.ok) setWarehouses(await warehousesRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openNew = () => {
    resetForm({ supplier_id: '', expected_date: '', lines: [{ item_code: '', qty: 0, rate: 0, warehouse_id: '' }] });
    setError('');
    setIsModalOpen(true);
  };

  const generatedRateFor = (itemCode: string): number | null => {
    const item = items.find((i) => i.item_code === itemCode);
    if (!item) return null;
    return Math.round(toIDR(item.purchase_price, item.currency, usdRate));
  };

  const handleItemChange = (idx: number, itemCode: string) => {
    setValue(`lines.${idx}.item_code`, itemCode);
    const generated = generatedRateFor(itemCode);
    if (generated !== null) setValue(`lines.${idx}.rate`, generated);
  };

  const regenerateRate = (idx: number) => {
    const line = watchedLines?.[idx];
    const generated = line ? generatedRateFor(line.item_code) : null;
    if (generated !== null) setValue(`lines.${idx}.rate`, generated);
  };

  const total = (watchedLines || []).reduce((sum, l) => sum + (Number(l?.qty) || 0) * (Number(l?.rate) || 0), 0);

  const onSubmit = async (data: POFormValues) => {
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        supplier_id: data.supplier_id,
        expected_date: data.expected_date,
        items: data.lines.map((l) => ({ item_code: l.item_code, qty: l.qty, rate: l.rate, warehouse_id: l.warehouse_id })),
      };
      const res = await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        setIsModalOpen(false);
        fetchAll();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal membuat purchase order');
      }
    } catch (error) {
      console.error('Error creating PO:', error);
      setError('Gagal membuat purchase order');
    } finally {
      setIsSaving(false);
    }
  };

  const runAction = async (po_id: string, action: 'submit' | 'receive' | 'cancel' | 'approve' | 'reject') => {
    if (action === 'cancel' && !confirm('Batalkan PO ini?')) return;
    setBusyId(po_id);
    try {
      const res = await fetch('/api/purchase-orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ po_id, action }) });
      if (res.ok) {
        fetchAll();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal memproses aksi');
      }
    } catch (error) {
      console.error('Error running action:', error);
    } finally {
      setBusyId(null);
    }
  };

  const createInvoice = async (po_id: string) => {
    setBusyId(po_id);
    try {
      const res = await fetch('/api/purchase-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ po_id, due_date: '' }),
      });
      if (res.ok) {
        toast.success('Invoice berhasil dibuat. Cek tab Invoices.');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal membuat invoice');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
    } finally {
      setBusyId(null);
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
            onExport={() => exportToExcel(orders, REPORT_COLUMNS, 'purchase_orders', 'Purchase Orders')}
            doctype="Purchase Order"
          />
          <Button onClick={openNew}><Plus size={14} className="mr-1.5" />New Purchase Order</Button>
        </div>
      }
    >
      {isLoading ? (
        <SkeletonList />
      ) : viewMode === 'report' ? (
        <ReportTable columns={REPORT_COLUMNS} visibleColumns={visibleCols} rows={orders} keyField={(r) => r.po_id} />
      ) : orders.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No purchase orders found</p>
      ) : (
        orders.map((po) => (
          <ListRow
            key={po.po_id}
            onClick={() => router.push(`/dashboard/purchasing/purchase-order/${encodeURIComponent(po.po_id)}`)}
            avatar={<span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center"><ShoppingCart size={14} /></span>}
            title={po.po_id}
            statusTone={STATUS_TONE[po.status] || 'gray'}
            subtitle={`${po.supplier_name} · ${po.items.length} item`}
            meta={`Rp${po.total_amount.toLocaleString('id-ID')}`}
            badges={
              <>
                <StatusBadge label={po.status} tone={STATUS_TONE[po.status] || 'gray'} />
                {po.status === 'Submitted' && (
                  <StatusBadge label={po.approval_status} tone={APPROVAL_TONE[po.approval_status] || 'gray'} />
                )}
              </>
            }
            actions={
              <>
                {po.status === 'Draft' && (
                  <button disabled={busyId === po.po_id} onClick={() => runAction(po.po_id, 'submit')} title="Submit" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 disabled:opacity-40">
                    <Send size={14} />
                  </button>
                )}
                {po.status === 'Submitted' && po.approval_status === 'Pending' && canApprove && (
                  <>
                    <button disabled={busyId === po.po_id} onClick={() => runAction(po.po_id, 'approve')} title="Approve" className="text-green-600 hover:text-green-800 dark:text-green-400 disabled:opacity-40">
                      <Check size={14} />
                    </button>
                    <button disabled={busyId === po.po_id} onClick={() => runAction(po.po_id, 'reject')} title="Reject" className="text-red-600 hover:text-red-800 dark:text-red-400 disabled:opacity-40">
                      <Ban size={14} />
                    </button>
                  </>
                )}
                {po.status === 'Submitted' && po.approval_status === 'Approved' && (
                  <button disabled={busyId === po.po_id} onClick={() => runAction(po.po_id, 'receive')} title="Receive" className="text-green-600 hover:text-green-800 dark:text-green-400 disabled:opacity-40">
                    <PackageCheck size={14} />
                  </button>
                )}
                {po.status === 'Received' && (
                  <button disabled={busyId === po.po_id} onClick={() => createInvoice(po.po_id)} title="Create Invoice" className="text-purple-600 hover:text-purple-800 dark:text-purple-400 disabled:opacity-40">
                    <FileText size={14} />
                  </button>
                )}
                {(po.status === 'Draft' || po.status === 'Submitted') && (
                  <button disabled={busyId === po.po_id} onClick={() => runAction(po.po_id, 'cancel')} title="Cancel" className="text-red-600 hover:text-red-800 dark:text-red-400 disabled:opacity-40">
                    <XCircle size={14} />
                  </button>
                )}
              </>
            }
          />
        ))
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Purchase Order" size="lg">
        <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Supplier</label>
              <select {...register('supplier_id')} className="input-field">
                <option value="">Pilih supplier</option>
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>
                ))}
              </select>
              {formErrors.supplier_id && <p className="text-xs text-red-600 mt-1">{formErrors.supplier_id.message}</p>}
            </div>
            <div>
              <label className="label-field">Expected Date</label>
              <input type="date" {...register('expected_date')} className="input-field" />
            </div>
          </div>

          <div>
            <label className="label-field">Items</label>
            <div className="space-y-2">
              {lineFields.map((line, idx) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    value={watchedLines?.[idx]?.item_code || ''}
                    onChange={(e) => handleItemChange(idx, e.target.value)}
                    className="input-field col-span-4 text-xs"
                  >
                    <option value="">Item</option>
                    {items.map((i) => (
                      <option key={i.item_code} value={i.item_code}>{i.item_name}</option>
                    ))}
                  </select>
                  <select {...register(`lines.${idx}.warehouse_id`)} className="input-field col-span-3 text-xs">
                    <option value="">Warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>
                    ))}
                  </select>
                  <input type="number" min={0} step="any" placeholder="Qty" {...register(`lines.${idx}.qty`)} className="input-field col-span-2 text-xs" />
                  <div className="col-span-2 relative">
                    <input type="number" min={0} step="any" placeholder="Rate (IDR)" {...register(`lines.${idx}.rate`)} className="input-field text-xs pr-6" />
                    {items.find((i) => i.item_code === watchedLines?.[idx]?.item_code)?.currency === 'USD' && (
                      <button
                        type="button"
                        onClick={() => regenerateRate(idx)}
                        title="Generate ulang dari harga USD × kurs"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary"
                      >
                        <RefreshCw size={12} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => (lineFields.length > 1 ? removeLineField(idx) : undefined)}
                    className="col-span-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {watchedLines?.some((l) => items.find((i) => i.item_code === l?.item_code)?.currency === 'USD') && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Kurs saat ini: $1 = Rp{usdRate.toLocaleString('id-ID')}. Rate untuk item USD otomatis di-generate ke IDR, tapi tetap bisa kamu edit manual.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => appendLine({ item_code: '', qty: 0, rate: 0, warehouse_id: '' })}
              className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Plus size={12} /> Add row
            </button>
          </div>

          <div className="text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
            Total: Rp{total.toLocaleString('id-ID')}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>Create PO (Draft)</Button>
          </div>
        </form>
      </Modal>
    </ListViewLayout>
  );
}
