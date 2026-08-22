import { prisma } from '@/lib/db';
import { requiredDoctypePerms } from '@/lib/activityLog';
import { PermissionAction, MATRIX_DOCTYPES, WORKFLOW_ACTIONS } from '@/lib/permissionsShared';

export type { PermissionAction };
export { MATRIX_DOCTYPES };

const ACTION_COLUMN = {
  read: 'canRead',
  create: 'canCreate',
  write: 'canWrite',
  delete: 'canDelete',
  export: 'canExport',
  import: 'canImport',
  submit: 'canSubmit',
  cancel: 'canCancel',
  amend: 'canAmend',
  approve: 'canApproveDoc',
  print: 'canPrint',
} as const satisfies Record<PermissionAction, string>;

interface SessionLike {
  user: {
    id: string;
    isSuperAdmin?: boolean;
    role_id: string;
    permissions: Record<string, boolean>;
  };
}

/**
 * Granular per-doctype × per-action check. A `RolePermission` row for
 * (role_id, doctype) — set via the Permission Matrix in Settings — takes
 * precedence; if no row exists yet, falls back to the legacy flat module
 * flag via `requiredDoctypePerms()` for every action (matches pre-matrix
 * behavior exactly, so rolling this out doesn't change access for any role
 * until an admin explicitly overrides a doctype).
 */
export async function hasDoctypePermission(
  session: SessionLike,
  doctype: string,
  action: PermissionAction
): Promise<boolean> {
  if (session.user.isSuperAdmin) return true;

  const override = await prisma.rolePermission.findUnique({
    where: { roleId_doctype: { roleId: session.user.role_id, doctype } },
  });
  if (override) return override[ACTION_COLUMN[action]] as boolean;

  // 'import' has no legacy flag to fall back to — bulk import was always either
  // superadmin-only or gated by its own module flag pre-matrix, never opened up
  // by a doctype's flat flag. Defaulting to false here preserves that stricter
  // posture: import stays superadmin-only until an admin explicitly grants it
  // per role via the Permission Matrix, instead of silently inheriting whatever
  // Read/Write access that role happens to have.
  if (action === 'import') return false;

  // 'approve' pre-matrix was gated by a single flat, global `can_approve` flag on
  // Role — not the doctype flag — so its fallback mirrors that exactly (one flag
  // controlling approve/reject across every doctype) rather than falling back to
  // e.g. `purchasing`/`sales_order`. An explicit override is the only way to make
  // approval per-doctype instead of all-or-nothing.
  if (action === 'approve') return !!session.user.permissions.can_approve;

  return !!requiredDoctypePerms(session.user.permissions)[doctype];
}

/**
 * "If Owner" restriction (mirrors ERPNext's Role Permission Manager): when set for a
 * (role, doctype) override, write/delete on that doctype is only allowed on documents
 * the acting user themselves created (`document.owner === session.user.name`). Only
 * meaningful for doctypes that actually track an `owner` column — BOM, Purchase Order,
 * Sales Order, Delivery Note today. Callers fetch the record first, then compare its
 * `owner` field against `session.user.name` themselves; this only tells them whether
 * that comparison is required for the acting role.
 */
export async function requiresOwnerMatch(session: SessionLike, doctype: string): Promise<boolean> {
  if (session.user.isSuperAdmin) return false;
  const override = await prisma.rolePermission.findUnique({
    where: { roleId_doctype: { roleId: session.user.role_id, doctype } },
  });
  return !!override?.onlyIfOwner;
}

/**
 * "Restrict to Assigned" (User Permission-lite): when set for a (role, doctype)
 * override, Read on that doctype is scoped to only documents the acting user is
 * assigned to (via the `assignments` table / "Assigned To" section), instead of
 * every document. Only offered for doctypes where being scoped down to "my own"
 * makes business sense — Customer and Sales Order today (e.g. a sales rep who
 * should only see their own accounts). Callers fetch the full list, then filter
 * it themselves with `filterToAssignedOnly()` below.
 */
export async function requiresAssignedOnly(session: SessionLike, doctype: string): Promise<boolean> {
  if (session.user.isSuperAdmin) return false;
  const override = await prisma.rolePermission.findUnique({
    where: { roleId_doctype: { roleId: session.user.role_id, doctype } },
  });
  return !!override?.restrictToAssigned;
}

/**
 * Field-level permission (mirrors ERPNext's Permission Level, scoped to
 * FIELD_PERMISSION_FIELDS — see lib/permissionsShared.ts). No row = visible,
 * matching ERPNext's own "not configured = visible" default. Superadmin always sees
 * everything. Redacts to `null` in-place on every record for the given field.
 */
