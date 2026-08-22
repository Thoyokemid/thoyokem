'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import { Role } from '@/types';
import {
  PERMISSION_ACTIONS, WORKFLOW_ACTIONS, WORKFLOW_ACTION_DOCTYPES, ACTION_LABELS, MATRIX_DOCTYPES,
  PermissionAction, OWNER_TRACKED_DOCTYPES, ASSIGNABLE_RESTRICT_DOCTYPES,
} from '@/lib/permissionsShared';
import { ShieldCheck, ArrowLeft, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

type MatrixRow = {
  doctype: string;
  onlyIfOwner: boolean;
  restrictToAssigned: boolean;
  isOverride: boolean;
} & Record<PermissionAction, boolean>;

export default function PermissionMatrixPage() {
  const { data: session, status } = useSession();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [isSuperAdminRole, setIsSuperAdminRole] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/roles')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Role[]) => {
        setRoles(data);
        const nonSuperAdmin = data.find((r) => !r.is_super_admin);
        setSelectedRoleId(nonSuperAdmin?.role_id || data[0]?.role_id || '');
      })
      .catch(() => setRoles([]));
  }, []);

  const fetchMatrix = useCallback((roleId: string) => {
    if (!roleId) return;
    setIsLoading(true);
    fetch(`/api/role-permissions?role_id=${encodeURIComponent(roleId)}`)
      .then((res) => (res.ok ? res.json() : { matrix: [], is_super_admin: false }))
      .then((data) => {
        setMatrix(data.matrix || []);
        setIsSuperAdminRole(!!data.is_super_admin);
      })
      .catch(() => {
        setMatrix([]);
        toast.error('Gagal memuat permission matrix');
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (selectedRoleId) fetchMatrix(selectedRoleId);
  }, [selectedRoleId, fetchMatrix]);

  const saveRow = async (row: MatrixRow, updated: MatrixRow, key: string, label: string) => {
    setSavingKey(key);
    setMatrix((prev) => prev.map((r) => (r.doctype === row.doctype ? updated : r)));

    try {
      const res = await fetch('/api/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: selectedRoleId,
          doctype: row.doctype,
          read: updated.read, create: updated.create, write: updated.write,
          delete: updated.delete, export: updated.export, import: updated.import,
          only_if_owner: updated.onlyIfOwner,
          restrict_to_assigned: updated.restrictToAssigned,
          submit: updated.submit, cancel: updated.cancel, amend: updated.amend, approve: updated.approve, print: updated.print,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal menyimpan');
      toast.success(`${row.doctype} · ${label} diperbarui`);
    } catch (error: any) {
      setMatrix((prev) => prev.map((r) => (r.doctype === row.doctype ? row : r)));
      toast.error(error.message || 'Gagal menyimpan izin');
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggle = (row: MatrixRow, action: PermissionAction) => {
    const updated: MatrixRow = { ...row, [action]: !row[action], isOverride: true };
    saveRow(row, updated, `${row.doctype}:${action}`, ACTION_LABELS[action]);
  };

  const handleToggleOwner = (row: MatrixRow) => {
    const updated: MatrixRow = { ...row, onlyIfOwner: !row.onlyIfOwner, isOverride: true };
    saveRow(row, updated, `${row.doctype}:only_if_owner`, 'If Owner');
  };

  const handleToggleAssignedOnly = (row: MatrixRow) => {
    const updated: MatrixRow = { ...row, restrictToAssigned: !row.restrictToAssigned, isOverride: true };
    saveRow(row, updated, `${row.doctype}:restrict_to_assigned`, 'Assigned Only');
  };

  const handleReset = async (doctype: string) => {
    setSavingKey(`${doctype}:reset`);
    try {
      const res = await fetch(`/api/role-permissions?role_id=${encodeURIComponent(selectedRoleId)}&doctype=${encodeURIComponent(doctype)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal reset');
      toast.success(`${doctype} dikembalikan ke default`);
      fetchMatrix(selectedRoleId);
    } catch (error: any) {
      toast.error(error.message || 'Gagal reset izin');
    } finally {
      setSavingKey(null);
    }
  };

  if (status !== 'loading' && !session) redirect('/login');
  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen"><Loading size="lg" /></div>;
  if (!session) return null;

  const layoutUser = {
    id: session.user.id,
    username: session.user.email || '',
    name: session.user.name ?? '',
    role: session.user.role,
    permissions: session.user.permissions,
  };

  if (!session.user.permissions.setting) {
    return (
      <DashboardLayout user={layoutUser}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <ShieldCheck className="mx-auto text-gray-400 mb-3" size={40} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">You don't have permission to access the Permission Matrix.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={layoutUser}>
      <div className="space-y-4">
        <div>
          <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary mb-2">
            <ArrowLeft size={12} /> Back to Settings
          </Link>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck size={22} className="text-primary" />
            Permission Matrix
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Atur akses per doctype × aksi untuk setiap role. Baris yang belum di-custom mengikuti izin modul biasa di halaman Roles.
          </p>
        </div>

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">Role</label>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="input-field text-sm max-w-xs"
            >
              {roles.map((r) => (
                <option key={r.role_id} value={r.role_id}>{r.role_name}{r.is_super_admin ? ' (Super Admin)' : ''}</option>
              ))}
            </select>
          </div>

          {isSuperAdminRole ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
              Super Admin selalu punya akses penuh ke semua doctype — tidak bisa dikustomisasi.
            </p>
          ) : isLoading ? (
            <div className="flex justify-center py-12"><Loading size="lg" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Doctype</th>
                    {PERMISSION_ACTIONS.map((action) => (
                      <th key={action} className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {ACTION_LABELS[action]}
                      </th>
                    ))}
                    {WORKFLOW_ACTIONS.map((action) => (
                      <th key={action} className="px-3 py-2 text-center text-xs font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wider border-l border-gray-100 dark:border-gray-700">
                        {ACTION_LABELS[action]}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-l border-gray-100 dark:border-gray-700" title="Batasi Write/Delete hanya ke dokumen milik sendiri">
                      If Owner
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" title="Batasi Read hanya ke dokumen yang di-assign ke user">
                      Assigned Only
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {MATRIX_DOCTYPES.map((doctype) => {
                    const row = matrix.find((m) => m.doctype === doctype);
                    if (!row) return null;
                    const ownerTracked = (OWNER_TRACKED_DOCTYPES as readonly string[]).includes(doctype);
                    const assignableRestrict = (ASSIGNABLE_RESTRICT_DOCTYPES as readonly string[]).includes(doctype);
                    return (
                      <tr key={doctype} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-2 pr-4 text-xs font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{doctype}</td>
                        {PERMISSION_ACTIONS.map((action) => {
                          const key = `${doctype}:${action}`;
                          return (
                            <td key={action} className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={row[action]}
                                disabled={savingKey === key}
                                onChange={() => handleToggle(row, action)}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
                              />
                            </td>
                          );
                        })}
                        {WORKFLOW_ACTIONS.map((action) => {
                          const applies = (WORKFLOW_ACTION_DOCTYPES[action as 'submit' | 'cancel' | 'amend' | 'approve' | 'print'] as readonly string[]).includes(doctype);
                          const key = `${doctype}:${action}`;
                          return (
                            <td key={action} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-700">
                              {applies ? (
                                <input
                                  type="checkbox"
                                  checked={row[action]}
                                  disabled={savingKey === key}
                                  onChange={() => handleToggle(row, action)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
                                />
                              ) : (
                                <span className="text-gray-300 dark:text-gray-600 text-[10px]">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-700">
                          {ownerTracked ? (
                            <input
                              type="checkbox"
                              checked={row.onlyIfOwner}
                              disabled={savingKey === `${doctype}:only_if_owner`}
                              onChange={() => handleToggleOwner(row)}
                              title="Hanya bisa Write/Delete dokumen yang dibuat sendiri"
                              className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
                            />
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {assignableRestrict ? (
                            <input
                              type="checkbox"
                              checked={row.restrictToAssigned}
                              disabled={savingKey === `${doctype}:restrict_to_assigned`}
                              onChange={() => handleToggleAssignedOnly(row)}
                              title="Hanya bisa lihat dokumen yang di-assign ke user ini"
                              className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
                            />
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.isOverride ? (
                            <button
                              onClick={() => handleReset(doctype)}
                              disabled={savingKey === `${doctype}:reset`}
                              title="Reset ke default (izin modul)"
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 hover:text-amber-800 dark:text-amber-400"
                            >
                              <RotateCcw size={11} /> Custom
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">Default</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
