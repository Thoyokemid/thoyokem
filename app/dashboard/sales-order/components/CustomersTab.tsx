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
import { Customer } from '@/types';
import { customerImportRowSchema, customerCreateSchema } from '@/lib/validation';
import { Plus, Edit, Trash2, User, Upload, Ban, Download } from 'lucide-react';
import toast from 'react-hot-toast';

// Same shape the API validates against (lib/validation.ts), just with customer_name
// tightened to required for immediate client-side feedback instead of only on submit.
const customerFormSchema = customerCreateSchema.extend({
  customer_name: z.string().min(1, 'Nama customer wajib diisi'),
});
type CustomerFormInput = z.input<typeof customerFormSchema>;
type CustomerFormValues = z.output<typeof customerFormSchema>;

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'customer_id', label: 'Customer ID (kosongkan untuk auto)', example: '' },
  { key: 'customer_name', label: 'Nama Customer', example: 'PT Contoh Jaya', required: true },
  { key: 'contact', label: 'Contact Person', example: 'Budi' },
  { key: 'phone', label: 'Telepon', example: '08123456789' },
  { key: 'email', label: 'Email', example: 'budi@contoh.com' },
  { key: 'address', label: 'Alamat', example: 'Jl. Contoh No. 1' },
  { key: 'payment_terms', label: 'Payment Terms', example: 'Net 30' },
  { key: 'credit_limit', label: 'Credit Limit', example: '0' },
];

const REPORT_COLUMNS: ReportColumn<Customer>[] = [
  { key: 'customer_id', header: 'Customer ID' },
  { key: 'customer_name', header: 'Customer Name' },
  { key: 'contact', header: 'Contact' },
  { key: 'phone', header: 'Phone' },
  { key: 'email', header: 'Email' },
  { key: 'address', header: 'Address' },
  { key: 'payment_terms', header: 'Payment Terms' },
  { key: 'credit_limit', header: 'Credit Limit', align: 'right', render: (r) => r.credit_limit.toLocaleString('id-ID') },
  { key: 'is_active', header: 'Status', render: (r) => <StatusBadge label={r.is_active ? 'Active' : 'Inactive'} tone={r.is_active ? 'green' : 'gray'} />, exportValue: (r) => (r.is_active ? 'Active' : 'Inactive') },
];
const DEFAULT_VISIBLE = REPORT_COLUMNS.map((c) => c.key);

