import { readSheet, writeSheet, findRowIndexByField } from '@/lib/sheets';

const SHEET = 'numbering_series';

/**
 * Atomically-ish reserve the next document number for a series
 * (e.g. "PO" -> "PO-2026-00001") and persist the incremented counter.
 */
export async function getNextDocId(seriesName: string): Promise<string> {
  const rows = await readSheet(SHEET);
  const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
  const dataRowIndex = findRowIndexByField(headers, rows, 'series_name', seriesName);

  if (dataRowIndex === -1) {
    throw new Error(`Numbering series "${seriesName}" not found`);
  }

  const sheetRowIndex = dataRowIndex + 1;
  const row = rows[sheetRowIndex] || [];
  const prefixCol = headers.indexOf('prefix');
  const currentCol = headers.indexOf('current_number');

  const prefix = row[prefixCol] || `${seriesName}-`;
  const current = parseInt(row[currentCol], 10) || 0;
  const next = current + 1;

  const colLetter = String.fromCharCode(65 + currentCol);
  await writeSheet(SHEET, `${colLetter}${sheetRowIndex + 1}`, [[next]]);

  return `${prefix}${String(next).padStart(5, '0')}`;
}

/**
 * ERPNext-style "Cancel & Amend" numbering: PO-2026-00001 -> PO-2026-00001-1 -> -2, etc.
 * `existingIds` should be every doc id already in that doctype's sheet, so the next
 * free suffix can be worked out regardless of whether `originalId` is itself an amendment.
 */
export function getAmendedDocId(originalId: string, existingIds: string[]): string {
  const root = originalId.replace(/-\d+$/, '');
  let max = 0;
  for (const id of existingIds) {
    if (id === root) continue;
    if (id.startsWith(`${root}-`)) {
      const match = id.slice(root.length).match(/^-(\d+)$/);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return `${root}-${max + 1}`;
}
