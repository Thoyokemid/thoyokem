"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";
import { UserProfile } from "@/types";
import { Save, Upload, KeyRound, User as UserIcon, Code2, Copy, Trash2, Plus } from "lucide-react";
import toast from "react-hot-toast";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<UserProfile>({ name: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [message, setMessage] = useState("");

  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [busyKeyId, setBusyKeyId] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      fetchProfile();
      fetchApiKeys();
    }
  }, [session]);

  const fetchApiKeys = async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) setApiKeys(await res.json());
    } catch (error) {
      console.error("Error fetching API keys:", error);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Nama key wajib diisi");
      return;
    }
    setIsCreatingKey(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedToken(data.token);
        setNewKeyName("");
        fetchApiKeys();
      } else {
        toast.error(data.error || "Gagal membuat API key");
      }
    } catch (error) {
      console.error("Error creating API key:", error);
      toast.error("Gagal membuat API key");
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm("Cabut API key ini? Aplikasi yang memakainya akan langsung berhenti bisa akses.")) return;
    setBusyKeyId(id);
    try {
      const res = await fetch(`/api/api-keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        fetchApiKeys();
        toast.success("API key dicabut");
      } else {
        toast.error((await res.json()).error || "Gagal mencabut API key");
      }
    } catch (error) {
      console.error("Error revoking API key:", error);
      toast.error("Gagal mencabut API key");
    } finally {
      setBusyKeyId(null);
    }
  };

  const copyToken = () => {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken);
    toast.success("Token disalin");
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) setProfile(await res.json());
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setMessage("Profile berhasil disimpan!");
      } else {
        const err = await res.json();
        setMessage(err.error || "Gagal menyimpan profile.");
      }
      setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      console.error("Error saving profile:", error);
      setMessage("Gagal menyimpan profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setProfile((p) => ({ ...p, photo_url: data.url }));
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage("");
    if (!passwordForm.new_password || passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordMessage("Password baru tidak cocok dengan konfirmasi.");
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        }),
      });
      if (res.ok) {
        setPasswordMessage("Password berhasil diganti.");
        setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      } else {
        const err = await res.json();
        setPasswordMessage(err.error || "Gagal mengganti password.");
      }
      setTimeout(() => setPasswordMessage(""), 4000);
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordMessage("Gagal mengganti password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (status !== "loading" && !session) redirect("/login");
  if (status === "loading") return <div className="flex items-center justify-center min-h-screen"><Loading size="lg" /></div>;
  if (!session) return null;

  const initials = (profile.name || session.user.name || "")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
      <div className="space-y-4 max-w-2xl">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        </div>

        {isLoading ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-12">
              <Loading size="lg" />
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="flex items-center gap-4 mb-5">
                {profile.photo_url ? (
                  <img src={profile.photo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <span className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary text-lg font-bold flex items-center justify-center">
                    {initials}
                  </span>
                )}
                <div>
                  <label htmlFor="photo-upload" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary cursor-pointer hover:underline">
                    <Upload size={13} />
                    {isUploadingPhoto ? "Mengunggah..." : "Ganti foto"}
                  </label>
                  <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={isUploadingPhoto} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="label-field">Nama Lengkap</label>
                  <input
                    type="text"
                    value={profile.name || ""}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field">No. HP / WhatsApp</label>
                  <input
                    type="text"
                    value={profile.phone || ""}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="input-field"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="label-field">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={profile.date_of_birth || ""}
                    onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field">Jenis Kelamin</label>
                  <select
                    value={profile.gender || ""}
                    onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Pilih</option>
                    <option value="male">Laki-laki</option>
                    <option value="female">Perempuan</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label-field">Alamat</label>
                  <input
                    type="text"
                    value={profile.address || ""}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field">Nama Kontak Darurat</label>
                  <input
                    type="text"
                    value={profile.emergency_contact_name || ""}
                    onChange={(e) => setProfile({ ...profile, emergency_contact_name: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field">No. HP Kontak Darurat</label>
                  <input
                    type="text"
                    value={profile.emergency_contact_phone || ""}
                    onChange={(e) => setProfile({ ...profile, emergency_contact_phone: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label-field">Bio</label>
                  <textarea
                    value={profile.bio || ""}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="input-field"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <Button onClick={handleSave} isLoading={isSaving}>
                  <Save size={14} className="mr-1.5" />
                  Simpan Profile
                </Button>
                {message && (
                  <span className={`text-xs ${message.includes("berhasil") ? "text-green-600" : "text-red-600"}`}>
                    {message}
                  </span>
                )}
              </div>
            </Card>

            <Card title="Ganti Password">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 mt-0.5">
                  <KeyRound className="text-amber-500" size={16} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Masukkan password saat ini untuk mengganti ke password baru.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label-field">Password Saat Ini</label>
                  <input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field">Password Baru</label>
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field">Konfirmasi Password Baru</label>
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <Button onClick={handleChangePassword} isLoading={isSavingPassword}>
                  <KeyRound size={14} className="mr-1.5" />
                  Ganti Password
                </Button>
                {passwordMessage && (
                  <span className={`text-xs ${passwordMessage.includes("berhasil") ? "text-green-600" : "text-red-600"}`}>
                    {passwordMessage}
                  </span>
                )}
              </div>
            </Card>

            <Card title="API Keys">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 mt-0.5">
                  <Code2 className="text-indigo-500" size={16} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Untuk akses programatik ke API — pakai sebagai header <code className="text-[11px] bg-gray-100 dark:bg-gray-700 px-1 rounded">Authorization: Bearer &lt;token&gt;</code>.
                  Token hanya ditampilkan sekali saat dibuat.
                </p>
              </div>

              {generatedToken && (
                <div className="mb-4 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1.5">
                    Simpan token ini sekarang — tidak akan ditampilkan lagi.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white dark:bg-gray-800 px-2 py-1.5 rounded border border-amber-200 dark:border-amber-700 overflow-x-auto whitespace-nowrap">
                      {generatedToken}
                    </code>
                    <button onClick={copyToken} className="p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/40 rounded">
                      <Copy size={14} />
                    </button>
                  </div>
                  <button onClick={() => setGeneratedToken(null)} className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline mt-1.5">
                    Sudah disimpan, tutup
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Nama key (mis. Zapier integration)"
                  className="input-field text-sm flex-1"
                />
                <Button onClick={handleCreateKey} isLoading={isCreatingKey}>
                  <Plus size={14} className="mr-1.5" />Generate
                </Button>
              </div>

              {apiKeys.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Belum ada API key.</p>
              ) : (
                <div className="space-y-1.5">
                  {apiKeys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-100 dark:border-gray-700">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                          {k.name}
                          {k.revoked_at && <span className="ml-2 text-[10px] text-red-500 font-normal">Dicabut</span>}
                        </p>
                        <p className="text-[11px] text-gray-400 font-mono">{k.key_prefix}••••••••</p>
                      </div>
                      {!k.revoked_at && (
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          disabled={busyKeyId === k.id}
                          className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-40"
                          title="Cabut key"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
