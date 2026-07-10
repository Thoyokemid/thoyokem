"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Loading from "@/components/ui/Loading";
import { StaffList } from "@/types";
import { getInitials } from "@/utils/format";
import { Plus, Edit, Trash2, Search, ShieldOff, Cake, UserCog } from "lucide-react";

export default function StaffPage() {
  const { data: session, status } = useSession();
  const [staff, setStaff] = useState<StaffList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffList | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchName, setSearchName] = useState('');

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
      const res = await fetch("/api/staff");
      if (res.ok) setStaff(await res.json());
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStaff = useMemo(() => {
    if (!searchName.trim()) return staff;
    const q = searchName.toLowerCase();
    return staff.filter((s) => s.name.toLowerCase().includes(q));
  }, [staff, searchName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        registration_id: formData.registration_id,
        birth_date: formData.birth_date,
        leave_quota: parseInt(formData.leave_quota, 10) || 12,
      };

      const response = editingStaff
        ? await fetch("/api/staff", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingStaff.id, ...payload }),
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
      name: s.name,
      registration_id: s.registration_id,
      birth_date: s.birth_date || "",
      leave_quota: String(s.leave_quota ?? 12),
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
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Staff Management</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Kelola data karyawan</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            Add Staff
          </Button>
        </div>

        <Card>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Cari nama karyawan..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="input-field pl-9"
              />
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Showing {filteredStaff.length} of {staff.length} staff
          </div>
        </Card>

        {isLoading ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-12">
              <Loading size="lg" />
            </div>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Registration ID</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Birth Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leave Quota</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">No staff found</td>
                    </tr>
                  ) : (
                    filteredStaff.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                              {getInitials(s.name)}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 font-mono">{s.registration_id || '-'}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-1.5">
                            {s.birth_date && <Cake size={12} className="text-pink-400" />}
                            {s.birth_date || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                            {s.leave_quota ?? 12} hari/tahun
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex gap-2">
                            <button onClick={() => handleEdit(s)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800 dark:text-red-400">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

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
      </div>
    </DashboardLayout>
  );
}
