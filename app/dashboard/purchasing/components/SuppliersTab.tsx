'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { SkeletonList } from '@/components/ui/Skeleton';
import BulkImportModal, { ImportColumn } from '@/components/ui/BulkImportModal';
import { ListViewLayout, ListRow, StatusBadge, ListSelectionBar } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { Supplier } from '@/types';
import { supplierImportRowSchema, supplierCreateSchema } from '@/lib/validation';
import { Plus, Edit, Trash2, Truck, Upload, Ban, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const supplierFormSchema = supplierCreateSchema.extend({
  supplier_name: z.string().min(1, 'Nama supplier wajib diisi'),
});
type SupplierFormValues = z.infer<typeof supplierFormSchema>;

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
  const [viewMode, setViewMode] = useViewMode('purchasing_suppliers_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('purchasing_suppliers_cols', DEFAULT_VISIBLE);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  const {
    register,
    handleSubmit: handleFormSubmit,
    reset: resetForm,
    formState: { errors: formErrors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: { supplier_id: '', supplier_name: '', contact: '', phone: '', email: '', address: '', payment_terms: '' },
  });

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
    resetForm({ supplier_id: '', supplier_name: '', contact: '', phone: '', email: '', address: '', payment_terms: '' });
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    resetForm({ supplier_id: s.supplier_id, supplier_name: s.supplier_name, contact: s.contact, phone: s.phone, email: s.email, address: s.address, payment_terms: s.payment_terms });
    setError('');
    setIsModalOpen(true);
  };

  const onSubmit = async (data: SupplierFormValues) => {
    setIsSaving(true);
    setError('');
    try {
      const payload = editing ? { ...data, supplier_id: editing.supplier_id } : data;
      const res = editing
        ? await fetch('/api/suppliers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

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
    const removed = suppliers.find((s) => s.supplier_id === supplierId);
    setSuppliers((prev) => prev.filter((s) => s.supplier_id !== supplierId));
    const restore = () => {
      if (!removed) return;
      setSuppliers((prev) => (prev.some((s) => s.supplier_id === supplierId) ? prev : [...prev, removed]));
    };
    try {
      const res = await fetch(`/api/suppliers?supplier_id=${supplierId}`, { method: 'DELETE' });
      if (!res.ok) {
        restore();
        toast.error('Gagal menghapus supplier');
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      restore();
      toast.error('Gagal menghapus supplier');
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
    if (!confirm(`Nonaktifkan ${selectedIds.size} supplier terpilih?`)) return;
    setIsBulkBusy(true);
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch('/api/suppliers', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ supplier_id: id, is_active: false }),
          })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      toast[failed > 0 ? 'error' : 'success'](
        failed > 0 ? `${failed} dari ${selectedIds.size} gagal dinonaktifkan` : `${selectedIds.size} supplier dinonaktifkan`
      );
      setSelectedIds(new Set());
      fetchSuppliers();
    } catch (error) {
      console.error('Error bulk-deactivating suppliers:', error);
      toast.error('Gagal menonaktifkan supplier terpilih');
    } finally {
      setIsBulkBusy(false);
    }
  };

  const handleBulkExport = () => {
    const rows = suppliers.filter((s) => selectedIds.has(s.supplier_id));
    exportToExcel(rows, REPORT_COLUMNS, 'suppliers_selected', 'Suppliers');
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
            doctype="Supplier"
          />
          {isSuperAdmin && (
            <Button variant="secondary" onClick={() => setIsImportOpen(true)}><Upload size={14} className="mr-1.5" />Import</Button>
          )}
          <Button onClick={openNew}><Plus size={14} className="mr-1.5" />Add Supplier</Button>
        </div>
      }
    >
      {viewMode === 'list' && (
        <ListSelectionBar
          count={selectedIds.size}
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
            statusTone={s.is_active ? 'green' : 'red'}
            subtitle={`${s.supplier_id} · ${s.phone || s.contact || '-'}`}
            meta={s.payment_terms}
            badges={!s.is_active ? <StatusBadge label="Inactive" tone="red" /> : undefined}
            selected={selectedIds.has(s.supplier_id)}
            onSelectChange={(checked) => toggleSelect(s.supplier_id, checked)}
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
        <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="label-field">Supplier ID</label>
            <input type="text" {...register('supplier_id')} className="input-field" placeholder="Kosongkan untuk auto-generate" disabled={!!editing} />
          </div>
          <div>
            <label className="label-field">Supplier Name</label>
            <input type="text" {...register('supplier_name')} className="input-field" />
            {formErrors.supplier_name && <p className="text-xs text-red-600 mt-1">{formErrors.supplier_name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Contact Person</label>
              <input type="text" {...register('contact')} className="input-field" />
            </div>
            <div>
              <label className="label-field">Phone</label>
              <input type="text" {...register('phone')} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-field">Email</label>
            <input type="email" {...register('email')} className="input-field" />
          </div>
          <div>
            <label className="label-field">Address</label>
            <input type="text" {...register('address')} className="input-field" />
          </div>
          <div>
            <label className="label-field">Payment Terms</label>
            <input type="text" {...register('payment_terms')} className="input-field" placeholder="cth. Net 30" />
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
          rowSchema={supplierImportRowSchema}
        />
      )}
    </ListViewLayout>
  );
}
