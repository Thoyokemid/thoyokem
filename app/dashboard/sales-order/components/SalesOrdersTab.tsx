'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { Customer, Item, Warehouse } from '@/types';
import { Plus, Trash2, Send, XCircle, FileText, ShoppingBag, Check, Ban } from 'lucide-react';

interface SOItemLine {
  item_code: string;
  qty: string;
  rate: string;
  warehouse_id: string;
}

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

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'green' | 'red'> = {
  Draft: 'gray',
  Confirmed: 'blue',
  Delivered: 'green',
  Cancelled: 'red',
};

const APPROVAL_TONE: Record<string, 'gray' | 'orange' | 'green' | 'red'> = {
  Pending: 'orange',
  Approved: 'green',
  Rejected: 'red',
};

export default function SalesOrdersTab() {
  const { data: session } = useSession();
  const canApprove = !!session?.user.permissions.can_approve;
  const [orders, setOrders] = useState<SalesOrderWithItems[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [lines, setLines] = useState<SOItemLine[]>([{ item_code: '', qty: '', rate: '', warehouse_id: '' }]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [ordersRes, customersRes, itemsRes, warehousesRes] = await Promise.all([
        fetch('/api/sales-orders'),
        fetch('/api/customers'),
        fetch('/api/items'),
        fetch('/api/warehouses'),
      ]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (customersRes.ok) setCustomers(await customersRes.json());
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (warehousesRes.ok) setWarehouses(await warehousesRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openNew = () => {
    setCustomerId('');
    setDeliveryDate('');
    setLines([{ item_code: '', qty: '', rate: '', warehouse_id: '' }]);
    setError('');
    setIsModalOpen(true);
  };

  const updateLine = (idx: number, field: keyof SOItemLine, value: string) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, { item_code: '', qty: '', rate: '', warehouse_id: '' }]);
  const removeLine = (idx: number) => setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const total = lines.reduce((sum, l) => sum + (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        customer_id: customerId,
        delivery_date: deliveryDate,
        items: lines
          .filter((l) => l.item_code && l.qty)
          .map((l) => ({ item_code: l.item_code, qty: parseFloat(l.qty) || 0, rate: parseFloat(l.rate) || 0, warehouse_id: l.warehouse_id })),
      };
      const res = await fetch('/api/sales-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        setIsModalOpen(false);
        fetchAll();
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
        fetchAll();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal memproses aksi');
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
        alert('Invoice berhasil dibuat. Cek tab Invoices.');
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal membuat invoice');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ListViewLayout primaryAction={<Button onClick={openNew}><Plus size={14} className="mr-1.5" />New Sales Order</Button>}>
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loading size="lg" /></div>
      ) : orders.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No sales orders found</p>
      ) : (
        orders.map((so) => (
          <ListRow
            key={so.so_id}
            avatar={<span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center"><ShoppingBag size={14} /></span>}
            title={so.so_id}
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
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-field" required>
                <option value="">Pilih customer</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Delivery Date</label>
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="label-field">Items</label>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <select value={line.item_code} onChange={(e) => updateLine(idx, 'item_code', e.target.value)} className="input-field col-span-4 text-xs" required>
                    <option value="">Item</option>
                    {items.map((i) => (
                      <option key={i.item_code} value={i.item_code}>{i.item_name}</option>
                    ))}
                  </select>
                  <select value={line.warehouse_id} onChange={(e) => updateLine(idx, 'warehouse_id', e.target.value)} className="input-field col-span-3 text-xs" required>
                    <option value="">Warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>
                    ))}
                  </select>
                  <input type="number" min={0} step="any" placeholder="Qty" value={line.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)} className="input-field col-span-2 text-xs" required />
                  <input type="number" min={0} step="any" placeholder="Rate" value={line.rate} onChange={(e) => updateLine(idx, 'rate', e.target.value)} className="input-field col-span-2 text-xs" required />
                  <button type="button" onClick={() => removeLine(idx)} className="col-span-1 text-red-500 hover:text-red-700">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addLine} className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1">
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
    </ListViewLayout>
  );
}
