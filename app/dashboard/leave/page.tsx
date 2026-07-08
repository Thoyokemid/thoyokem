"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Loading from "@/components/ui/Loading";
import { LeaveAttendance, StaffList } from "@/types";
import { Plus, Calendar, Edit, Trash2, Upload, FileText, Search, ChevronUp, ChevronDown, ChevronsUpDown, ShieldOff } from "lucide-react";

type SortField = 'name' | 'date_from' | 'date_end' | 'category' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function LeavePage() {
  const { data: session, status } = useSession();
  const [leaves, setLeaves] = useState<LeaveAttendance[]>([]);
  const [staff, setStaff] = useState<StaffList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveAttendance | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [searchName, setSearchName] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [formData, setFormData] = useState({
    staff_id: "",
    date_from: "",
    date_end: "",
    category: "sick",
    link_url: "",
    keterangan: "",
  });

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      const [leavesRes, staffRes] = await Promise.all([
        fetch("/api/leave"),
        fetch("/api/staff"),
      ]);

      if (leavesRes.ok) setLeaves(await leavesRes.json());
      if (staffRes.ok) setStaff(await staffRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLeaves = useMemo(() => {
    let result = [...leaves];

    if (searchName.trim()) {
      const q = searchName.toLowerCase();
      result = result.filter((l) => l.name.toLowerCase().includes(q));
    }
    if (filterCategory) result = result.filter((l) => l.category === filterCategory);
    if (filterDateFrom) result = result.filter((l) => l.date_from >= filterDateFrom);
    if (filterDateTo) result = result.filter((l) => l.date_end <= filterDateTo);

    result.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [leaves, searchName, filterCategory, filterDateFrom, filterDateTo, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown size={12} className="opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const uniqueNames = useMemo(() =>
    Array.from(new Set(leaves.map((l) => l.name))).sort(),
  [leaves]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const uploadFile = async (): Promise<string> => {
    if (!uploadedFile) return "";
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadedFile);
      const response = await fetch("/api/upload", { method: "POST", body: fd });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file");
      return "";
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let fileUrl = formData.link_url;
    if (uploadedFile) {
      fileUrl = await uploadFile();
      if (!fileUrl) return;
    }

    if (editingLeave) {
      try {
        const response = await fetch("/api/leave", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingLeave.id,
            date_from: formData.date_from,
            date_end: formData.date_end,
            category: formData.category,
            link_url: fileUrl,
            keterangan: formData.keterangan,
          }),
        });
        if (response.ok) { resetForm(); fetchData(); }
      } catch (error) {
        console.error("Error updating leave:", error);
      }
    } else {
      const selectedStaff = staff.find((s) => s.id === formData.staff_id);
      if (!selectedStaff) return;
      try {
        const response = await fetch("/api/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registration_id: selectedStaff.registration_id,
            name: selectedStaff.name,
            date_from: formData.date_from,
            date_end: formData.date_end,
            category: formData.category,
            link_url: fileUrl,
            keterangan: formData.keterangan,
          }),
        });
        if (response.ok) { resetForm(); fetchData(); }
      } catch (error) {
        console.error("Error creating leave:", error);
      }
    }
  };

  const handleEdit = (leave: LeaveAttendance) => {
    setEditingLeave(leave);
    setFormData({ staff_id: "", date_from: leave.date_from, date_end: leave.date_end, category: leave.category, link_url: leave.link_url, keterangan: leave.keterangan || "" });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this leave request?")) return;
    try {
      const response = await fetch(`/api/leave?id=${id}`, { method: "DELETE" });
      if (response.ok) fetchData();
    } catch (error) {
      console.error("Error deleting leave:", error);
    }
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingLeave(null);
    setUploadedFile(null);
    setFormData({ staff_id: "", date_from: "", date_end: "", category: "sick", link_url: "", keterangan: "" });
  };

  const clearFilters = () => {
    setSearchName('');
    setFilterCategory('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  if (status !== "loading" && !session) redirect("/login");
  if (status === "loading") return <div className="flex items-center justify-center min-h-screen"><Loading size="lg" /></div>;
  if (!session) return null;

  // ── Permission guard ──────────────────────────────────────────────────────
  if (!session.user.permissions.leave) {
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
            You don't have permission to view Leave Management.<br />
            Please contact an administrator.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const ThBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon field={field} />
      </div>
    </th>
  );

  const hasActiveFilter = searchName || filterCategory || filterDateFrom || filterDateTo;

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leave Management</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage employee leave requests</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            Add Leave
          </Button>
        </div>

        <Card>
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="text"
                  placeholder="Filter by employee name..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="input-field pl-9"
                />
              </div>
              <div className="w-full md:w-44">
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input-field">
                  <option value="">All Categories</option>
                  <option value="sick">Sick Leave</option>
                  <option value="annual">Annual Leave</option>
                  <option value="personal">Personal Leave</option>
                  <option value="emergency">Emergency Leave</option>
                </select>
              </div>
              <div className="w-full md:w-36">
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="input-field" />
              </div>
              <div className="w-full md:w-36">
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="input-field" />
              </div>
              {hasActiveFilter && <Button variant="secondary" onClick={clearFilters}>Clear</Button>}
            </div>

            {uniqueNames.length > 0 && uniqueNames.length <= 20 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1">Quick:</span>
                {uniqueNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setSearchName(searchName === name ? '' : name)}
                    className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors ${
                      searchName === name
                        ? 'bg-primary text-white border-primary'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            <div className="text-xs text-gray-500 dark:text-gray-400">
              Showing {filteredLeaves.length} of {leaves.length} records
            </div>
          </div>
        </Card>

        {isLoading ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-12">
              <Loading size="lg" />
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Loading leave data...</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <ThBtn field="name">Name</ThBtn>
                    <ThBtn field="date_from">Date From</ThBtn>
                    <ThBtn field="date_end">Date To</ThBtn>
                    <ThBtn field="category">Category</ThBtn>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Document</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Keterangan</th>
                    <ThBtn field="created_at">Created</ThBtn>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-500">No leave records found</td>
                    </tr>
                  ) : (
                    filteredLeaves.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{row.date_from}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{row.date_end}</td>
                        <td className="px-3 py-2 text-xs">
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {row.category}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {row.link_url ? (
                            <a href={row.link_url} target="_blank" rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs inline-flex items-center gap-1">
                              <FileText size={12} /> View
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 max-w-[200px] truncate" title={row.keterangan}>
                          {row.keterangan || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex gap-2">
                            <button onClick={() => handleEdit(row)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => handleDelete(row.id)} className="text-red-600 hover:text-red-800 dark:text-red-400">
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

        <Modal isOpen={isModalOpen} onClose={resetForm} title={editingLeave ? "Edit Leave Request" : "Add Leave Request"}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {!editingLeave && (
              <div>
                <label className="label-field">Employee</label>
                <select
                  value={formData.staff_id}
                  onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select employee</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {editingLeave && (
              <div>
                <label className="label-field">Employee</label>
                <input type="text" value={editingLeave.name} className="input-field bg-gray-100 dark:bg-gray-700" disabled />
              </div>
            )}

            <div>
              <label className="label-field">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input-field"
                required
              >
                <option value="sick">Sick Leave</option>
                <option value="annual">Annual Leave</option>
                <option value="personal">Personal Leave</option>
                <option value="emergency">Emergency Leave</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">From Date</label>
                <input
                  type="date"
                  value={formData.date_from}
                  onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label-field">To Date</label>
                <input
                  type="date"
                  value={formData.date_end}
                  onChange={(e) => setFormData({ ...formData, date_end: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label-field">Keterangan</label>
              <textarea
                value={formData.keterangan}
                onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                className="input-field"
                rows={2}
                placeholder="Add a note or reason for this leave (optional)"
              />
            </div>

            <div>
              <label className="label-field">Document Upload</label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                <input type="file" onChange={handleFileChange} className="hidden" id="file-upload" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                  <Upload className="text-gray-400 mb-2" size={32} />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {uploadedFile ? uploadedFile.name : "Click to upload document"}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX, JPG, PNG</span>
                </label>
              </div>
              {formData.link_url && !uploadedFile && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Current: <a href={formData.link_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Document</a>
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-3">
              <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={isUploading}>
                <Calendar size={14} className="mr-1.5" />
                {editingLeave ? "Update" : "Add"} Leave
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}