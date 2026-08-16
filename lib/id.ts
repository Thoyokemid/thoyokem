import { randomUUID } from 'crypto';

/**
 * Generates a unique document ID. Used for doctypes where a human-readable
 * numbering series (see lib/numbering.ts) isn't needed — e.g. Staff, Leave,
 * Registration, Role, Stock Entry, Comment. A plain "row count + 1" counter
 * produced non-unique, unprofessional-looking IDs (/staff/5, /staff/1) that
 * collided after a row was deleted, which caused wrong-record links (e.g.
 * a Staff detail page's leave history linking to the wrong Leave record).
 */
export function generateId(): string {
  return randomUUID();
}
