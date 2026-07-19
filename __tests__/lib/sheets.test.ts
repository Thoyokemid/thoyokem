import { objectToRow, findRowIndexByField } from '@/lib/sheets';

describe('objectToRow', () => {
  it('orders values to match the header array, regardless of object key order', () => {
    const headers = ['id', 'employee_name', 'attendance_date'];
    const obj = { attendance_date: '2026-01-05', id: '1', employee_name: 'Budi' };

    expect(objectToRow(headers, obj)).toEqual(['1', 'Budi', '2026-01-05']);
  });

  it('fills missing keys with an empty string', () => {
    const headers = ['id', 'employee_name', 'remarks'];
    const obj = { id: '1', employee_name: 'Budi' };

    expect(objectToRow(headers, obj)).toEqual(['1', 'Budi', '']);
  });
});

describe('findRowIndexByField', () => {
  const headers = ['id', 'employee_name'];
  const rows = [
    headers,
    ['1', 'Budi'],
    ['2', 'Siti'],
    ['3', 'Andi'],
  ];

  it('finds the correct 0-based data-row index for a matching id', () => {
    expect(findRowIndexByField(headers, rows, 'id', '2')).toBe(1);
  });

  it('returns -1 when no row matches', () => {
    expect(findRowIndexByField(headers, rows, 'id', '999')).toBe(-1);
  });

  it('returns -1 when the field itself does not exist in headers', () => {
    expect(findRowIndexByField(headers, rows, 'nonexistent_field', '1')).toBe(-1);
  });
});
