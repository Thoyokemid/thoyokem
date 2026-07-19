"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Loading from "@/components/ui/Loading";
import { ListViewLayout, ListRow, ListRowAvatar, StatusBadge } from "@/components/ui/ListView";
import { LeaveAttendance, StaffList } from "@/types";
import { getInitials } from "@/utils/format";
import { countLeaveDays, countUsedLeaveDays } from "@/utils/attendance";
import { Plus, Edit, Trash2, Search, ShieldOff, Cake, UserCog, X, CalendarDays } from "lucide-react";

const CATEGORY_STYLES: Record<string, string> = {
  sick: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  annual: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  personal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  emergency: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  sick: 'Sick Leave',
  annual: 'Annual Leave',
  personal: 'Personal Leave',
  emergency: 'Emergency Leave',
};

export default function StaffPage() {
  const { data: session, status } = useSession();
  const [staff, setStaff] = useState<StaffList[]>([]);
  const [leaves, setLeaves] = useState<LeaveAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffList | null>(null);
  const [detailStaff, setDetailStaff] = useState<StaffList | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [birthdayFilter, setBirthdayFilter] = useState<'all' | 'has' | 'missing'>('all');

  const [formData, setFormData] = useState({
    name: "",
    registration_id: "",
    birth_date: "",
    leave_quota: "12",
  });

  useEffect(() => {
    if (session) fetchData();
  }, [session]);

  const fetchData = async () => {
    try {
      const [staffRes, leavesRes] = await Promise.all([
        fetch("/api/staff"),
        fetch("/api/leave"),
      ]);
      if (staffRes.ok) setStaff(await staffRes.json());
      if (leavesRes.ok) setLeaves(await leavesRes.json());
    } catch (error) {
      console.error("Error fetching staff:", error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        employee_name: formData.name,
        user_id: formData.registration_id,
        date_of_birth: formData.birth_date,
        leave_allocation: parseInt(formData.leave_quota, 10) || 12,
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
    setFormData({
      name: s.employee_name,
      registration_id: s.user_id,
      birth_date: s.date_of_birth || "",
      leave_quota: String(s.leave_allocation ?? 12),
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

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
    setFormData({ name: "", registration_id: "", birth_date: "", leave_quota: "12" });
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
        subtitle="Kelola data karyawan"
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
            <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {filteredStaff.length} of {staff.length} staff
            </div>
          </div>
        }
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">No staff found</p>
        ) : (
          filteredStaff.map((s) => (
            <ListRow
              key={s.employee_id}
              onClick={() => setDetailStaff(s)}
              avatar={<ListRowAvatar initials={getInitials(s.employee_name)} />}
              title={s.employee_name}
              subtitle={s.user_id || '-'}
              meta={
                <div className="flex items-center gap-1.5">
                  {s.date_of_birth && <Cake size={12} className="text-pink-400" />}
                  {s.date_of_birth || 'No birth date'}
                </div>
              }
              badges={<StatusBadge label={`${s.leave_allocation ?? 12} hari/tahun`} tone="purple" />}
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
          ))
        )}
      </ListViewLayout>

        <Modal isOpen={isModalOpen} onClose={resetForm} title={editingStaff ? "Edit Staff" : "Add Staff"} size="sm">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label-field">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="Nama lengkap karyawan"
                required
              />
            </div>

            <div>
              <label className="label-field">Registration ID</label>
              <input
                type="text"
                value={formData.registration_id}
                onChange={(e) => setFormData({ ...formData, registration_id: e.target.value })}
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
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Leave Quota</label>
                <input
                  type="number"
                  min={0}
                  value={formData.leave_quota}
                  onChange={(e) => setFormData({ ...formData, leave_quota: e.target.value })}
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

        {/* Detail Modal */}
        <Modal isOpen={!!detailStaff} onClose={() => setDetailStaff(null)} title="Detail Karyawan" size="lg">
          {detailStaff && (() => {
            const staffLeaves = leaves
              .filter((l) => l.employee === detailStaff.user_id)
              .sort((a, b) => b.from_date.localeCompare(a.from_date));
            const quota = detailStaff.leave_allocation ?? 12;
            const used = countUsedLeaveDays(leaves, detailStaff.user_id);
            const remaining = Math.max(0, quota - used);

            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(detailStaff.employee_name)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{detailStaff.employee_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{detailStaff.user_id || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2.5">
                    <p className="text-gray-500 dark:text-gray-400">Tanggal Lahir</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{detailStaff.date_of_birth || '-'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2.5">
                    <p className="text-gray-500 dark:text-gray-400">Kuota Cuti</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{quota} hari/tahun</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2.5">
                    <p className="text-gray-500 dark:text-gray-400">Sisa Kuota</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{remaining} / {quota} hari</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CalendarDays size={14} className="text-gray-500" />
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Riwayat Cuti ({staffLeaves.length})
                    </p>
                  </div>

                  {staffLeaves.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-md">
                      Belum ada riwayat cuti
                    </p>
                  ) : (
                    <div className="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-md">
                      <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-2.5 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dari</th>
                            <th className="px-2.5 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sampai</th>
                            <th className="px-2.5 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hari</th>
                            <th className="px-2.5 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategori</th>
                            <th className="px-2.5 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                          {staffLeaves.map((l) => (
                            <tr key={l.id}>
                              <td className="px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100">{l.from_date}</td>
                              <td className="px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100">{l.to_date}</td>
                              <td className="px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100">{countLeaveDays(l)}</td>
                              <td className="px-2.5 py-1.5 text-xs">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                  CATEGORY_STYLES[l.leave_type] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {CATEGORY_LABELS[l.leave_type] || l.leave_type}
                                </span>
                              </td>
                              <td className="px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 max-w-[160px] truncate" title={l.description}>
                                {l.description || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
                  <Button variant="secondary" onClick={() => setDetailStaff(null)}>
                    <X size={14} className="mr-1.5" />
                    Tutup
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      </>
    </DashboardLayout>
  );
}
