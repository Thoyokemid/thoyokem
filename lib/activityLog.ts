import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';

export type LogAction = 'Created' | 'Updated' | 'Deleted' | 'Submitted' | 'Approved' | 'Rejected' | 'Cancelled' | 'Amended' | 'Received' | 'Delivered' | 'Paid' | 'Imported' | 'Exported' | 'Assigned' | 'Unassigned' | 'Commented' | 'Attached' | 'Detached';

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface ActivityLogEntry {
  log_id: string;
  doctype: string;
  document_id: string;
  action: LogAction;
  changed_by: string;
  timestamp: string;
  changes: FieldChange[];
}

// Which permission is required to view the log/comments for a given doctype.
// Shared by app/api/activity-log/route.ts and app/api/comments/route.ts — keep in sync
// with every doctype that has a detail page + "Riwayat" section.
export function requiredDoctypePerms(perms: any): Record<string, boolean> {
  return {
    Item: perms.inventory,
    Warehouse: perms.inventory,
    'Stock Entry': perms.inventory,
    BOM: perms.inventory,
    Supplier: perms.purchasing,
    'Purchase Order': perms.purchasing,
    'Purchase Invoice': perms.purchasing,
    Customer: perms.sales_order,
    'Sales Order': perms.sales_order,
    'Sales Invoice': perms.sales_order,
    'Delivery Note': perms.delivery_order || perms.sales_order,
    'Payment Entry': perms.purchasing || perms.sales_order,
    User: perms.setting,
    Role: perms.setting,
    Staff: perms.staff,
    Leave: perms.leave,
    Registration: perms.registration_request,
    Attendance: perms.attendance || perms.staff,
  };
}

// Fields not worth diffing/logging (bookkeeping columns, not meaningful business data).
const IGNORE_FIELDS = new Set(['modified', 'modified_by', 'creation', 'owner']);

function diffObjects(before: Record<string, any> | null, after: Record<string, any>): FieldChange[] {
  const changes: FieldChange[] = [];
  const keys = new Set([...(before ? Object.keys(before) : []), ...Object.keys(after)]);
  for (const key of keys) {
    if (IGNORE_FIELDS.has(key)) continue;
    const oldVal = before ? before[key] : undefined;
    const newVal = after[key];
    const oldStr = oldVal === undefined || oldVal === null ? '' : String(oldVal);
    const newStr = newVal === undefined || newVal === null ? '' : String(newVal);
    if (oldStr !== newStr) {
      changes.push({ field: key, from: oldStr, to: newStr });
    }
  }
  return changes;
}

/**
 * Append an activity_log row. Pass `before: null` for creation (every field logged as new),
 * or `before` + `after` snapshots for an update (only changed fields are recorded).
 * Silently no-ops on failure — logging must never block the actual business operation.
 */
export async function logActivity(params: {
  doctype: string;
  documentId: string;
  action: LogAction;
  changedBy: string;
  before?: Record<string, any> | null;
  after: Record<string, any>;
}): Promise<void> {
  try {
    const changes = diffObjects(params.before ?? null, params.after);
    if (params.action === 'Updated' && changes.length === 0) return;

    await prisma.activityLog.create({
      data: {
        logId: generateId(),
        doctype: params.doctype,
        documentId: params.documentId,
        action: params.action,
        changedBy: params.changedBy,
        timestamp: new Date().toISOString(),
        changes: JSON.stringify(changes),
      },
    });
  } catch (error) {
    console.error('Failed to write activity log:', error);
  }
}

export async function getActivityLog(doctype: string, documentId: string): Promise<ActivityLogEntry[]> {
  const records = await prisma.activityLog.findMany({
    where: { doctype, documentId },
    orderBy: { timestamp: 'desc' },
  });
  return records.map((r) => {
    let changes: FieldChange[] = [];
    try {
      changes = JSON.parse(r.changes || '[]');
    } catch {}
    return {
      log_id: r.logId,
      doctype: r.doctype,
      document_id: r.documentId,
      action: r.action as LogAction,
      changed_by: r.changedBy,
      timestamp: r.timestamp,
      changes,
    };
  });
}
