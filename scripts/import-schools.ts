import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';

const csvPath = new URL('../data/schools.csv', import.meta.url);
const requiredHeaders = ['name', 'province', 'district', 'sector'] as const;

type SchoolCsvRow = Record<(typeof requiredHeaders)[number], string>;
type LocationRow = { id: string; name: string; province_id?: string; district_id?: string };

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  return rows;
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function locationKey(value: string): string {
  return clean(value).toLocaleLowerCase('en');
}

function capitalizeName(value: string): string {
  const cleaned = clean(value).toLocaleLowerCase('en');
  return cleaned.replace(/(^|[\s'’\-])([\p{L}])/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('en')}`);
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.');
  }

  let csv: string;
  try {
    csv = await readFile(csvPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('data/schools.csv is missing. Create it with the header: name,province,district,sector');
    }
    throw error;
  }

  const parsed = parseCsv(csv.replace(/^\uFEFF/, ''));
  if (!parsed.length) throw new Error('CSV is empty. Add the header row: name,province,district,sector');
  const headers = parsed[0]!.map(clean);
  if (headers.length !== requiredHeaders.length || requiredHeaders.some((header, i) => headers[i] !== header)) {
    throw new Error(`CSV headers must be exactly: ${requiredHeaders.join(',')}`);
  }
  const rows: SchoolCsvRow[] = parsed.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} has ${cells.length} values; expected ${headers.length}.`);
    }
    return Object.fromEntries(requiredHeaders.map((header, i) => [header, clean(cells[i] ?? '')])) as SchoolCsvRow;
  });

  if (!rows.length) {
    console.log('No school rows found; the CSV template is ready to be filled in.');
    return;
  }

  // This key is only used locally by this import script; it is never bundled into the app.
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: provinces, error: provincesError }, { data: districts, error: districtsError }, { data: sectors, error: sectorsError }] = await Promise.all([
    supabase.from('provinces').select('id,name'),
    supabase.from('districts').select('id,name,province_id'),
    supabase.from('sectors').select('id,name,district_id'),
  ]);
  if (provincesError || districtsError || sectorsError) {
    throw new Error(`Unable to load canonical locations: ${provincesError?.message ?? districtsError?.message ?? sectorsError?.message}`);
  }

  const provinceByKey = new Map((provinces ?? []).map((p) => [locationKey(p.name), p as LocationRow]));
  const districtsByKey = new Map<string, LocationRow>();
  for (const district of (districts ?? []) as LocationRow[]) {
    const province = (provinces ?? []).find((p) => p.id === district.province_id);
    if (province) districtsByKey.set(`${locationKey(province.name)}|${locationKey(district.name)}`, district);
  }
  const sectorsByKey = new Map<string, LocationRow>();
  for (const sector of (sectors ?? []) as LocationRow[]) {
    const district = (districts ?? []).find((d) => d.id === sector.district_id);
    const province = district && (provinces ?? []).find((p) => p.id === district.province_id);
    if (district && province) sectorsByKey.set(`${locationKey(province.name)}|${locationKey(district.name)}|${locationKey(sector.name)}`, sector);
  }

  const insertedBySector = new Map<string, number>();
  let skipped = 0;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!;
    const line = index + 2;
    const name = capitalizeName(row.name);
    const province = provinceByKey.get(locationKey(row.province));
    const district = districtsByKey.get(`${locationKey(row.province)}|${locationKey(row.district)}`);
    const sector = sectorsByKey.get(`${locationKey(row.province)}|${locationKey(row.district)}|${locationKey(row.sector)}`);
    if (!name || !province || !district || !sector) {
      console.warn(`Row ${line}: location/name did not match the dropdown data; skipped. Check: ${JSON.stringify(row)}`);
      skipped++;
      continue;
    }

    const canonicalProvince = province.name;
    const canonicalDistrict = district.name;
    const canonicalSector = sector.name;
    const { data: existing, error: lookupError } = await supabase
      .from('schools')
      .select('id')
      .eq('name', name)
      .eq('sector_id', sector.id)
      .maybeSingle();
    if (lookupError) throw new Error(`Row ${line}: duplicate check failed: ${lookupError.message}`);

    const { error: upsertError } = await supabase.from('schools').upsert({
      name,
      province: canonicalProvince,
      district: canonicalDistrict,
      sector: canonicalSector,
      sector_id: sector.id,
      active: true,
    }, { onConflict: 'name,sector_id' });
    if (upsertError) {
      console.warn(`Row ${line}: could not save ${JSON.stringify(name)}: ${upsertError.message}`);
      skipped++;
      continue;
    }
    if (existing) {
      console.log(`Row ${line}: already present, updated location labels for ${name} (${canonicalSector}).`);
    } else {
      const key = `${canonicalProvince} / ${canonicalDistrict} / ${canonicalSector}`;
      insertedBySector.set(key, (insertedBySector.get(key) ?? 0) + 1);
    }
  }

  console.log('\nNew schools inserted per sector:');
  for (const [sector, count] of [...insertedBySector.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${sector}: ${count}`);
  }
  console.log(`Total newly inserted: ${[...insertedBySector.values()].reduce((sum, count) => sum + count, 0)}; skipped: ${skipped}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