export async function redactRestrictedFields<T extends Record<string, any>>(
  session: SessionLike,
  doctype: string,
  fields: string[],
  records: T[]
): Promise<T[]> {
  if (session.user.isSuperAdmin || fields.length === 0) return records;

  const rows = await prisma.fieldPermission.findMany({
    where: { roleId: session.user.role_id, doctype, field: { in: fields } },
  });
  const hidden = rows.filter((r) => !r.canView).map((r) => r.field);
  if (hidden.length === 0) return records;

  return records.map((r) => {
    const copy = { ...r };
    for (const field of hidden) (copy as Record<string, any>)[field] = null;
    return copy;
  });
}

/** Filters a list of records down to only those the user is assigned to, keyed by documentId. */
export async function filterToAssignedOnly<T>(
  session: SessionLike,
  doctype: string,
  records: T[],
  idOf: (record: T) => string
): Promise<T[]> {
  const rows = await prisma.assignment.findMany({
    where: { doctype, assignedTo: session.user.id },
    select: { documentId: true },
  });
  const assignedIds = new Set(rows.map((r) => r.documentId));
  return records.filter((r) => assignedIds.has(idOf(r)));
}

/**
 * Document Share (lightweight): an Assignment with `grantsAccess: true` acts as a
 * per-document access grant, letting the assigned user see that one document even
 * when their role otherwise lacks Read on the doctype — mirrors ERPNext's Share
 * feature without a separate table. Returns the set of documentIds shared with
 * this user for a doctype (empty if none / user already has full doctype Read).
 */
export async function getSharedDocumentIds(session: SessionLike, doctype: string): Promise<Set<string>> {
  const rows = await prisma.assignment.findMany({
    where: { doctype, assignedTo: session.user.id, grantsAccess: true },
    select: { documentId: true },
  });
  return new Set(rows.map((r) => r.documentId));
}

/**
 * Resolves how much of a doctype's Read a user should get: 'full' (their role has
 * Read on the doctype — the normal case), 'shared' (they lack Read, but have at
 * least one document.share-granting Assignment for this doctype — see
 * `getSharedDocumentIds`), or 'none' (no access at all, respond 403 as usual).
 * Pilot-wired into Customer and Item's GET handlers today.
 */
export async function resolveReadScope(session: SessionLike, doctype: string): Promise<'full' | 'shared' | 'none'> {
  if (await hasDoctypePermission(session, doctype, 'read')) return 'full';
  const shared = await getSharedDocumentIds(session, doctype);
  return shared.size > 0 ? 'shared' : 'none';
}

export type DoctypeMatrixRow = {
  doctype: string;
  onlyIfOwner: boolean;
  restrictToAssigned: boolean;
  /** true if this row is an explicit override; false if it's the legacy-flag fallback. */
  isOverride: boolean;
} & Record<PermissionAction, boolean>;

/** Full matrix for one role — one row per MATRIX_DOCTYPES entry, override merged over legacy fallback. */
export async function getRolePermissionMatrix(roleId: string, isSuperAdmin: boolean): Promise<DoctypeMatrixRow[]> {
  const role = await prisma.role.findUnique({ where: { roleId } });
  const legacyFlags = role
    ? {
        dashboard: role.dashboard, attendance: role.attendance, leave: role.leave,
        registration_request: role.registrationRequest, setting: role.setting, staff: role.staff,
        inventory: role.inventory, purchasing: role.purchasing, sales_order: role.salesOrder,
        delivery_order: role.deliveryOrder, can_approve: role.canApprove,
      }
    : {};
  const legacyMap = requiredDoctypePerms(legacyFlags);
  const overrides = await prisma.rolePermission.findMany({ where: { roleId } });
  const overrideMap = new Map(overrides.map((o) => [o.doctype, o]));
  const allActions: PermissionAction[] = ['read', 'create', 'write', 'delete', 'export', 'import', ...WORKFLOW_ACTIONS];

  return MATRIX_DOCTYPES.map((doctype) => {
    const override = overrideMap.get(doctype);

    if (isSuperAdmin) {
      const actions = Object.fromEntries(allActions.map((a) => [a, true])) as Record<PermissionAction, boolean>;
      return { doctype, ...actions, onlyIfOwner: false, restrictToAssigned: false, isOverride: false };
    }
    if (override) {
      const actions = Object.fromEntries(allActions.map((a) => [a, override[ACTION_COLUMN[a]] as boolean])) as Record<PermissionAction, boolean>;
      return { doctype, ...actions, onlyIfOwner: override.onlyIfOwner, restrictToAssigned: override.restrictToAssigned, isOverride: true };
    }

    const fallback = !!legacyMap[doctype];
    const actions = Object.fromEntries(
      allActions.map((a) => [
        a,
        // Import never inherits the flat legacy flag (superadmin-only default);
        // Approve falls back to the global `can_approve` flag, not the doctype flag.
        a === 'import' ? false : a === 'approve' ? !!legacyFlags.can_approve : fallback,
      ])
    ) as Record<PermissionAction, boolean>;
    return { doctype, ...actions, onlyIfOwner: false, restrictToAssigned: false, isOverride: false };
  });
}
