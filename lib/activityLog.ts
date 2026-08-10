import { readSheetAsObjects, appendSheet, objectToRow } from '@/lib/sheets';

const SHEET = 'activity_log';

export type LogAction = 'Created' | 'Updated' | 'Deleted' | 'Submitted' | 'Approved' | 'Rejected' | 'Cancelled' | 'Amended' | 'Received' | 'Delivered' | 'Paid';

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

    const { headers, records } = await readSheetAsObjects<any>(SHEET);
    const logId = String(records.length + 1);
    const row = objectToRow(headers, {
      log_id: logId,
      doctype: params.doctype,
      document_id: params.documentId,
      action: params.action,
      changed_by: params.changedBy,
      timestamp: new Date().toISOString(),
      changes: JSON.stringify(changes),
    });
    await appendSheet(SHEET, [row]);
  } catch (error) {
    console.error('Failed to write activity log:', error);
  }
}

export async function getActivityLog(doctype: string, documentId: string): Promise<ActivityLogEntry[]> {
  const { records } = await readSheetAsObjects<any>(SHEET);
  return records
    .filter((r) => r.doctype === doctype && r.document_id === documentId)
    .map((r) => {
      let changes: FieldChange[] = [];
      try {
        changes = JSON.parse(r.changes || '[]');
      } catch {}
      return {
        log_id: r.log_id,
        doctype: r.doctype,
        document_id: r.document_id,
        action: r.action,
        changed_by: r.changed_by,
        timestamp: r.timestamp,
        changes,
      };
    })
    .sort((a, b) => Number(b.log_id) - Number(a.log_id));
}
