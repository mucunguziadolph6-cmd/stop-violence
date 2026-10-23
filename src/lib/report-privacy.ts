export type SharedReport = { id: string; description: string; location: string; category: string; summary: string; created_at: string };

export function sharedReport(row: SharedReport): SharedReport {
  return { id: row.id, description: row.description, location: row.location, category: row.category, summary: row.summary, created_at: row.created_at };
}