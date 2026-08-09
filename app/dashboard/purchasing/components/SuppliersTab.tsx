'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { Supplier } from '@/types';
import { Plus, Edit, Trash2, Truck } from 'lucide-react';

export default function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({ supplier_id: '', supplier_name: '', contact: '', phone: '', email: '', address: '', payment_terms: '' });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) setSuppliers(await res.json());
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setFormData({ supplier_id: '', supplier_name: '', contact: '', phone: '', email: '', address: '', payment_terms: '' });
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setFormData({ supplier_id: s.supplier_id, supplier_name: s.supplier_name, contact: s.contact, phone: s.phone, email: s.email, address: s.address, payment_terms: s.payment_terms });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const res = editing
        ? await fetch('/api/suppliers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
        : await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });

      if (res.ok) {
        setIsModalOpen(false);
        fetchSuppliers();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan supplier');
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
      setError('Gagal menyimpan supplier');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (supplierId: string) => {
    if (!confirm('Hapus supplier ini?')) return;
    try {
      const res = await fetch(`/api/suppliers?supplier_id=${supplierId}`, { method: 'DELETE' });
      if (res.ok) fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
    }
  };

  return (
    <ListViewLayout primaryAction={<Button onClick={openNew}><Plus size={14} className="mr-1.5" />Add Supplier</Button>}>
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loading size="lg" /></div>
      ) : suppliers.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No suppliers found</p>
      ) : (
        suppliers.map((s) => (
          <ListRow
            key={s.supplier_id}
            avatar={<span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center"><Truck size={14} /></span>}
            title={s.supplier_name}
            subtitle={`${s.supplier_id} · ${s.phone || s.contact || '-'}`}
            meta={s.payment_terms}
            badges={!s.is_active ? <StatusBadge label="Inactive" tone="red" /> : undefined}
            actions={
              <>
                <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400"><Edit size={14} /></button>
                <button onClick={() => handleDelete(s.supplier_id)} className="text-red-600 hover:text-red-800 dark:text-red-400"><Trash2 size={14} /></button>
              </>
            }
          />
        ))
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label-field">Supplier ID</label>
            <input type="text" value={formData.supplier_id} onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })} className="input-field" placeholder="Kosongkan untuk auto-generate" disabled={!!editing} />
          </div>
          <div>
            <label className="label-field">Supplier Name</label>
            <input type="text" value={formData.supplier_name} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} className="input-field" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Contact Person</label>
              <input type="text" value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Phone</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-field">Email</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Address</label>
            <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Payment Terms</label>
            <input type="text" value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} className="input-field" placeholder="cth. Net 30" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>{editing ? 'Update' : 'Add'} Supplier</Button>
          </div>
        </form>
      </Modal>
    </ListViewLayout>
  );
}
