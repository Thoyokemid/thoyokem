// Client-safe constants for the Permission Matrix — no Prisma import here,
// so this can be pulled into 'use client' pages. Server-side logic
// (hasDoctypePermission, getRolePermissionMatrix) lives in lib/permissions.ts.

export type PermissionAction = 'read' | 'create' | 'write' | 'delete' | 'export' | 'import' | 'submit' | 'cancel' | 'amend' | 'approve' | 'print';

export const PERMISSION_ACTIONS: PermissionAction[] = ['read', 'create', 'write', 'delete', 'export', 'import'];

// Workflow-specific + print actions — shown as their own matrix columns, but only
// meaningful on doctypes that actually have that transition/print page (see
// WORKFLOW_ACTION_DOCTYPES). Grouped together since both are "not every doctype has
// this" extras layered on top of the base CRUD actions above.
export const WORKFLOW_ACTIONS: PermissionAction[] = ['submit', 'cancel', 'amend', 'approve', 'print'];

// Every PermissionAction value — used where a check needs the full set (e.g. /api/my-permissions).
export const ALL_PERMISSION_ACTIONS: PermissionAction[] = [...PERMISSION_ACTIONS, ...WORKFLOW_ACTIONS];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  read: 'Read',
  create: 'Create',
  write: 'Write',
  delete: 'Delete',
  export: 'Export',
  import: 'Import',
  submit: 'Submit',
  cancel: 'Cancel',
  amend: 'Amend',
  approve: 'Approve',
  print: 'Print',
};

// Which doctypes have which workflow/print action, for gating which matrix cells are
// clickable vs a "—" placeholder. Doctypes not listed for an action don't have it at all.
export const WORKFLOW_ACTION_DOCTYPES: Record<'submit' | 'cancel' | 'amend' | 'approve' | 'print', readonly string[]> = {
  submit: ['Purchase Order', 'Sales Order'],
  cancel: ['Purchase Order', 'Sales Order', 'Delivery Note', 'Stock Entry', 'Purchase Invoice', 'Sales Invoice'],
  amend: ['Purchase Order', 'Sales Order', 'Delivery Note'],
  approve: ['Purchase Order', 'Sales Order'],
  print: ['Purchase Order', 'Sales Order', 'Purchase Invoice', 'Sales Invoice', 'Delivery Note'],
};

// Every doctype the Permission Matrix can configure — must be a subset of
// requiredDoctypePerms()'s keys in lib/activityLog.ts (that's the legacy fallback source of truth).
export const MATRIX_DOCTYPES = [
  'Item', 'Warehouse', 'Stock Entry', 'BOM',
  'Supplier', 'Purchase Order', 'Purchase Invoice',
  'Customer', 'Sales Order', 'Sales Invoice',
  'Delivery Note', 'Payment Entry',
  'User', 'Role', 'Staff', 'Leave', 'Registration', 'Attendance',
] as const;

// Doctypes that actually track an `owner` column — "If Owner" is only meaningful on these
// (BOM DELETE, Purchase/Sales Order and Delivery Note's PATCH status-transition handlers).
export const OWNER_TRACKED_DOCTYPES = ['BOM', 'Purchase Order', 'Sales Order', 'Delivery Note', 'Stock Entry', 'Purchase Invoice', 'Sales Invoice'] as const;

// Doctypes where "Restrict to Assigned" (scope Read down to only assigned documents,
// via the assignments table) makes business sense — e.g. a sales rep who should only
// see their own accounts. Deliberately not offered on every doctype.
export const ASSIGNABLE_RESTRICT_DOCTYPES = ['Customer', 'Sales Order'] as const;
