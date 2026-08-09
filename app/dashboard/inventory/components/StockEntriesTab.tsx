'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { StockEntry, Item, Warehouse, StockEntryType } from '@/types';
import { Plus, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';

const TYPE_TONE: Record<string, 'green' | 'red' | 'blue'> = {
  'Material Receipt': 'green',
  'Material Issue': 'red',
  'Material Transfer': 'blue',
};

const TYPE_ICON: Record<string, React.ElementType> = {
  'Material Receipt': ArrowDownToLine,
  'Material Issue': ArrowUpFromLine,
  'Material Transfer': ArrowLeftRight,
};

export default function StockEntriesTab() {
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
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
      const [entriesRes, itemsRes, warehousesRes] = await Promise.all([
        fetch('/api/stock-entries'),
        fetch('/api/items'),
        fetch('/api/warehouses'),
      ]);
      if (entriesRes.ok) setEntries(await entriesRes.json());
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (warehousesRes.ok) setWarehouses(await warehousesRes.json());
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

  return (
    <ListViewLayout
      primaryAction={
        <Button onClick={openNew}>
          <Plus size={14} className="mr-1.5" />
          New Stock Entry
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" />
        </div>
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
            </select>
          </div>

          <div>
            <label className="label-field">Item</label>
            <select
              value={formData.item_code}
              onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
              className="input-field"
              required
            >
              <option value="">Pilih item</option>
              {items.map((i) => (
                <option key={i.item_code} value={i.item_code}>{i.item_name} ({i.item_code})</option>
              ))}
            </select>
          </div>

          {(formData.entry_type === 'Material Issue' || formData.entry_type === 'Material Transfer') && (
            <div>
              <label className="label-field">Source Warehouse</label>
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

          {(formData.entry_type === 'Material Receipt' || formData.entry_type === 'Material Transfer') && (
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
