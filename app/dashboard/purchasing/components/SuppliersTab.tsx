'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import BulkImportModal, { ImportColumn } from '@/components/ui/BulkImportModal';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { Supplier } from '@/types';
import { Plus, Edit, Trash2, Truck, Upload } from 'lucide-react';

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'supplier_id', label: 'Supplier ID (kosongkan untuk auto)', example: '' },
  { key: 'supplier_name', label: 'Nama Supplier', example: 'PT Supplier Jaya', required: true },
  { key: 'contact', label: 'Contact Person', example: 'Budi' },
  { key: 'phone', label: 'Telepon', example: '08123456789' },
  { key: 'email', label: 'Email', example: 'budi@supplier.com' },
  { key: 'address', label: 'Alamat', example: 'Jl. Contoh No. 1' },
  { key: 'payment_terms', label: 'Payment Terms', example: 'Net 30' },
];

const REPORT_COLUMNS: ReportColumn<Supplier>[] = [
  { key: 'supplier_id', header: 'Supplier ID' },
  { key: 'supplier_name', header: 'Supplier Name' },
  { key: 'contact', header: 'Contact' },
  { key: 'phone', header: 'Phone' },
  { key: 'email', header: 'Email' },
  { key: 'address', header: 'Address' },
  { key: 'payment_terms', header: 'Payment Terms' },
  { key: 'is_active', header: 'Status', render: (r) => <StatusBadge label={r.is_active ? 'Active' : 'Inactive'} tone={r.is_active ? 'green' : 'gray'} />, exportValue: (r) => (r.is_active ? 'Active' : 'Inactive') },
];
const DEFAULT_VISIBLE = REPORT_COLUMNS.map((c) => c.key);

export default function SuppliersTab() {
  const router = useRouter();
  const { data: session } = useSession();
  const isSuperAdmin = !!session?.user.isSuperAdmin;
  const [viewMode, setViewMode] = useViewMode('purchasing_suppliers_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('purchasing_suppliers_cols', DEFAULT_VISIBLE);
  const [isImportOpen, setIsImportOpen] = useState(false);
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
    <ListViewLayout
      primaryAction={
        <div className="flex items-center gap-2">
          <ReportViewControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            columns={REPORT_COLUMNS}
            visibleColumns={visibleCols}
            onVisibleColumnsChange={setVisibleCols}
            onExport={() => exportToExcel(suppliers, REPORT_COLUMNS, 'suppliers', 'Suppliers')}
          />
          {isSuperAdmin && (
            <Button variant="secondary" onClick={() => setIsImportOpen(true)}><Upload size={14} className="mr-1.5" />Import</Button>
          )}
          <Button onClick={openNew}><Plus size={14} className="mr-1.5" />Add Supplier</Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loading size="lg" /></div>
      ) : viewMode === 'report' ? (
        <ReportTable columns={REPORT_COLUMNS} visibleColumns={visibleCols} rows={suppliers} keyField={(r) => r.supplier_id} />
      ) : suppliers.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No suppliers found</p>
      ) : (
        suppliers.map((s) => (
          <ListRow
            key={s.supplier_id}
            onClick={() => router.push(`/dashboard/purchasing/supplier/${encodeURIComponent(s.supplier_id)}`)}
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

      {isSuperAdmin && (
        <BulkImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          title="Import Supplier"
          columns={IMPORT_COLUMNS}
          apiEndpoint="/api/suppliers/import"
          templateFilename="template_supplier"
          onImported={fetchSuppliers}
        />
      )}
    </ListViewLayout>
  );
}