export default function CustomersTab() {
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
  const [viewMode, setViewMode] = useViewMode('sales_customers_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('sales_customers_cols', DEFAULT_VISIBLE);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  const {
    register,
    handleSubmit: handleFormSubmit,
    reset: resetForm,
    formState: { errors: formErrors },
  } = useForm<CustomerFormInput, any, CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { customer_id: '', customer_name: '', contact: '', phone: '', email: '', address: '', payment_terms: '', credit_limit: 0 },
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) setCustomers(await res.json());
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    resetForm({ customer_id: '', customer_name: '', contact: '', phone: '', email: '', address: '', payment_terms: '', credit_limit: 0 });
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    resetForm({ customer_id: c.customer_id, customer_name: c.customer_name, contact: c.contact, phone: c.phone, email: c.email, address: c.address, payment_terms: c.payment_terms, credit_limit: c.credit_limit });
    setError('');
    setIsModalOpen(true);
  };

  const onSubmit = async (data: CustomerFormValues) => {
    setIsSaving(true);
    setError('');
    try {
      const payload = editing ? { ...data, customer_id: editing.customer_id } : data;
      const res = editing
        ? await fetch('/api/customers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

      if (res.ok) {
        setIsModalOpen(false);
        fetchCustomers();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menyimpan customer');
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      setError('Gagal menyimpan customer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (customerId: string) => {
    if (!confirm('Hapus customer ini?')) return;
    // Optimistic: remove immediately, re-insert just this row on failure. Using a functional
    // update (not a captured full-array snapshot) so a concurrent delete of another row that
    // already succeeded isn't clobbered back in by this rollback.
    const removed = customers.find((c) => c.customer_id === customerId);
    setCustomers((prev) => prev.filter((c) => c.customer_id !== customerId));
    const restore = () => {
      if (!removed) return;
      setCustomers((prev) => (prev.some((c) => c.customer_id === customerId) ? prev : [...prev, removed]));
    };
    try {
      const res = await fetch(`/api/customers?customer_id=${customerId}`, { method: 'DELETE' });
      if (!res.ok) {
        restore();
        toast.error('Gagal menghapus customer');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      restore();
      toast.error('Gagal menghapus customer');
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
    if (!confirm(`Nonaktifkan ${selectedIds.size} customer terpilih?`)) return;
    setIsBulkBusy(true);
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch('/api/customers', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_id: id, is_active: false }),
          })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      toast[failed > 0 ? 'error' : 'success'](
        failed > 0 ? `${failed} dari ${selectedIds.size} gagal dinonaktifkan` : `${selectedIds.size} customer dinonaktifkan`
      );
      setSelectedIds(new Set());
      fetchCustomers();
    } catch (error) {
      console.error('Error bulk-deactivating customers:', error);
      toast.error('Gagal menonaktifkan customer terpilih');
    } finally {
      setIsBulkBusy(false);
    }
  };

  const handleBulkExport = () => {
    const rows = customers.filter((c) => selectedIds.has(c.customer_id));
    exportToExcel(rows, REPORT_COLUMNS, 'customers_selected', 'Customers');
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
            onExport={() => exportToExcel(customers, REPORT_COLUMNS, 'customers', 'Customers')}
          />
          {isSuperAdmin && (
            <Button variant="secondary" onClick={() => setIsImportOpen(true)}><Upload size={14} className="mr-1.5" />Import</Button>
          )}
          <Button onClick={openNew}><Plus size={14} className="mr-1.5" />Add Customer</Button>
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
        <ReportTable columns={REPORT_COLUMNS} visibleColumns={visibleCols} rows={customers} keyField={(r) => r.customer_id} />
      ) : customers.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No customers found</p>
      ) : (
        customers.map((c) => (
          <ListRow
            key={c.customer_id}
            onClick={() => router.push(`/dashboard/sales-order/customer/${encodeURIComponent(c.customer_id)}`)}
            avatar={<span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center"><User size={14} /></span>}
            title={c.customer_name}
            statusTone={c.is_active ? 'green' : 'red'}
            subtitle={`${c.customer_id} · ${c.phone || c.contact || '-'}`}
            meta={c.payment_terms}
            badges={!c.is_active ? <StatusBadge label="Inactive" tone="red" /> : undefined}
            selected={selectedIds.has(c.customer_id)}
            onSelectChange={(checked) => toggleSelect(c.customer_id, checked)}
            actions={
              <>
                <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400"><Edit size={14} /></button>
                <button onClick={() => handleDelete(c.customer_id)} className="text-red-600 hover:text-red-800 dark:text-red-400"><Trash2 size={14} /></button>
              </>
            }
          />
        ))
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'Edit Customer' : 'Add Customer'} size="sm">
        <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="label-field">Customer ID</label>
            <input type="text" {...register('customer_id')} className="input-field" placeholder="Kosongkan untuk auto-generate" disabled={!!editing} />
          </div>
          <div>
            <label className="label-field">Customer Name</label>
            <input type="text" {...register('customer_name')} className="input-field" />
            {formErrors.customer_name && <p className="text-xs text-red-600 mt-1">{formErrors.customer_name.message}</p>}
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
            {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email.message}</p>}
          </div>
          <div>
            <label className="label-field">Address</label>
            <input type="text" {...register('address')} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Payment Terms</label>
              <input type="text" {...register('payment_terms')} className="input-field" placeholder="cth. Net 30" />
            </div>
            <div>
              <label className="label-field">Credit Limit</label>
              <input type="number" min={0} {...register('credit_limit')} className="input-field" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>{editing ? 'Update' : 'Add'} Customer</Button>
          </div>
        </form>
      </Modal>

      {isSuperAdmin && (
        <BulkImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          title="Import Customer"
          columns={IMPORT_COLUMNS}
          apiEndpoint="/api/customers/import"
          templateFilename="template_customer"
          onImported={fetchCustomers}
          rowSchema={customerImportRowSchema}
        />
      )}
    </ListViewLayout>
  );
}
