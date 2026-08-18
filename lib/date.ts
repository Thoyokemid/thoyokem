import { format, isValid, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
}

/** Date-only fields (no time component): "18 Agustus 2026". */
export function formatDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'dd MMMM yyyy', { locale: id }) : '-';
}

/** Timestamp fields (with time): "18 Agustus 2026 14:30:05". */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'dd MMMM yyyy HH:mm:ss', { locale: id }) : '-';
}
