import { describe, expect, it } from 'vitest';
import { findDuplicateRows, normalizeName, parseCsv, rowsFromCsv } from '@/lib/student-verification';

describe('normalizeName', () => {
  it('ignores uppercase/lowercase and extra spaces', () => {
    expect(normalizeName('  Aline   UWASE ')).toBe('aline uwase');
    expect(normalizeName('ALINE UWASE')).toBe(normalizeName('aline  uwase'));
  });
});

describe('parseCsv', () => {
  it('parses simple rows and CRLF endings', () => {
    expect(parseCsv('a,b\r\nc,d\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });
  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('"GS, Kigali","say ""hi"""')).toEqual([['GS, Kigali', 'say "hi"']]);
  });
  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

describe('rowsFromCsv', () => {
  it('maps rows by header name regardless of column order', () => {
    const { rows, error } = rowsFromCsv('full_name,student_code,school_name\nAline Uwase,200285,GS Kigali', ['school_name', 'student_code', 'full_name']);
    expect(error).toBeNull();
    expect(rows).toEqual([{ school_name: 'GS Kigali', student_code: '200285', full_name: 'Aline Uwase' }]);
  });
  it('reports a missing column', () => {
    const { error } = rowsFromCsv('school_name,full_name\nGS Kigali,Aline', ['school_name', 'student_code', 'full_name']);
    expect(error).toContain('student_code');
  });
  it('rejects an empty file', () => {
    expect(rowsFromCsv('   \n', ['a']).error).toBe('The file is empty.');
  });
});

describe('findDuplicateRows', () => {
  it('flags both copies of a duplicate, case-insensitively', () => {
    const rows = [
      { school_name: 'GS Kigali', student_code: '200285' },
      { school_name: 'gs kigali', student_code: '200285' },
      { school_name: 'GS Kigali', student_code: '200286' },
    ];
    expect([...findDuplicateRows(rows, ['school_name', 'student_code'])].sort()).toEqual([0, 1]);
  });
  it('treats the same code at different schools as distinct', () => {
    const rows = [
      { school_name: 'GS A', student_code: '200285' },
      { school_name: 'GS B', student_code: '200285' },
    ];
    expect(findDuplicateRows(rows, ['school_name', 'student_code']).size).toBe(0);
  });
});
