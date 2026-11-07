import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { normalizeName } from './student-verification';

const VERIFY_ERROR = "We couldn't verify your student details. Please check them or contact your school.";

const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(100),
  fullName: z.string().trim().min(2).max(100),
  studentCode: z.string().trim().min(1).max(50),
  schoolId: z.string().uuid(),
  sectorId: z.string().uuid(),
});

// Public endpoint: creates a student account only when a valid, unused
// student code matches the school and full name. Never reveals which part failed.
export const registerStudent = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // (a) The school must exist, be active, and belong to the selected sector.
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id, sector_id, active')
      .eq('id', data.schoolId)
      .maybeSingle();
    if (!school || !school.active || school.sector_id !== data.sectorId) {
      throw new Error(VERIFY_ERROR);
    }

    // (b)(c)(d) Atomically consume a matching, unused code (name compared
    // ignoring case and extra spaces). The UNIQUE(school_id, student_code)
    // constraint plus the used=false filter make this race-safe.
    const { data: codeRow } = await supabaseAdmin
      .from('student_codes')
      .update({ used: true })
      .eq('school_id', data.schoolId)
      .eq('student_code', data.studentCode)
      .eq('used', false)
      .ilike('full_name', normalizeName(data.fullName).replace(/ /g, '%'))
      .select('id, full_name')
      .maybeSingle();

    // ilike with % wildcards is a pre-filter; confirm the normalized match exactly.
    const matched = codeRow && normalizeName(codeRow.full_name) === normalizeName(data.fullName) ? codeRow : null;
    if (codeRow && !matched) {
      await supabaseAdmin.from('student_codes').update({ used: false }).eq('id', codeRow.id);
    }
    if (!matched) throw new Error(VERIFY_ERROR);

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: matched.full_name, school_role: 'student' },
    });
    if (createError || !created.user) {
      await supabaseAdmin.from('student_codes').update({ used: false }).eq('id', matched.id);
      if (createError && /already|registered|exists/i.test(createError.message)) {
        throw new Error('You already have an account — sign in instead.');
      }
      throw new Error('Could not create the account. Please try again.');
    }

    const { error: memberError } = await supabaseAdmin.from('school_memberships').insert({
      user_id: created.user.id,
      school_id: data.schoolId,
      member_role: 'student',
      status: 'approved',
    });
    if (memberError) {
      // Roll back the account and the code so the student can try again.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      await supabaseAdmin.from('student_codes').update({ used: false }).eq('id', matched.id);
      throw new Error('Could not create the account. Please try again.');
    }
    return { ok: true };
  });

async function requireOwner(supabase: SupabaseClient<Database>) {
  const { data } = await supabase.rpc('is_site_owner');
  if (!data) throw new Error('Admins only');
}

export type ImportRowError = { row: number; reason: string };
export type ImportResult = { imported: number; errors: ImportRowError[] };

const MAX_IMPORT_ROWS = 500;

export const adminAddSchool = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().trim().min(2).max(200), sectorId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: sector } = await supabaseAdmin.from('sectors').select('id').eq('id', data.sectorId).maybeSingle();
    if (!sector) throw new Error('Choose a valid sector');
    const { error } = await supabaseAdmin.from('schools').insert({ name: data.name, sector_id: data.sectorId });
    if (error) throw new Error('Could not add the school');
    return { ok: true };
  });

const schoolRowSchema = z.object({
  school_name: z.string().trim().min(2).max(200),
  province: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
  sector: z.string().trim().min(1).max(100),
});

export const adminImportSchools = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ rows: z.array(schoolRowSchema).min(1).max(MAX_IMPORT_ROWS) }).parse(data))
  .handler(async ({ data, context }): Promise<ImportResult> => {
    await requireOwner(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const [{ data: sectors }, { data: districts }, { data: provinces }] = await Promise.all([
      supabaseAdmin.from('sectors').select('id, name, district_id'),
      supabaseAdmin.from('districts').select('id, name, province_id'),
      supabaseAdmin.from('provinces').select('id, name'),
    ]);
    const provinceName = new Map((provinces ?? []).map((p) => [p.id, normalizeName(p.name)]));
    const districtById = new Map((districts ?? []).map((d) => [d.id, d]));
    const result: ImportResult = { imported: 0, errors: [] };
    const seen = new Set<string>();
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i]!;
      const key = `${normalizeName(row.school_name)}|${normalizeName(row.sector)}|${normalizeName(row.district)}`;
      if (seen.has(key)) { result.errors.push({ row: i + 1, reason: 'Duplicate inside the file' }); continue; }
      seen.add(key);
      const sector = (sectors ?? []).find((s) => {
        const district = districtById.get(s.district_id);
        return normalizeName(s.name) === normalizeName(row.sector)
          && district && normalizeName(district.name) === normalizeName(row.district)
          && provinceName.get(district.province_id) === normalizeName(row.province);
      });
      if (!sector) { result.errors.push({ row: i + 1, reason: 'Location not found (check province, district, sector spelling)' }); continue; }
      const { error } = await supabaseAdmin.from('schools').insert({ name: row.school_name, sector_id: sector.id });
      if (error) result.errors.push({ row: i + 1, reason: 'Could not save (maybe the school already exists there)' });
      else result.imported++;
    }
    return result;
  });

