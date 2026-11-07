// Client-safe helpers for student verification and admin CSV imports.

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Minimal CSV parser: handles quoted fields, commas inside quotes, and CRLF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

// Maps CSV text to objects keyed by the expected columns (header row required).
export function rowsFromCsv(
  text: string,
  columns: string[],
): { rows: Record<string, string>[]; error: string | null } {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], error: 'The file is empty.' };
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase().replace(/^﻿/, ''));
  for (const col of columns) {
    if (!header.includes(col)) return { rows: [], error: `Missing column "${col}". Expected: ${columns.join(', ')}.` };
  }
  const rows = table.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    columns.forEach((col) => { obj[col] = (r[header.indexOf(col)] ?? '').trim(); });
    return obj;
  });
  return { rows, error: null };
}

// Flags duplicate rows by the given keys (case-insensitive). Returns a set of duplicate row indexes.
export function findDuplicateRows(rows: Record<string, string>[], keys: string[]): Set<number> {
  const seen = new Map<string, number>();
  const dupes = new Set<number>();
  rows.forEach((row, i) => {
    const k = keys.map((key) => (row[key] ?? '').toLowerCase()).join('|');
    const first = seen.get(k);
    if (first === undefined) seen.set(k, i);
    else { dupes.add(first); dupes.add(i); }
  });
  return dupes;
}
