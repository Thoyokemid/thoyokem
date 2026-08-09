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
