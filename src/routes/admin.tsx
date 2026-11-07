import { createFileRoute, Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useResident } from '@/components/resident-session';
import { Button } from '@/components/ui/button';
import { rowsFromCsv, findDuplicateRows, normalizeName } from '@/lib/student-verification';
import {
  adminAddSchool,
  adminAddStudentCode,
  adminImportLocations,
  adminImportSchools,
  adminImportStudentCodes,
  adminListStudentCodes,
  type ImportResult,
  type StudentCodeRow,
} from '@/lib/students.functions';
import bgAsset from '@/assets/stop-violence-choose-peace.png.asset.json';

export const Route = createFileRoute('/admin')({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: 'Admin | Stop Violence — Choose Peace' },
    { name: 'description', content: 'Manage schools, student codes and locations.' },
    { name: 'robots', content: 'noindex' },
    { property: 'og:title', content: 'Admin | Stop Violence — Choose Peace' },
    { property: 'og:description', content: 'Manage schools, student codes and locations.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: AdminPage,
});

const field = 'w-full rounded-md border border-input bg-card px-3 py-2 text-sm';
type Loc = { id: string; name: string };

function AdminPage() {
  const { user, ready } = useResident();
  const [owner, setOwner] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'students' | 'schools' | 'locations'>('students');
  useEffect(() => {
    if (!user) { setOwner(null); return; }
    void supabase.rpc('is_site_owner').then(({ data }) => setOwner(!!data));
  }, [user]);

  return (
    <main className="relative min-h-screen px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${bgAsset.url})` }} />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-background/85" />
      <div className="mx-auto max-w-2xl">
        <Button variant="link" asChild><Link to="/">← Community reports</Link></Button>
        <h1 className="mt-5 text-3xl font-bold">Admin</h1>
        {!ready || (user && owner === null) ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          : !user ? <p className="mt-6 text-sm">Please <Link to="/auth" className="underline">sign in</Link> first.</p>
          : !owner ? <p className="mt-6 text-sm">This page is for site administrators only.</p>
          : (
            <div className="mt-6 space-y-4">
              <div className="flex gap-2">
                <Button variant={tab === 'students' ? 'default' : 'outline'} onClick={() => setTab('students')}>Students</Button>
                <Button variant={tab === 'schools' ? 'default' : 'outline'} onClick={() => setTab('schools')}>Schools</Button>
                <Button variant={tab === 'locations' ? 'default' : 'outline'} onClick={() => setTab('locations')}>Locations</Button>
              </div>
              {tab === 'students' && <StudentsTab />}
              {tab === 'schools' && <SchoolsTab />}
              {tab === 'locations' && <LocationsTab />}
            </div>
          )}
      </div>
    </main>
  );
}

