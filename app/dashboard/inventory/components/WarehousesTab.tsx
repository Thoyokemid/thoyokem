'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import BulkImportModal, { ImportColumn } from '@/components/ui/BulkImportModal';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { Warehouse } from '@/types';
import { Plus, Edit, Trash2, Warehouse as WarehouseIcon, Search, Upload } from 'lucide-react';

const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'warehouse_id', label: 'Warehouse ID (kosongkan untuk auto)', example: '' },
  { key: 'warehouse_name', label: 'Nama Warehouse', example: 'Gudang Utama', required: true },
  { key: 'location', label: 'Kota', example: 'Jakarta Selatan' },
  { key: 'pic', label: 'PIC', example: 'Budi' },
  { key: 'phone', label: 'Telepon', example: '08123456789' },
  { key: 'address', label: 'Alamat', example: 'Jl. Contoh No. 1' },
  { key: 'postal_code', label: 'Kode Pos', example: '12345' },
];

const REPORT_COLUMNS: ReportColumn<Warehouse>[] = [
  { key: 'warehouse_id', header: 'Warehouse ID' },
  { key: 'warehouse_name', header: 'Warehouse Name' },
  { key: 'location', header: 'City' },
  { key: 'pic', header: 'PIC' },
  { key: 'phone', header: 'Phone' },
  { key: 'address', header: 'Address' },
  { key: 'postal_code', header: 'Postal Code' },
  { key: 'is_active', header: 'Status', render: (r) => <StatusBadge label={r.is_active ? 'Active' : 'Inactive'} tone={r.is_active ? 'green' : 'gray'} />, exportValue: (r) => (r.is_active ? 'Active' : 'Inactive') },
];
const DEFAULT_VISIBLE = REPORT_COLUMNS.map((c) => c.key);

interface City {
  id: string;
  name: string;
  type: 'Kota' | 'Kabupaten';
  province: string;
}

function CityPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<City[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const justSelectedRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (justSelectedRef.current || !query.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) setResults(await res.json());
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const select = (city: City) => {
    const label = `${city.type} ${city.name}, ${city.province}`;
    justSelectedRef.current = true;
    onChange(label);
    setQuery(label);
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Cari kota..."
          className="input-field pl-8"
        />
      </div>
      {isOpen && query.trim().length > 0 && query !== value && (
        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
          {isSearching ? (
            <p className="px-3 py-2 text-xs text-gray-400 text-center">Mencari...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400 text-center">Tidak ada hasil</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c)}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {c.type} {c.name} <span className="text-gray-400">· {c.province}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function WarehousesTab() {
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
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useViewMode('inventory_warehouses_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('inventory_warehouses_cols', DEFAULT_VISIBLE);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses');
      if (!res.ok) throw new Error('Failed to fetch warehouses');
      return (await res.json()) as Warehouse[];
    },
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({ warehouse_name: '', location: '', pic: '', phone: '', address: '', postal_code: '' });

  const openNew = () => {
    setEditingWarehouse(null);
    setFormData({ warehouse_name: '', location: '', pic: '', phone: '', address: '', postal_code: '' });
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditingWarehouse(w);
    setFormData({
      warehouse_name: w.warehouse_name,
      location: w.location,
      pic: w.pic || '',
      phone: w.phone || '',
      address: w.address || '',
      postal_code: w.postal_code || '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const payload = editingWarehouse
        ? { warehouse_id: editingWarehouse.warehouse_id, ...formData }
        : { ...formData };

      const res = editingWarehouse
        ? await fetch('/api/warehouses', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/warehouses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

      if (res.ok) {
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['warehouses'] });
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
      if (res.ok) queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    } catch (error) {
      console.error('Error deleting warehouse:', error);
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
            onExport={() => exportToExcel(warehouses, REPORT_COLUMNS, 'warehouses', 'Warehouses')}
          />
          {isSuperAdmin && (
            <Button variant="secondary" onClick={() => setIsImportOpen(true)}>
              <Upload size={14} className="mr-1.5" />
              Import
            </Button>
          )}
          <Button onClick={openNew}>
            <Plus size={14} className="mr-1.5" />
            Add Warehouse
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" />
        </div>
      ) : viewMode === 'report' ? (
        <ReportTable columns={REPORT_COLUMNS} visibleColumns={visibleCols} rows={warehouses} keyField={(r) => r.warehouse_id} />
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
          {editingWarehouse && (
            <div>
              <label className="label-field">Warehouse ID</label>
              <input type="text" value={editingWarehouse.warehouse_id} className="input-field" disabled />
            </div>
          )}
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
            <label className="label-field">City</label>
            <CityPicker value={formData.location} onChange={(v) => setFormData({ ...formData, location: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">PIC</label>
              <input type="text" value={formData.pic} onChange={(e) => setFormData({ ...formData, pic: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Phone Number</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-field">Address</label>
            <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Postal Code</label>
            <input type="text" value={formData.postal_code} onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })} className="input-field" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>{editingWarehouse ? 'Update' : 'Add'} Warehouse</Button>
          </div>
        </form>
      </Modal>

      {isSuperAdmin && (
        <BulkImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          title="Import Warehouse"
          columns={IMPORT_COLUMNS}
          apiEndpoint="/api/warehouses/import"
          templateFilename="template_warehouse"
          onImported={() => queryClient.invalidateQueries({ queryKey: ['warehouses'] })}
        />
      )}
    </ListViewLayout>
  );
}
