import { prisma } from '@/lib/db';

/**
 * Atomically reserve the next document number for a series
 * (e.g. "PO" -> "PO-2026-00001") and persist the incremented counter.
 */
export async function getNextDocId(seriesName: string): Promise<string> {
  const existing = await prisma.numberingSeries.findUnique({ where: { seriesName } });
  if (!existing) {
    throw new Error(`Numbering series "${seriesName}" not found`);
  }

  // Atomic increment — safe under concurrent requests, unlike the old
  // read-then-write against a Sheets cell.
  const updated = await prisma.numberingSeries.update({
    where: { seriesName },
    data: { currentNumber: { increment: 1 } },
  });

  return `${updated.prefix}${String(updated.currentNumber).padStart(5, '0')}`;
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