// Cascading Province → District → Sector picker, shared by the Schools tab.
function LocationPicker({ onSector }: { onSector: (sectorId: string) => void }) {
  const [provinces, setProvinces] = useState<Loc[]>([]);
  const [districts, setDistricts] = useState<Loc[]>([]);
  const [sectors, setSectors] = useState<Loc[]>([]);
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [sector, setSector] = useState('');
  useEffect(() => {
    void supabase.from('provinces').select('id,name').order('name').then(({ data }) => setProvinces(data ?? []));
  }, []);
  useEffect(() => {
    setDistricts([]); setDistrict(''); setSectors([]); setSector(''); onSector('');
    if (!province) return;
    void supabase.from('districts').select('id,name').eq('province_id', province).order('name').then(({ data }) => setDistricts(data ?? []));
  }, [province]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSectors([]); setSector(''); onSector('');
    if (!district) return;
    void supabase.from('sectors').select('id,name').eq('district_id', district).order('name').then(({ data }) => setSectors(data ?? []));
  }, [district]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-2">
      <select aria-label="Province" className={field} value={province} onChange={(e) => setProvince(e.target.value)}>
        <option value="">Choose province…</option>
        {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select aria-label="District" className={field} value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!province}>
        <option value="">Choose district…</option>
        {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <select aria-label="Sector" className={field} value={sector} onChange={(e) => { setSector(e.target.value); onSector(e.target.value); }} disabled={!district}>
        <option value="">Choose sector…</option>
        {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
}

// Searchable school picker, shared by the Students tab.
function SchoolPicker({ school, onPick }: { school: string; onPick: (id: string) => void }) {
  const [schools, setSchools] = useState<Loc[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => {
    void (async () => {
      const all: Loc[] = [];
      for (let p = 0; p < 4; p++) {
        const { data } = await supabase.from('schools').select('id,name').order('name').range(p * 1000, p * 1000 + 999);
        all.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      setSchools(all);
    })();
  }, []);
  const q = query.trim().toLowerCase();
  const matches = q ? schools.filter((s) => s.name.toLowerCase().includes(q) || s.id === school) : schools;
  return (
    <div className="space-y-2">
      <input aria-label="Search school" className={field} placeholder="Type to search schools…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <select aria-label="School" className={field} value={school} onChange={(e) => onPick(e.target.value)}>
        <option value="">{matches.length ? `Choose school (${matches.length} found)…` : 'No school matches'}</option>
        {matches.slice(0, 300).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
}

// Shared CSV upload + preview. onImport receives validated rows and returns the server result.
function CsvImport({
  columns,
  label,
  validateRow,
  dupeKeys,
  onImport,
}: {
  columns: string[];
  label: string;
  validateRow: (row: Record<string, string>) => string | null;
  dupeKeys?: string[];
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
}) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dupes = dupeKeys ? findDuplicateRows(rows, dupeKeys) : new Set<number>();
  const rowErrors = rows.map((row, i) => (dupes.has(i) ? 'Duplicate inside the file' : validateRow(row)));
  const validRows = rows.filter((_, i) => !rowErrors[i]);

  async function pickFile(file: File) {
    setResult(null); setParseError('');
    const { rows: parsed, error } = rowsFromCsv(await file.text(), columns);
    if (error) { setParseError(error); setRows([]); return; }
    if (parsed.length > 500) { setParseError('Too many rows — import at most 500 at a time.'); setRows([]); return; }
    setRows(parsed);
  }
  async function runImport() {
    setBusy(true);
    try {
      const res = await onImport(validRows);
      setResult(res);
      if (!res.errors.length) { setRows([]); if (fileRef.current) fileRef.current.value = ''; }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">CSV columns: {columns.join(', ')}</p>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); }} />
      {parseError && <p className="text-sm text-destructive">{parseError}</p>}
      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Preview: {rows.length} rows · {validRows.length} ready · {rows.length - validRows.length} with problems</p>
          <div className="max-h-56 overflow-y-auto rounded border">
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-muted">{columns.map((c) => <th key={c} className="px-2 py-1 text-left font-medium">{c}</th>)}<th className="px-2 py-1 text-left font-medium">status</th></tr></thead>
              <tbody>
                {rows.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {columns.map((c) => <td key={c} className="px-2 py-1">{row[c]}</td>)}
                    <td className={`px-2 py-1 ${rowErrors[i] ? 'text-destructive' : 'text-muted-foreground'}`}>{rowErrors[i] ?? 'ok'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 100 && <p className="px-2 py-1 text-xs text-muted-foreground">…and {rows.length - 100} more rows</p>}
          </div>
          <Button type="button" size="sm" onClick={runImport} disabled={busy || !validRows.length}>
            {busy ? 'Importing…' : `Import ${validRows.length} valid row${validRows.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      )}
      {result && (
        <div className="text-sm">
          <p>{result.imported} imported successfully.</p>
          {result.errors.length > 0 && (
            <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-destructive">
              {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.reason}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StudentsTab() {
  const [school, setSchool] = useState('');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [codes, setCodes] = useState<StudentCodeRow[]>([]);
  const [busy, setBusy] = useState(false);

  const loadCodes = useCallback(async (schoolId: string) => {
    try { setCodes(await adminListStudentCodes({ data: { schoolId } })); }
    catch { toast.error('Could not load student codes'); }
  }, []);
  useEffect(() => { if (school) void loadCodes(school); else setCodes([]); }, [school, loadCodes]);

  async function addOne() {
    if (!school) { toast.error('Choose a school first'); return; }
    setBusy(true);
    try {
      await adminAddStudentCode({ data: { schoolId: school, studentCode: code.trim(), fullName: fullName.trim() } });
      toast.success('Student added'); setCode(''); setFullName(''); void loadCodes(school);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not add the student'); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Student codes</h2>
      <SchoolPicker school={school} onPick={setSchool} />
      <div className="space-y-2">
        <p className="text-sm font-medium">Add one student</p>
        <input aria-label="Student code" className={field} placeholder="Student code (e.g. 200285)" maxLength={50} value={code} onChange={(e) => setCode(e.target.value)} />
        <input aria-label="Full name" className={field} placeholder="Full name" maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Button type="button" size="sm" onClick={addOne} disabled={busy || !code.trim() || fullName.trim().length < 2}>Add student</Button>
      </div>
      <CsvImport
        label="Import students from CSV"
        columns={['school_name', 'student_code', 'full_name']}
        dupeKeys={['school_name', 'student_code']}
        validateRow={(r) => (!r.school_name || !r.student_code || !r.full_name ? 'All columns are required' : null)}
        onImport={async (rows) => {
          const res = await adminImportStudentCodes({ data: { rows: rows.map((r) => ({ school_name: r['school_name'] ?? '', student_code: r['student_code'] ?? '', full_name: r['full_name'] ?? '' })) } });
          if (school) void loadCodes(school);
          return res;
        }}
      />
      {school && (
        <div>
          <p className="text-sm font-medium">Codes for the selected school ({codes.length})</p>
          {!codes.length ? <p className="mt-1 text-xs text-muted-foreground">No codes yet for this school.</p> : (
            <ul className="mt-1 max-h-64 divide-y overflow-y-auto rounded border text-sm">
              {codes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span>{c.full_name} · <span className="font-mono text-xs">{c.student_code}</span></span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.used ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>{c.used ? 'used' : 'unused'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SchoolsTab() {
  const [sector, setSector] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!sector) { toast.error('Choose the sector first'); return; }
    setBusy(true);
    try {
      await adminAddSchool({ data: { name: name.trim(), sectorId: sector } });
      toast.success('School added'); setName('');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not add the school'); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Add a school</h2>
      <LocationPicker onSector={setSector} />
      <input aria-label="School name" className={field} placeholder="School name" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
      <Button type="button" size="sm" onClick={add} disabled={busy || !sector || name.trim().length < 2}>Add school</Button>
      <CsvImport
        label="Import schools from CSV"
        columns={['school_name', 'province', 'district', 'sector']}
        dupeKeys={['school_name', 'sector', 'district']}
        validateRow={(r) => (!r.school_name || !r.province || !r.district || !r.sector ? 'All columns are required' : null)}
        onImport={(rows) => adminImportSchools({ data: { rows: rows.map((r) => ({ school_name: r['school_name'] ?? '', province: r['province'] ?? '', district: r['district'] ?? '', sector: r['sector'] ?? '' })) } })}
      />
    </div>
  );
}

function LocationsTab() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Locations</h2>
      <p className="text-sm text-muted-foreground">
        Rwanda's 5 provinces, 30 districts and 416 sectors are already loaded. Import a CSV to correct or complete the list — existing names are kept, missing ones are added.
      </p>
      <CsvImport
        label="Import locations from CSV"
        columns={['province', 'district', 'sector']}
        dupeKeys={['province', 'district', 'sector']}
        validateRow={(r) => (!r.province || !r.district || !r.sector ? 'All columns are required' : null)}
        onImport={async (rows) => {
          const res = await adminImportLocations({ data: { rows: rows.map((r) => ({ province: r['province'] ?? '', district: r['district'] ?? '', sector: r['sector'] ?? '' })) } });
          return { imported: res.sectors, errors: res.errors };
        }}
      />
    </div>
  );
}
