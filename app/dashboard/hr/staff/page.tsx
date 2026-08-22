"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams, usePathname } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Loading from "@/components/ui/Loading";
import { SkeletonList } from "@/components/ui/Skeleton";
import Pagination from "@/components/ui/Pagination";
import { ColumnDef } from "@/components/ui/ColumnPicker";
import {
  ListViewLayout,
  ListRow,
  ListRowAvatar,
  StatusBadge,
  ViewModeDropdown,
  ViewMode,
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuColumns,
  SavedViewsMenu,
  ListSelectionBar,
} from "@/components/ui/ListView";
import { StaffList } from "@/types";
import { getInitials } from "@/utils/format";
import { Plus, Edit, Trash2, Search, ShieldOff, Cake, UserCog, Download, Ban } from "lucide-react";
import * as XLSX from "xlsx";
import { logExport } from "@/lib/logExport";
import { formatDate } from "@/lib/date";
import { useSavedViews } from "@/lib/savedViews";
import toast from "react-hot-toast";

// Mirrors staffCreateSchema's fields (lib/validation.ts) under the form's own field
// names — mapped to the API's names in onSubmit — with name required client-side.
const staffFormSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  registration_id: z.string().optional(),
  birth_date: z.string().optional(),
  leave_quota: z.coerce.number().optional(),
});
type StaffFormInput = z.input<typeof staffFormSchema>;
type StaffFormValues = z.output<typeof staffFormSchema>;

const STAFF_COLUMNS: ColumnDef[] = [
  { key: "employee_name", header: "Name" },
  { key: "user_id", header: "Registration ID" },
  { key: "date_of_birth", header: "Birth Date" },
  { key: "leave_allocation", header: "Leave Quota" },
];
const DEFAULT_VISIBLE_COLS = ["employee_name", "user_id", "date_of_birth", "leave_allocation"];
const PAGE_SIZE = 10;

