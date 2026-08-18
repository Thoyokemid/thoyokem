/** Fire-and-forget ping so client-side XLSX exports show up in the audit log. */
export function logExport(doctype: string, rowCount: number): void {
  fetch('/api/activity-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctype, row_count: rowCount }),
  }).catch(() => {});
}
