'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import BulkImportModal, { ImportColumn } from '@/components/ui/BulkImportModal';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { Customer } from '@/types';
import { Plus, Edit, Trash2, User, Upload } from 'lucide-react';

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

  const [formData, setFormData] = useState({ customer_id: '', customer_name: '', contact: '', phone: '', email: '', address: '', payment_terms: '', credit_limit: '' });

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
    setFormData({ customer_id: '', customer_name: '', contact: '', phone: '', email: '', address: '', payment_terms: '', credit_limit: '' });
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setFormData({ customer_id: c.customer_id, customer_name: c.customer_name, contact: c.contact, phone: c.phone, email: c.email, address: c.address, payment_terms: c.payment_terms, credit_limit: String(c.credit_limit) });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const payload = { ...formData, credit_limit: parseFloat(formData.credit_limit) || 0 };
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
    try {
      const res = await fetch(`/api/customers?customer_id=${customerId}`, { method: 'DELETE' });
      if (res.ok) fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
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
            onExport={() => exportToExcel(customers, REPORT_COLUMNS, 'customers', 'Customers')}
          />
          {isSuperAdmin && (
            <Button variant="secondary" onClick={() => setIsImportOpen(true)}><Upload size={14} className="mr-1.5" />Import</Button>
          )}
          <Button onClick={openNew}><Plus size={14} className="mr-1.5" />Add Customer</Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loading size="lg" /></div>
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
            subtitle={`${c.customer_id} · ${c.phone || c.contact || '-'}`}
            meta={c.payment_terms}
            badges={!c.is_active ? <StatusBadge label="Inactive" tone="red" /> : undefined}
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
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label-field">Customer ID</label>
            <input type="text" value={formData.customer_id} onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })} className="input-field" placeholder="Kosongkan untuk auto-generate" disabled={!!editing} />
          </div>
          <div>
            <label className="label-field">Customer Name</label>
            <input type="text" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} className="input-field" required />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Payment Terms</label>
              <input type="text" value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} className="input-field" placeholder="cth. Net 30" />
            </div>
            <div>
              <label className="label-field">Credit Limit</label>
              <input type="number" min={0} value={formData.credit_limit} onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })} className="input-field" />
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
        />
      )}
    </ListViewLayout>
  );
}
