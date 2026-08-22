'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { SkeletonList } from '@/components/ui/Skeleton';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import QRScanner from '@/components/ui/QRScanner';
import { Customer, Item, Warehouse } from '@/types';
import { fetchUsdIdrRate, toIDR } from '@/lib/currency';
import { Plus, Trash2, Send, XCircle, FileText, ShoppingBag, Check, Ban, RefreshCw, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';

const soFormSchema = z.object({
  customer_id: z.string().min(1, 'Customer wajib dipilih'),
  delivery_date: z.string().optional(),
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
type SOFormInput = z.input<typeof soFormSchema>;
type SOFormValues = z.output<typeof soFormSchema>;

interface SalesOrderWithItems {
  so_id: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  delivery_date: string;
  status: string;
  approval_status: string;
  approved_by: string;
  total_amount: number;
  items: { item_code: string; qty: number; rate: number; amount: number; delivered_qty: number; warehouse_id: string }[];
}

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'orange' | 'green' | 'red'> = {
  Draft: 'gray',
  Confirmed: 'blue',
  'In Delivery': 'orange',
  Delivered: 'green',
  Cancelled: 'red',
};

const APPROVAL_TONE: Record<string, 'gray' | 'orange' | 'green' | 'red'> = {
  Pending: 'orange',
  Approved: 'green',
  Rejected: 'red',
};

const REPORT_COLUMNS: ReportColumn<SalesOrderWithItems>[] = [
  { key: 'so_id', header: 'SO ID' },
  { key: 'customer_name', header: 'Customer' },
  { key: 'order_date', header: 'Order Date' },
  { key: 'delivery_date', header: 'Delivery Date' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge label={r.status} tone={STATUS_TONE[r.status] || 'gray'} /> },
  { key: 'approval_status', header: 'Approval', render: (r) => <StatusBadge label={r.approval_status} tone={APPROVAL_TONE[r.approval_status] || 'gray'} /> },
  { key: 'approved_by', header: 'Approved By' },
  { key: 'total_amount', header: 'Total', align: 'right', render: (r) => r.total_amount.toLocaleString('id-ID') },
];
const DEFAULT_VISIBLE = REPORT_COLUMNS.map((c) => c.key);

export default function SalesOrdersTab() {
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
  const queryClient = useQueryClient();
  const canApprove = !!session?.user.permissions.can_approve;
  const [viewMode, setViewMode] = useViewMode('sales_orders_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('sales_orders_cols', DEFAULT_VISIBLE);
  const { data: orders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: async () => {
      const res = await fetch('/api/sales-orders');
      if (!res.ok) throw new Error('Failed to fetch sales orders');
      return (await res.json()) as SalesOrderWithItems[];
    },
  });
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await fetch('/api/customers');
      if (!res.ok) throw new Error('Failed to fetch customers');
      return (await res.json()) as Customer[];
    },
  });
  const { data: items = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const res = await fetch('/api/items');
      if (!res.ok) throw new Error('Failed to fetch items');
      return (await res.json()) as Item[];
    },
  });
  const { data: warehouses = [], isLoading: isLoadingWarehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses');
      if (!res.ok) throw new Error('Failed to fetch warehouses');
      return (await res.json()) as Warehouse[];
    },
  });
  const isLoading = isLoadingOrders || isLoadingCustomers || isLoadingItems || isLoadingWarehouses;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [usdRate, setUsdRate] = useState(15800);
  const [scanTargetIdx, setScanTargetIdx] = useState<number | null>(null);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ customer_name: '', phone: '', address: '' });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState('');

  const {
    register,
    control,
    handleSubmit: handleFormSubmit,
    reset: resetForm,
    watch,
    setValue,
    formState: { errors: formErrors },
  } = useForm<SOFormInput, any, SOFormValues>({
    resolver: zodResolver(soFormSchema),
    defaultValues: { customer_id: '', delivery_date: '', lines: [{ item_code: '', qty: 0, rate: 0, warehouse_id: '' }] },
  });
  const { fields: lineFields, append: appendLine, remove: removeLineField } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');
  const watchedCustomerId = watch('customer_id');

  useEffect(() => {
    fetchUsdIdrRate().then(setUsdRate);
  }, []);

  const openNew = () => {
    resetForm({ customer_id: '', delivery_date: '', lines: [{ item_code: '', qty: 0, rate: 0, warehouse_id: '' }] });
    setError('');
    setIsModalOpen(true);
  };

  const generatedRateFor = (itemCode: string): number | null => {
    const item = items.find((i) => i.item_code === itemCode);
    if (!item) return null;
    return Math.round(toIDR(item.selling_price, item.currency, usdRate));
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCustomer(true);
    setNewCustomerError('');
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomerForm),
      });
      if (res.ok) {
        const data = await res.json();
        await queryClient.invalidateQueries({ queryKey: ['customers'] });
        setValue('customer_id', data.customer_id);
        setIsNewCustomerOpen(false);
        setNewCustomerForm({ customer_name: '', phone: '', address: '' });
      } else {
        const err = await res.json();
        setNewCustomerError(err.error || 'Gagal membuat customer');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      setNewCustomerError('Gagal membuat customer');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleScan = (decodedText: string) => {
    if (scanTargetIdx === null) return;
    const match = items.find((i) => i.item_code === decodedText.trim());
    if (match) {
      handleItemChange(scanTargetIdx, match.item_code);
      setScanTargetIdx(null);
    } else {
      setError(`Item dengan kode "${decodedText}" tidak ditemukan`);
    }
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

  const onSubmit = async (data: SOFormValues) => {
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        customer_id: data.customer_id,
        delivery_date: data.delivery_date,
        items: data.lines.map((l) => ({ item_code: l.item_code, qty: l.qty, rate: l.rate, warehouse_id: l.warehouse_id })),
      };
      const res = await fetch('/api/sales-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal membuat sales order');
      }
    } catch (error) {
      console.error('Error creating SO:', error);
      setError('Gagal membuat sales order');
    } finally {
      setIsSaving(false);
    }
  };

  const runAction = async (so_id: string, action: 'submit' | 'cancel' | 'approve' | 'reject') => {
    if (action === 'cancel' && !confirm('Batalkan SO ini?')) return;
    setBusyId(so_id);
    try {
      const res = await fetch('/api/sales-orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ so_id, action }) });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
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

  const createInvoice = async (so_id: string) => {
    setBusyId(so_id);
    try {
      const res = await fetch('/api/sales-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ so_id, due_date: '' }),
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
            onExport={() => exportToExcel(orders, REPORT_COLUMNS, 'sales_orders', 'Sales Orders')}
          />
          <Button onClick={openNew}><Plus size={14} className="mr-1.5" />New Sales Order</Button>
        </div>
      }
    >
      {isLoading ? (
        <SkeletonList />
      ) : viewMode === 'report' ? (
        <ReportTable columns={REPORT_COLUMNS} visibleColumns={visibleCols} rows={orders} keyField={(r) => r.so_id} />
      ) : orders.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No sales orders found</p>
      ) : (
        orders.map((so) => (
          <ListRow
            key={so.so_id}
            onClick={() => router.push(`/dashboard/sales-order/sales-order/${encodeURIComponent(so.so_id)}`)}
            avatar={<span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center"><ShoppingBag size={14} /></span>}
            title={so.so_id}
            statusTone={STATUS_TONE[so.status] || 'gray'}
            subtitle={`${so.customer_name} · ${so.items.length} item`}
            meta={`Rp${so.total_amount.toLocaleString('id-ID')}`}
            badges={
              <>
                <StatusBadge label={so.status} tone={STATUS_TONE[so.status] || 'gray'} />
                {so.status === 'Confirmed' && (
                  <StatusBadge label={so.approval_status} tone={APPROVAL_TONE[so.approval_status] || 'gray'} />
                )}
              </>
            }
            actions={
              <>
                {so.status === 'Draft' && (
                  <button disabled={busyId === so.so_id} onClick={() => runAction(so.so_id, 'submit')} title="Confirm" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 disabled:opacity-40">
                    <Send size={14} />
                  </button>
                )}
                {so.status === 'Confirmed' && so.approval_status === 'Pending' && canApprove && (
                  <>
                    <button disabled={busyId === so.so_id} onClick={() => runAction(so.so_id, 'approve')} title="Approve" className="text-green-600 hover:text-green-800 dark:text-green-400 disabled:opacity-40">
                      <Check size={14} />
                    </button>
                    <button disabled={busyId === so.so_id} onClick={() => runAction(so.so_id, 'reject')} title="Reject" className="text-red-600 hover:text-red-800 dark:text-red-400 disabled:opacity-40">
                      <Ban size={14} />
                    </button>
                  </>
                )}
                {so.status === 'Delivered' && (
                  <button disabled={busyId === so.so_id} onClick={() => createInvoice(so.so_id)} title="Create Invoice" className="text-purple-600 hover:text-purple-800 dark:text-purple-400 disabled:opacity-40">
                    <FileText size={14} />
                  </button>
                )}
                {(so.status === 'Draft' || so.status === 'Confirmed') && (
                  <button disabled={busyId === so.so_id} onClick={() => runAction(so.so_id, 'cancel')} title="Cancel" className="text-red-600 hover:text-red-800 dark:text-red-400 disabled:opacity-40">
                    <XCircle size={14} />
                  </button>
                )}
              </>
            }
          />
        ))
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Sales Order" size="lg">
        <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Customer</label>
              <select
                value={watchedCustomerId || ''}
                onChange={(e) => {
                  if (e.target.value === '__add_new__') {
                    setIsNewCustomerOpen(true);
                    return;
                  }
                  setValue('customer_id', e.target.value);
                }}
                className="input-field"
              >
                <option value="">Pilih customer</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                ))}
                <option value="__add_new__">+ Add New Customer</option>
              </select>
              {formErrors.customer_id && <p className="text-xs text-red-600 mt-1">{formErrors.customer_id.message}</p>}
            </div>
            <div>
              <label className="label-field">Delivery Date</label>
              <input type="date" {...register('delivery_date')} className="input-field" />
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
                    className="input-field col-span-2 text-xs"
                  >
                    <option value="">Item</option>
                    {items.map((i) => (
                      <option key={i.item_code} value={i.item_code}>{i.item_name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setScanTargetIdx(idx)}
                    title="Scan QR Item"
                    className="col-span-1 px-1.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-500 hover:text-primary hover:border-primary flex items-center justify-center"
                  >
                    <ScanLine size={14} />
                  </button>
                  <select {...register(`lines.${idx}.warehouse_id`)} className="input-field col-span-2 text-xs">
                    <option value="">Warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>
                    ))}
                  </select>
                  <input type="number" min={0} step="any" placeholder="Qty" {...register(`lines.${idx}.qty`)} className="input-field col-span-2 text-xs" />
                  <div className="col-span-1 text-xs text-gray-500 dark:text-gray-400 text-center" title="Unit yang akan dipotong dari stock">
                    {items.find((i) => i.item_code === watchedLines?.[idx]?.item_code)?.unit || '-'}
                  </div>
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
            <Button type="submit" variant="primary" isLoading={isSaving}>Create SO (Draft)</Button>
          </div>
        </form>
      </Modal>
      <QRScanner isOpen={scanTargetIdx !== null} onClose={() => setScanTargetIdx(null)} onScan={handleScan} />

      <Modal isOpen={isNewCustomerOpen} onClose={() => setIsNewCustomerOpen(false)} title="Add New Customer" size="sm">
        <form onSubmit={handleCreateCustomer} className="space-y-3">
          <div>
            <label className="label-field">Customer Name</label>
            <input
              type="text"
              value={newCustomerForm.customer_name}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, customer_name: e.target.value })}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="label-field">Phone</label>
            <input
              type="text"
              value={newCustomerForm.phone}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Address</label>
            <input
              type="text"
              value={newCustomerForm.address}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
              className="input-field"
            />
          </div>
          {newCustomerError && <p className="text-xs text-red-600">{newCustomerError}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsNewCustomerOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSavingCustomer}>Add Customer</Button>
          </div>
        </form>
      </Modal>
    </ListViewLayout>
  );
}
