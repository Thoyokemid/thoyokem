"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";
import { UserProfile } from "@/types";
import { Save, Upload, KeyRound, User as UserIcon } from "lucide-react";

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

  useEffect(() => {
    if (session) fetchProfile();
  }, [session]);

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
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Kelola informasi profil kamu</p>
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
