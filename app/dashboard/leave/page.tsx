"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Loading from "@/components/ui/Loading";
import { ListViewLayout, ListRow, ListRowAvatar } from "@/components/ui/ListView";
import { LeaveAttendance, StaffList } from "@/types";
import { getInitials } from "@/utils/format";
import { countLeaveDays, countUsedLeaveDays } from "@/utils/attendance";
import { generateLeaveLetterPDF } from "@/utils/leaveLetter";
import { Plus, Calendar, Edit, Trash2, Upload, FileText, Search, ChevronUp, ChevronDown, ChevronsUpDown, ShieldOff, Download, X } from "lucide-react";

type SortField = 'employee_name' | 'from_date' | 'to_date' | 'leave_type' | 'created_at';
type SortDir = 'asc' | 'desc';

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

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
      CATEGORY_STYLES[category] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }`}>
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

export default function LeavePage() {
  const { data: session, status } = useSession();
  const [leaves, setLeaves] = useState<LeaveAttendance[]>([]);
  const [staff, setStaff] = useState<StaffList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveAttendance | null>(null);
  const [detailLeave, setDetailLeave] = useState<LeaveAttendance | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [searchName, setSearchName] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('employee_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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
      result = result.filter((l) => l.employee_name.toLowerCase().includes(q));
    }
    if (filterCategory) result = result.filter((l) => l.leave_type === filterCategory);
    if (filterDateFrom) result = result.filter((l) => l.from_date >= filterDateFrom);
    if (filterDateTo) result = result.filter((l) => l.to_date <= filterDateTo);

    result.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [leaves, searchName, filterCategory, filterDateFrom, filterDateTo, sortField, sortDir]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchName, filterCategory, filterDateFrom, filterDateTo, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / pageSize));
  const paginatedLeaves = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeaves.slice(start, start + pageSize);
  }, [filteredLeaves, currentPage]);

  const uniqueNames = useMemo(() =>
    Array.from(new Set(leaves.map((l) => l.employee_name))).sort(),
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
            from_date: formData.date_from,
            to_date: formData.date_end,
            leave_type: formData.category,
            attachment: fileUrl,
            description: formData.keterangan,
          }),
        });
        if (response.ok) { resetForm(); fetchData(); }
      } catch (error) {
        console.error("Error updating leave:", error);
      }
    } else {
      const selectedStaff = staff.find((s) => s.employee_id === formData.staff_id);
      if (!selectedStaff) return;
      try {
        const response = await fetch("/api/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee: selectedStaff.user_id,
            employee_name: selectedStaff.employee_name,
            from_date: formData.date_from,
            to_date: formData.date_end,
            leave_type: formData.category,
            attachment: fileUrl,
            description: formData.keterangan,
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
    setFormData({ staff_id: "", date_from: leave.from_date, date_end: leave.to_date, category: leave.leave_type, link_url: leave.attachment, keterangan: leave.description || "" });
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
      <>
      <ListViewLayout
        title="Leave Management"
        subtitle="Manage employee leave requests"
        primaryAction={
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            Add Leave
          </Button>
        }
        filterGroups={[
          {
            title: 'Category',
            filters: [
              { label: 'All', value: '', active: filterCategory === '', onClick: () => setFilterCategory(''), count: leaves.length },
              ...['sick', 'annual', 'personal', 'emergency'].map((cat) => ({
                label: CATEGORY_LABELS[cat],
                value: cat,
                active: filterCategory === cat,
                onClick: () => setFilterCategory(cat),
                count: leaves.filter((l) => l.leave_type === cat).length,
              })),
            ],
          },
        ]}
        toolbar={
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
              <div className="w-full md:w-36">
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="input-field" />
              </div>
              <div className="w-full md:w-36">
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="input-field" />
              </div>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="input-field w-full md:w-40"
              >
                <option value="employee_name">Sort: Name</option>
                <option value="from_date">Sort: Date From</option>
                <option value="to_date">Sort: Date To</option>
                <option value="leave_type">Sort: Category</option>
                <option value="created_at">Sort: Created</option>
              </select>
              <button
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="p-2 rounded-md border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-gray-700"
                title="Toggle sort direction"
              >
                {sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
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
        }
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loading size="lg" />
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Loading leave data...</p>
          </div>
        ) : paginatedLeaves.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">No leave records found</p>
        ) : (
          <>
            {paginatedLeaves.map((row) => (
              <ListRow
                key={row.id}
                onClick={() => setDetailLeave(row)}
                avatar={<ListRowAvatar initials={getInitials(row.employee_name)} />}
                title={row.employee_name}
                subtitle={`${row.from_date} → ${row.to_date}${row.description ? ' · ' + row.description : ''}`}
                meta={
                  row.attachment ? (
                    <a href={row.attachment} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="text-primary hover:underline inline-flex items-center gap-1">
                      <FileText size={12} /> Document
                    </a>
                  ) : (
                    new Date(row.created_at).toLocaleDateString()
                  )
                }
                badges={<CategoryBadge category={row.leave_type} />}
                actions={
                  <>
                    <button onClick={() => handleEdit(row)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(row.id)} className="text-red-600 hover:text-red-800 dark:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </>
                }
              />
            ))}

            {filteredLeaves.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </ListViewLayout>

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
                    <option key={s.employee_id} value={s.employee_id}>{s.employee_name}</option>
                  ))}
                </select>
              </div>
            )}

            {editingLeave && (
              <div>
                <label className="label-field">Employee</label>
                <input type="text" value={editingLeave.employee_name} className="input-field bg-gray-100 dark:bg-gray-700" disabled />
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

        {/* Detail Modal */}
        <Modal isOpen={!!detailLeave} onClose={() => setDetailLeave(null)} title="Detail Cuti" size="md">
          {detailLeave && (() => {
            const relatedStaff = staff.find((s) => s.user_id === detailLeave.employee);
            const quota = relatedStaff?.leave_allocation ?? 12;
            const usedDays = countUsedLeaveDays(leaves, detailLeave.employee);
            const remaining = Math.max(0, quota - usedDays);
            const totalDays = countLeaveDays(detailLeave);

            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(detailLeave.employee_name)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{detailLeave.employee_name}</p>
                    <CategoryBadge category={detailLeave.leave_type} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2.5">
                    <p className="text-gray-500 dark:text-gray-400">Tanggal Mulai</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{detailLeave.from_date}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2.5">
                    <p className="text-gray-500 dark:text-gray-400">Tanggal Selesai</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{detailLeave.to_date}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2.5">
                    <p className="text-gray-500 dark:text-gray-400">Jumlah Hari</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{totalDays} hari</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2.5">
                    <p className="text-gray-500 dark:text-gray-400">Sisa Kuota Cuti</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{remaining} / {quota} hari</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Keterangan</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 rounded-md p-2.5 min-h-[2.5rem]">
                    {detailLeave.description || <span className="text-gray-400">Tidak ada keterangan</span>}
                  </p>
                </div>

                {detailLeave.attachment && (
                  <a
                    href={detailLeave.attachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1.5"
                  >
                    <FileText size={13} /> Lihat dokumen pendukung
                  </a>
                )}

                <div className="flex gap-2 justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
                  <Button variant="secondary" onClick={() => setDetailLeave(null)}>
                    <X size={14} className="mr-1.5" />
                    Tutup
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => generateLeaveLetterPDF(detailLeave, { quota, usedDays })}
                  >
                    <Download size={14} className="mr-1.5" />
                    Download Surat Cuti
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