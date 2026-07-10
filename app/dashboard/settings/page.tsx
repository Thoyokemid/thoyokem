"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";
import { Save, Clock, Timer } from "lucide-react";

interface UserPermission {
  id: string;
  name: string;
  username: string;
  role: string;
  dashboard: boolean;
  attendance: boolean;
  leave: boolean;
  registration_request: boolean;
  setting: boolean;
  staff: boolean;
  last_active?: string;
}

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
  const [users, setUsers] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [workHours, setWorkHours] = useState({ jam_masuk: "08:00", jam_pulang: "17:00", toleransi_menit: "0" });
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [hoursMessage, setHoursMessage] = useState("");

  useEffect(() => {
    if (session) {
      fetchUsers();
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

  const handlePermissionChange = (
    userId: string,
    permission: keyof Omit<UserPermission, "id" | "name" | "username" | "role" | "last_active">,
    value: boolean
  ) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, [permission]: value } : u))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
      });
      if (res.ok) {
        setSaveMessage("Permissions saved successfully!");
        setTimeout(() => setSaveMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error saving permissions:", error);
      setSaveMessage("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (status !== "loading" && !session) redirect("/login");
  if (status === "loading") return <div className="flex items-center justify-center min-h-screen"><Loading size="lg" /></div>;
  if (!session) return null;

  const permissionCols: { key: keyof UserPermission; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "attendance", label: "Attendance" },
    { key: "leave", label: "Leave" },
    { key: "staff", label: "Staff" },
    { key: "registration_request", label: "Registration" },
    { key: "setting", label: "Settings" },
  ];

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
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage user permissions and access control
            </p>
          </div>
          <Button onClick={handleSave} isLoading={isSaving}>
            <Save size={14} className="mr-1.5" />
            Save Changes
          </Button>
        </div>

        {saveMessage && (
          <div className={`px-4 py-2 rounded-md text-sm ${
            saveMessage.includes("success")
              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          }`}>
            {saveMessage}
          </div>
        )}

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

        {isLoading ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-12">
              <Loading size="lg" />
            </div>
          </Card>
        ) : (
          <Card title="User Permissions">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">
                      User
                    </th>
                    {permissionCols.map((col) => (
                      <th key={col.key} className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {col.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Clock size={11} /> Last Active</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-sm text-gray-500">No users found</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="py-2.5 pr-4">
                          <div>
                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</p>
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {user.role}
                            </span>
                          </div>
                        </td>
                        {permissionCols.map((col) => (
                          <td key={col.key} className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={!!user[col.key]}
                              onChange={(e) =>
                                handlePermissionChange(
                                  user.id,
                                  col.key as keyof Omit<UserPermission, "id" | "name" | "username" | "role" | "last_active">,
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2.5">
                          <span className={`text-xs ${
                            user.last_active
                              ? "text-gray-700 dark:text-gray-300"
                              : "text-gray-400 dark:text-gray-500"
                          }`}>
                            {formatLastActive(user.last_active)}
                          </span>
                          {user.last_active && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {new Date(user.last_active).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {" "}·{" "}
                              {new Date(user.last_active).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </p>
                          )}
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
      </div>
    </DashboardLayout>
  );
}