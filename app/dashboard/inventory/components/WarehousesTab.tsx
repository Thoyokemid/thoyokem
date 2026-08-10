'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { Warehouse } from '@/types';
import { Plus, Edit, Trash2, Warehouse as WarehouseIcon } from 'lucide-react';

export default function WarehousesTab() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({ warehouse_id: '', warehouse_name: '', location: '' });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const res = await fetch('/api/warehouses');
      if (res.ok) setWarehouses(await res.json());
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openNew = () => {
    setEditingWarehouse(null);
    setFormData({ warehouse_id: '', warehouse_name: '', location: '' });
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditingWarehouse(w);
    setFormData({ warehouse_id: w.warehouse_id, warehouse_name: w.warehouse_name, location: w.location });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const payload = editingWarehouse
        ? { warehouse_id: formData.warehouse_id, warehouse_name: formData.warehouse_name, location: formData.location }
        : { warehouse_id: formData.warehouse_id || undefined, warehouse_name: formData.warehouse_name, location: formData.location };

      const res = editingWarehouse
        ? await fetch('/api/warehouses', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/warehouses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

      if (res.ok) {
        setIsModalOpen(false);
        fetchWarehouses();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan warehouse');
      }
    } catch (error) {
      console.error('Error saving warehouse:', error);
      setError('Gagal menyimpan warehouse');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (warehouseId: string) => {
    if (!confirm('Hapus warehouse ini?')) return;
    try {
      const res = await fetch(`/api/warehouses?warehouse_id=${warehouseId}`, { method: 'DELETE' });
      if (res.ok) fetchWarehouses();
    } catch (error) {
      console.error('Error deleting warehouse:', error);
    }
  };

  return (
    <ListViewLayout
      primaryAction={
        <Button onClick={openNew}>
          <Plus size={14} className="mr-1.5" />
          Add Warehouse
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" />
        </div>
      ) : warehouses.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No warehouses found</p>
      ) : (
        warehouses.map((w) => (
          <ListRow
            key={w.warehouse_id}
            onClick={() => router.push(`/dashboard/inventory/warehouse/${encodeURIComponent(w.warehouse_id)}`)}
            avatar={
              <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center">
                <WarehouseIcon size={14} />
              </span>
            }
            title={w.warehouse_name}
            subtitle={`${w.warehouse_id} · ${w.location || '-'}`}
            badges={!w.is_active ? <StatusBadge label="Inactive" tone="red" /> : undefined}
            actions={
              <>
                <button onClick={() => openEdit(w)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                  <Edit size={14} />
                </button>
                <button onClick={() => handleDelete(w.warehouse_id)} className="text-red-600 hover:text-red-800 dark:text-red-400">
                  <Trash2 size={14} />
                </button>
              </>
            }
          />
        ))
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label-field">Warehouse ID</label>
            <input
              type="text"
              value={formData.warehouse_id}
              onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
              className="input-field"
              placeholder="Kosongkan untuk auto-generate"
              disabled={!!editingWarehouse}
            />
          </div>
          <div>
            <label className="label-field">Warehouse Name</label>
            <input
              type="text"
              value={formData.warehouse_name}
              onChange={(e) => setFormData({ ...formData, warehouse_name: e.target.value })}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="label-field">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="input-field"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>{editingWarehouse ? 'Update' : 'Add'} Warehouse</Button>
          </div>
        </form>
      </Modal>
    </ListViewLayout>
  );
}
