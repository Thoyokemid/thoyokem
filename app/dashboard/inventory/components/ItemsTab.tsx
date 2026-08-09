'use client';

import { useState, useEffect, useMemo } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { Item } from '@/types';
import { Plus, Edit, Trash2, Search, Package } from 'lucide-react';

export default function ItemsTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    item_code: '',
    item_name: '',
    item_group: '',
    unit: '',
    purchase_price: '',
    selling_price: '',
    reorder_level: '',
    valuation_method: 'Average',
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/items');
      if (res.ok) setItems(await res.json());
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(
      (i) => i.item_name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q)
    );
  }, [items, searchTerm]);

  const openNew = () => {
    setEditingItem(null);
    setFormData({ item_code: '', item_name: '', item_group: '', unit: '', purchase_price: '', selling_price: '', reorder_level: '', valuation_method: 'Average' });
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      item_code: item.item_code,
      item_name: item.item_name,
      item_group: item.item_group,
      unit: item.unit,
      purchase_price: String(item.purchase_price),
      selling_price: String(item.selling_price),
      reorder_level: String(item.reorder_level),
      valuation_method: item.valuation_method,
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        item_code: formData.item_code,
        item_name: formData.item_name,
        item_group: formData.item_group,
        unit: formData.unit,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        reorder_level: parseFloat(formData.reorder_level) || 0,
        valuation_method: formData.valuation_method,
      };

      const res = editingItem
        ? await fetch('/api/items', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

      if (res.ok) {
        setIsModalOpen(false);
        fetchItems();
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
    try {
      const res = await fetch(`/api/items?item_code=${itemCode}`, { method: 'DELETE' });
      if (res.ok) fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  return (
    <ListViewLayout
      primaryAction={
        <Button onClick={openNew}>
          <Plus size={14} className="mr-1.5" />
          Add Item
        </Button>
      }
      toolbar={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="Cari nama atau kode item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" />
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No items found</p>
      ) : (
        filteredItems.map((item) => (
          <ListRow
            key={item.item_code}
            avatar={
              <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center">
                <Package size={14} />
              </span>
            }
            title={item.item_name}
            subtitle={`${item.item_code} · ${item.item_group || '-'} · ${item.unit || '-'}`}
            meta={`Jual: Rp${item.selling_price.toLocaleString('id-ID')}`}
            badges={!item.is_active ? <StatusBadge label="Inactive" tone="red" /> : undefined}
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
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label-field">Item Code</label>
            <input
              type="text"
              value={formData.item_code}
              onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
              className="input-field"
              placeholder="cth. ITM-001"
              required
              disabled={!!editingItem}
            />
          </div>
          <div>
            <label className="label-field">Item Name</label>
            <input
              type="text"
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              className="input-field"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Group</label>
              <input type="text" value={formData.item_group} onChange={(e) => setFormData({ ...formData, item_group: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Unit</label>
              <input type="text" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="input-field" placeholder="pcs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Purchase Price</label>
              <input type="number" min={0} value={formData.purchase_price} onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Selling Price</label>
              <input type="number" min={0} value={formData.selling_price} onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Reorder Level</label>
              <input type="number" min={0} value={formData.reorder_level} onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Valuation Method</label>
              <select value={formData.valuation_method} onChange={(e) => setFormData({ ...formData, valuation_method: e.target.value })} className="input-field">
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
    </ListViewLayout>
  );
}