export const adminAddStudentCode = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      schoolId: z.string().uuid(),
      studentCode: z.string().trim().min(1).max(50),
      fullName: z.string().trim().min(2).max(100),
    }).parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('student_codes').insert({
      school_id: data.schoolId,
      student_code: data.studentCode,
      full_name: data.fullName,
    });
    if (error) {
      if (error.code === '23505') throw new Error('That code already exists for this school');
      throw new Error('Could not add the student');
    }
    return { ok: true };
  });

const studentRowSchema = z.object({
  school_name: z.string().trim().min(2).max(200),
  student_code: z.string().trim().min(1).max(50),
  full_name: z.string().trim().min(2).max(100),
});

export const adminImportStudentCodes = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ rows: z.array(studentRowSchema).min(1).max(MAX_IMPORT_ROWS) }).parse(data))
  .handler(async ({ data, context }): Promise<ImportResult> => {
    await requireOwner(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const schools: { id: string; name: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: batch } = await supabaseAdmin.from('schools').select('id, name').range(from, from + 999);
      schools.push(...(batch ?? []));
      if (!batch || batch.length < 1000) break;
    }
    const result: ImportResult = { imported: 0, errors: [] };
    const seen = new Set<string>();
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i]!;
      const key = `${normalizeName(row.school_name)}|${row.student_code.toLowerCase()}`;
      if (seen.has(key)) { result.errors.push({ row: i + 1, reason: 'Duplicate inside the file' }); continue; }
      seen.add(key);
      const school = schools.find((s) => normalizeName(s.name) === normalizeName(row.school_name));
      if (!school) { result.errors.push({ row: i + 1, reason: 'School not found' }); continue; }
      const { error } = await supabaseAdmin.from('student_codes').insert({
        school_id: school.id,
        student_code: row.student_code,
        full_name: row.full_name,
      });
      if (error) result.errors.push({ row: i + 1, reason: error.code === '23505' ? 'Code already exists for this school' : 'Could not save' });
      else result.imported++;
    }
    return result;
  });

export type StudentCodeRow = {
  id: string;
  student_code: string;
  full_name: string;
  used: boolean;
  created_at: string;
  school_name: string;
};

export const adminListStudentCodes = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { schoolId?: string }) => ({ schoolId: data?.schoolId }))
  .handler(async ({ data, context }): Promise<StudentCodeRow[]> => {
    await requireOwner(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    let query = supabaseAdmin
      .from('student_codes')
      .select('id, student_code, full_name, used, created_at, schools(name)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (data.schoolId) query = query.eq('school_id', data.schoolId);
    const { data: rows, error } = await query;
    if (error) throw new Error('Could not load student codes');
    return (rows ?? []).map((r) => {
      const school = r.schools as unknown as { name: string } | null;
      return {
        id: r.id,
        student_code: r.student_code,
        full_name: r.full_name,
        used: r.used,
        created_at: r.created_at,
        school_name: school?.name ?? '',
      };
    });
  });

const locationRowSchema = z.object({
  province: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
  sector: z.string().trim().min(1).max(100),
});

export const adminImportLocations = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ rows: z.array(locationRowSchema).min(1).max(MAX_IMPORT_ROWS) }).parse(data))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    let added = { provinces: 0, districts: 0, sectors: 0 };
    const errors: ImportRowError[] = [];
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i]!;
      const { data: prov } = await supabaseAdmin
        .from('provinces').upsert({ name: row.province }, { onConflict: 'name' }).select('id').single();
      if (!prov) { errors.push({ row: i + 1, reason: 'Could not save the province' }); continue; }
      const { data: dist } = await supabaseAdmin
        .from('districts').upsert({ name: row.district, province_id: prov.id }, { onConflict: 'province_id,name' }).select('id').single();
      if (!dist) { errors.push({ row: i + 1, reason: 'Could not save the district' }); continue; }
      const { error } = await supabaseAdmin
        .from('sectors').upsert({ name: row.sector, district_id: dist.id }, { onConflict: 'district_id,name' });
      if (error) errors.push({ row: i + 1, reason: 'Could not save the sector' });
    }
    // Counts of what exists now vs before are not tracked per-row with upsert; report row-level success instead.
    added = { provinces: 0, districts: 0, sectors: data.rows.length - errors.length };
    return { ...added, errors };
  });
