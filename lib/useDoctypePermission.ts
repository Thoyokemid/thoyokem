'use client';

import { useState, useEffect } from 'react';
import { PermissionAction } from '@/lib/permissionsShared';

const DEFAULT_PERMS: Record<PermissionAction, boolean> = {
  read: true, create: true, write: true, delete: true, export: true, import: true,
  submit: true, cancel: true, amend: true, approve: true, print: true,
};

/**
 * Fetches the signed-in user's effective per-action permissions for a doctype
 * (via /api/my-permissions) — used to gate UI controls like Export/Print buttons.
 * Defaults every action to `true` while loading so controls don't flash
 * disabled-then-enabled; corrects once the real check comes back.
 */
export function useDoctypePermission(doctype: string): Record<PermissionAction, boolean> {
  const [perms, setPerms] = useState<Record<PermissionAction, boolean>>(DEFAULT_PERMS);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/my-permissions?doctype=${encodeURIComponent(doctype)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setPerms(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doctype]);

  return perms;
}
