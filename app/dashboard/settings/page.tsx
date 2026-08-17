"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Loading from "@/components/ui/Loading";
import { Role } from "@/types";
import { Save, Clock, Timer, Plus, Edit, Trash2, ShieldCheck, DollarSign, RefreshCw } from "lucide-react";

interface UserWithRole {
  id: string;
  name: string;
  username: string;
  role: string;
  role_id: string;
  last_active?: string;
}

const PERMISSION_COLS: { key: keyof Omit<Role, "role_id" | "role_name">; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "attendance", label: "Attendance" },
  { key: "leave", label: "Leave" },
  { key: "staff", label: "Staff" },
  { key: "inventory", label: "Inventory" },
  { key: "purchasing", label: "Purchasing" },
  { key: "sales_order", label: "Sales Order" },
  { key: "delivery_order", label: "Delivery Order" },
  { key: "can_approve", label: "Can Approve" },
  { key: "registration_request", label: "Registration" },
  { key: "setting", label: "Settings" },
];

function formatLastActive(iso: string | undefined): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "Never";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const [workHours, setWorkHours] = useState({ jam_masuk: "08:00", jam_pulang: "17:00", toleransi_menit: "0" });
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [hoursMessage, setHoursMessage] = useState("");

  const [usdIdrRate, setUsdIdrRate] = useState("15800");
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [rateMessage, setRateMessage] = useState("");

  // Role modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<Omit<Role, "role_id">>({
    role_name: "",
    dashboard: false,
    attendance: false,
    leave: false,
    registration_request: false,
    setting: false,
    staff: false,
    inventory: false,
    purchasing: false,
    sales_order: false,
    delivery_order: false,
    can_approve: false,
    is_super_admin: false,
  });
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [roleError, setRoleError] = useState("");

  useEffect(() => {
    if (session) {
      fetchUsers();
      fetchRoles();
      fetchSettings();
    }
  }, [session]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setWorkHours({
          jam_masuk: data.jam_masuk || "08:00",
          jam_pulang: data.jam_pulang || "17:00",
          toleransi_menit: data.toleransi_menit || "0",
        });
        setUsdIdrRate(data.usd_idr_rate || "15800");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleSaveWorkHours = async () => {
    setIsSavingHours(true);
    setHoursMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workHours),
      });
      if (res.ok) {
        setHoursMessage("Jam kerja berhasil disimpan!");
      } else {
        const err = await res.json();
        setHoursMessage(err.error || "Gagal menyimpan jam kerja.");
      }
      setTimeout(() => setHoursMessage(""), 4000);
    } catch (error) {
      console.error("Error saving work hours:", error);
      setHoursMessage("Gagal menyimpan jam kerja.");
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleSaveRate = async () => {
    setIsSavingRate(true);
    setRateMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usd_idr_rate: usdIdrRate }),
      });
      if (res.ok) {
        setRateMessage("Kurs berhasil disimpan!");
      } else {
        const err = await res.json();
        setRateMessage(err.error || "Gagal menyimpan kurs.");
      }
      setTimeout(() => setRateMessage(""), 4000);
    } catch (error) {
      console.error("Error saving exchange rate:", error);
      setRateMessage("Gagal menyimpan kurs.");
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleFetchLiveRate = async () => {
    setIsFetchingRate(true);
    setRateMessage("");
    try {
      const res = await fetch("/api/exchange-rate");
      if (res.ok) {
        const data = await res.json();
        setUsdIdrRate(String(data.rate));
        setRateMessage(`Kurs terbaru diambil: $1 = Rp${data.rate.toLocaleString("id-ID")}. Klik Simpan Kurs untuk menerapkannya.`);
      } else {
        const err = await res.json();
        setRateMessage(err.error || "Gagal mengambil kurs dari internet.");
      }
    } catch (error) {
      console.error("Error fetching live exchange rate:", error);
      setRateMessage("Gagal mengambil kurs dari internet.");
    } finally {
      setIsFetchingRate(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) setUsers(await res.json());
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) setRoles(await res.json());
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const handleRoleAssign = async (userId: string, roleId: string) => {
    setSavingUserId(userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role_id: roleId } : u)));
    try {
      await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role_id: roleId }),
      });
    } catch (error) {
      console.error("Error assigning role:", error);
    } finally {
      setSavingUserId(null);
    }
  };

  const openNewRole = () => {
    setEditingRole(null);
    setRoleForm({
      role_name: "",
      dashboard: false,
      attendance: false,
      leave: false,
      registration_request: false,
      setting: false,
      staff: false,
      inventory: false,
    purchasing: false,
    sales_order: false,
    delivery_order: false,
    can_approve: false,
    is_super_admin: false,
    });
    setRoleError("");
    setIsRoleModalOpen(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      role_name: role.role_name,
      dashboard: role.dashboard,
      attendance: role.attendance,
      leave: role.leave,
      registration_request: role.registration_request,
      setting: role.setting,
      staff: role.staff,
      inventory: role.inventory,
      purchasing: role.purchasing,
      sales_order: role.sales_order,
      delivery_order: role.delivery_order,
      can_approve: role.can_approve,
      is_super_admin: role.is_super_admin,
    });
    setRoleError("");
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.role_name.trim()) {
      setRoleError("Nama role wajib diisi");
      return;
    }
    setIsSavingRole(true);
    setRoleError("");
    try {
      const res = editingRole
        ? await fetch("/api/roles", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role_id: editingRole.role_id, ...roleForm }),
          })
        : await fetch("/api/roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(roleForm),
          });

      if (res.ok) {
        setIsRoleModalOpen(false);
        fetchRoles();
      } else {
        const err = await res.json();
        setRoleError(err.error || "Gagal menyimpan role");
      }
    } catch (error) {
      console.error("Error saving role:", error);
      setRoleError("Gagal menyimpan role");
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Hapus role ini?")) return;
    try {
      const res = await fetch(`/api/roles?role_id=${roleId}`, { method: "DELETE" });
      if (res.ok) {
        fetchRoles();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menghapus role");
      }
    } catch (error) {
      console.error("Error deleting role:", error);
    }
  };

  if (status !== "loading" && !session) redirect("/login");
  if (status === "loading") return <div className="flex items-center justify-center min-h-screen"><Loading size="lg" /></div>;
  if (!session) return null;

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
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>

        <Card title="Jam Kerja">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-1.5 rounded-md bg-primary-50 dark:bg-primary-900/20 mt-0.5">
              <Timer className="text-primary" size={16} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Jam kerja default ini dipakai saat mesin absensi tidak mengirim "Jam Set" untuk suatu record.
              Berlaku global untuk semua karyawan.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label-field">Jam Masuk</label>
              <input
                type="time"
                value={workHours.jam_masuk}
                onChange={(e) => setWorkHours({ ...workHours, jam_masuk: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Jam Pulang</label>
              <input
                type="time"
                value={workHours.jam_pulang}
                onChange={(e) => setWorkHours({ ...workHours, jam_pulang: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Toleransi Keterlambatan (menit)</label>
              <input
                type="number"
                min={0}
                value={workHours.toleransi_menit}
                onChange={(e) => setWorkHours({ ...workHours, toleransi_menit: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Button onClick={handleSaveWorkHours} isLoading={isSavingHours}>
              <Save size={14} className="mr-1.5" />
              Simpan Jam Kerja
            </Button>
            {hoursMessage && (
              <span className={`text-xs ${hoursMessage.includes("berhasil") ? "text-green-600" : "text-red-600"}`}>
                {hoursMessage}
              </span>
            )}
          </div>
        </Card>

        <Card title="Kurs Mata Uang">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-1.5 rounded-md bg-primary-50 dark:bg-primary-900/20 mt-0.5">
              <DollarSign className="text-primary" size={16} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Kurs ini dipakai untuk mengkonversi harga item berkurensi USD ke IDR (di Item, Purchase Order, Sales Order, dll).
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label-field">1 USD = ? IDR</label>
              <input
                type="number"
                min={0}
                step="any"
                value={usdIdrRate}
                onChange={(e) => setUsdIdrRate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <Button onClick={handleSaveRate} isLoading={isSavingRate}>
              <Save size={14} className="mr-1.5" />
              Simpan Kurs
            </Button>
            <Button variant="secondary" onClick={handleFetchLiveRate} isLoading={isFetchingRate}>
              <RefreshCw size={14} className="mr-1.5" />
              Refresh dari Internet
            </Button>
            {rateMessage && (
              <span className={`text-xs ${rateMessage.includes("berhasil") || rateMessage.includes("diambil") ? "text-green-600" : "text-red-600"}`}>
                {rateMessage}
              </span>
            )}
          </div>
        </Card>

        {/* Roles management */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20">
                <ShieldCheck className="text-indigo-500" size={16} />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Roles</h3>
            </div>
            <Button onClick={openNewRole}>
              <Plus size={14} className="mr-1.5" />
              Add Role
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                  {PERMISSION_COLS.map((col) => (
                    <th key={col.key} className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-sm text-gray-500">No roles found</td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr
                      key={role.role_id}
                      onClick={() => router.push(`/dashboard/settings/role/${encodeURIComponent(role.role_id)}`)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pr-4 text-xs font-semibold text-gray-900 dark:text-gray-100">
                        <div className="flex items-center gap-1.5">
                          {role.role_name}
                          {role.is_super_admin && (
                            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              SUPER ADMIN
                            </span>
                          )}
                        </div>
                      </td>
                      {PERMISSION_COLS.map((col) => (
                        <td key={col.key} className="px-3 py-2.5 text-center">
                          <span className={`inline-block w-2 h-2 rounded-full ${role.is_super_admin || role[col.key] ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                        </td>
                      ))}
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button onClick={() => openEditRole(role)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDeleteRole(role.role_id)} className="text-red-600 hover:text-red-800 dark:text-red-400">
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

        {/* User → Role assignment */}
        {isLoading ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-12">
              <Loading size="lg" />
            </div>
          </Card>
        ) : (
          <Card title="User Access">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">User</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Clock size={11} /> Last Active</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-sm text-gray-500">No users found</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => router.push(`/dashboard/settings/user/${encodeURIComponent(user.id)}`)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 pr-4">
                          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</p>
                        </td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={user.role_id}
                            onChange={(e) => handleRoleAssign(user.id, e.target.value)}
                            disabled={savingUserId === user.id}
                            className="input-field text-xs py-1"
                          >
                            <option value="">— No role —</option>
                            {roles.map((r) => (
                              <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs ${
                            user.last_active
                              ? "text-gray-700 dark:text-gray-300"
                              : "text-gray-400 dark:text-gray-500"
                          }`}>
                            {formatLastActive(user.last_active)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Info card: session policy */}
        <Card>
          <div className="flex items-start gap-3">
            <Clock size={18} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Session Policy</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Sessions automatically expire after <strong>30 minutes</strong> of inactivity.
                Users will be redirected to the login page and must sign in again.
              </p>
            </div>
          </div>
        </Card>

        {/* Role Add/Edit Modal */}
        <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} title={editingRole ? "Edit Role" : "Add Role"} size="sm">
          <div className="space-y-3">
            <div>
              <label className="label-field">Role Name</label>
              <input
                type="text"
                value={roleForm.role_name}
                onChange={(e) => setRoleForm({ ...roleForm, role_name: e.target.value })}
                className="input-field"
                placeholder="cth. HR Manager"
              />
            </div>

            <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-2.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-400">
                <input
                  type="checkbox"
                  checked={roleForm.is_super_admin}
                  onChange={(e) => setRoleForm({ ...roleForm, is_super_admin: e.target.checked })}
                  className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                Super Admin
              </label>
              <p className="text-[11px] text-amber-700 dark:text-amber-500 mt-1">
                Akses penuh ke semua modul, termasuk modul yang ditambahkan nanti. Checkbox di bawah diabaikan kalau ini aktif.
              </p>
            </div>

            <div className={roleForm.is_super_admin ? 'opacity-40 pointer-events-none' : ''}>
              <label className="label-field">Permissions</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PERMISSION_COLS.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={roleForm[col.key]}
                      onChange={(e) => setRoleForm({ ...roleForm, [col.key]: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>

            {roleError && <p className="text-xs text-red-600">{roleError}</p>}

            <div className="flex gap-2 justify-end pt-3">
              <Button variant="secondary" onClick={() => setIsRoleModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveRole} isLoading={isSavingRole}>
                <Save size={14} className="mr-1.5" />
                {editingRole ? "Update" : "Add"} Role
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