export default function StaffPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      resetForm();
      setIsModalOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('new');
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [staff, setStaff] = useState<StaffList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffList | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [birthdayFilter, setBirthdayFilter] = useState<'all' | 'has' | 'missing'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE_COLS);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  interface StaffFilters {
    searchName: string;
    birthdayFilter: 'all' | 'has' | 'missing';
  }
  const { views: savedViews, saveView, deleteView } = useSavedViews<StaffFilters>('hr_staff');
  const applyView = (f: StaffFilters) => {
    setSearchName(f.searchName);
    setBirthdayFilter(f.birthdayFilter);
  };

  const {
    register,
    handleSubmit: handleFormSubmit,
    reset: resetFormFields,
    formState: { errors: formErrors },
  } = useForm<StaffFormInput, any, StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: { name: '', registration_id: '', birth_date: '', leave_quota: 12 },
  });

  useEffect(() => {
    if (session) fetchData();
  }, [session]);

  const fetchData = async () => {
    setLoadError(false);
    try {
      const staffRes = await fetch("/api/staff");
      if (staffRes.ok) setStaff(await staffRes.json());
      else setLoadError(true);
    } catch (error) {
      console.error("Error fetching staff:", error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStaff = useMemo(() => {
    let result = staff;
    if (searchName.trim()) {
      const q = searchName.toLowerCase();
      result = result.filter((s) => s.employee_name.toLowerCase().includes(q));
    }
    if (birthdayFilter === 'has') result = result.filter((s) => !!s.date_of_birth);
    if (birthdayFilter === 'missing') result = result.filter((s) => !s.date_of_birth);
    return result;
  }, [staff, searchName, birthdayFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchName, birthdayFilter, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const paginatedStaff = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStaff.slice(start, start + PAGE_SIZE);
  }, [filteredStaff, page]);

  const handleExport = () => {
    const exportData = filteredStaff.map((s) => ({
      Name: s.employee_name,
      'Registration ID': s.user_id,
      'Birth Date': s.date_of_birth || '',
      'Leave Quota': s.leave_allocation ?? 12,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Staff');
    XLSX.writeFile(workbook, `staff_${new Date().toISOString().split('T')[0]}.xlsx`);
    logExport('Staff', exportData.length);
  };

  const onSubmit = async (data: StaffFormValues) => {
    setIsSaving(true);
    try {
      const payload = {
        employee_name: data.name,
        user_id: data.registration_id,
        date_of_birth: data.birth_date,
        leave_allocation: data.leave_quota ?? 12,
      };

      const response = editingStaff
        ? await fetch("/api/staff", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employee_id: editingStaff.employee_id, ...payload }),
          })
        : await fetch("/api/staff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (response.ok) {
        resetForm();
        fetchData();
      }
    } catch (error) {
      console.error("Error saving staff:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (s: StaffList) => {
    setEditingStaff(s);
    resetFormFields({
      name: s.employee_name,
      registration_id: s.user_id,
      birth_date: s.date_of_birth || "",
      leave_quota: s.leave_allocation ?? 12,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus data karyawan ini? Tindakan ini tidak bisa dibatalkan.")) return;
    try {
      const response = await fetch(`/api/staff?id=${id}`, { method: "DELETE" });
      if (response.ok) fetchData();
    } catch (error) {
      console.error("Error deleting staff:", error);
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

  const handleBulkDelete = async () => {
    if (!confirm(`Hapus ${selectedIds.size} data karyawan terpilih? Tindakan ini tidak bisa dibatalkan.`)) return;
    setIsBulkBusy(true);
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) => fetch(`/api/staff?id=${id}`, { method: "DELETE" }))
      );
      const failed = results.filter((r) => !r.ok).length;
      toast[failed > 0 ? 'error' : 'success'](
        failed > 0 ? `${failed} dari ${selectedIds.size} gagal dihapus` : `${selectedIds.size} data karyawan dihapus`
      );
      setSelectedIds(new Set());
      fetchData();
    } catch (error) {
      console.error("Error bulk-deleting staff:", error);
      toast.error("Gagal menghapus data terpilih");
    } finally {
      setIsBulkBusy(false);
    }
  };

  const handleBulkExport = () => {
    const rows = filteredStaff.filter((s) => selectedIds.has(s.employee_id));
    const exportData = rows.map((s) => ({
      Name: s.employee_name,
      'Registration ID': s.user_id,
      'Birth Date': s.date_of_birth || '',
      'Leave Quota': s.leave_allocation ?? 12,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Staff');
    XLSX.writeFile(workbook, `staff_selected_${new Date().toISOString().split('T')[0]}.xlsx`);
    logExport('Staff', exportData.length);
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
    resetFormFields({ name: "", registration_id: "", birth_date: "", leave_quota: 12 });
  };

  if (status !== "loading" && !session) redirect("/login");
  if (status === "loading") return <div className="flex items-center justify-center min-h-screen"><Loading size="lg" /></div>;
  if (!session) return null;

  if (!session.user.permissions.staff) {
    return (
      <DashboardLayout
        user={{
          id: session.user.id,
          username: session.user.email || "",
          name: session.user.name ?? "",
          role: session.user.role,
          permissions: session.user.permissions,
        }}
      >
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ShieldOff size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Access Restricted</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            You don't have permission to view Staff Management.<br />
            Please contact an administrator.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      user={{
        id: session.user.id,
        username: session.user.email || "",
        name: session.user.name ?? "",
        role: session.user.role,
        permissions: session.user.permissions,
      }}
    >
      <>
      <ListViewLayout
        title="Staff Management"
        primaryAction={
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            Add Staff
          </Button>
        }
        filterGroups={[
          {
            title: 'Tanggal Lahir',
            filters: [
              { label: 'Semua', value: 'all', active: birthdayFilter === 'all', onClick: () => setBirthdayFilter('all'), count: staff.length },
              { label: 'Sudah diisi', value: 'has', active: birthdayFilter === 'has', onClick: () => setBirthdayFilter('has'), count: staff.filter((s) => !!s.date_of_birth).length },
              { label: 'Belum diisi', value: 'missing', active: birthdayFilter === 'missing', onClick: () => setBirthdayFilter('missing'), count: staff.filter((s) => !s.date_of_birth).length },
            ],
          },
        ]}
        toolbar={
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Cari nama karyawan..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="input-field pl-9"
              />
            </div>
            <SavedViewsMenu
              views={savedViews}
              onApply={applyView}
              onSave={(name) => saveView(name, { searchName, birthdayFilter })}
              onDelete={deleteView}
            />
            <ViewModeDropdown mode={viewMode} onChange={setViewMode} />
            <OverflowMenu>
              {viewMode === 'report' && (
                <OverflowMenuColumns columns={STAFF_COLUMNS} visible={visibleCols} onChange={setVisibleCols} />
              )}
              <OverflowMenuItem icon={Download} onClick={handleExport}>
                Export
              </OverflowMenuItem>
            </OverflowMenu>
            <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {filteredStaff.length} of {staff.length} staff
            </div>
          </div>
        }
      >
        {viewMode === 'list' && (
          <ListSelectionBar
            count={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            actions={[
              { label: 'Export', icon: Download, onClick: handleBulkExport },
              { label: 'Hapus', icon: Ban, variant: 'danger', disabled: isBulkBusy, onClick: handleBulkDelete },
            ]}
          />
        )}
        {isLoading ? (
          <SkeletonList />
        ) : loadError ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-red-500 mb-2">Gagal memuat data — coba lagi.</p>
            <button onClick={fetchData} className="text-xs text-primary hover:underline">Coba lagi</button>
          </div>
        ) : filteredStaff.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">No staff found</p>
        ) : viewMode === 'list' ? (
          <>
            {paginatedStaff.map((s) => (
              <ListRow
                key={s.employee_id}
                onClick={() => router.push(`/dashboard/hr/staff/${encodeURIComponent(s.employee_id)}`)}
                avatar={<ListRowAvatar initials={getInitials(s.employee_name)} />}
                title={s.employee_name}
                subtitle={s.user_id || '-'}
                meta={
                  <div className="flex items-center gap-1.5">
                    {s.date_of_birth && <Cake size={12} className="text-pink-400" />}
                    {s.date_of_birth ? formatDate(s.date_of_birth) : 'No birth date'}
                  </div>
                }
                badges={<StatusBadge label={`${s.leave_allocation ?? 12} hari/tahun`} tone="purple" />}
                selected={selectedIds.has(s.employee_id)}
                onSelectChange={(checked) => toggleSelect(s.employee_id, checked)}
                actions={
                  <>
                    <button onClick={() => handleEdit(s)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(s.employee_id)} className="text-red-600 hover:text-red-800 dark:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </>
                }
              />
            ))}
            <div className="px-4 pb-3">
              <Pagination page={page} totalPages={totalPages} totalItems={filteredStaff.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </div>
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    {STAFF_COLUMNS.filter((c) => visibleCols.includes(c.key)).map((col) => (
                      <th key={col.key} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {col.header}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {paginatedStaff.map((s) => (
                    <tr key={s.employee_id} onClick={() => router.push(`/dashboard/hr/staff/${encodeURIComponent(s.employee_id)}`)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                      {STAFF_COLUMNS.filter((c) => visibleCols.includes(c.key)).map((col) => (
                        <td key={col.key} className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300">
                          {String((s as any)[col.key] ?? '-')}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-xs">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleEdit(s)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDelete(s.employee_id)} className="text-red-600 hover:text-red-800 dark:text-red-400">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-3 pt-1">
              <Pagination page={page} totalPages={totalPages} totalItems={filteredStaff.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </div>
          </>
        )}
      </ListViewLayout>

        <Modal isOpen={isModalOpen} onClose={resetForm} title={editingStaff ? "Edit Staff" : "Add Staff"} size="sm">
          <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-3">
            <div>
              <label className="label-field">Full Name</label>
              <input
                type="text"
                {...register('name')}
                className="input-field"
                placeholder="Nama lengkap karyawan"
              />
              {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name.message}</p>}
            </div>

            <div>
              <label className="label-field">Registration ID</label>
              <input
                type="text"
                {...register('registration_id')}
                className="input-field"
                placeholder="cth. TYID0120814"
              />
              <p className="text-xs text-gray-400 mt-1">Dipakai untuk menghubungkan data cuti karyawan ini.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Birth Date</label>
                <input
                  type="date"
                  {...register('birth_date')}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Leave Quota</label>
                <input
                  type="number"
                  min={0}
                  {...register('leave_quota')}
                  className="input-field"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3">
              <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={isSaving}>
                <UserCog size={14} className="mr-1.5" />
                {editingStaff ? "Update" : "Add"} Staff
              </Button>
            </div>
          </form>
        </Modal>

      </>
    </DashboardLayout>
  );
}
