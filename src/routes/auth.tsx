const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(100),
  fullName: z.string().trim().min(2).max(100),
  schoolCode: z.string().trim().regex(/^\d{6}$/),
  schoolId: z.string().uuid(),
  sectorId: z.string().uuid(),
});

export const registerStudent = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id, sector_id, active')
      .eq('id', data.schoolId)
      .maybeSingle();

    // schools have no sector data yet, so only compare when one is stored
    if (!school || !school.active || (school.sector_id && school.sector_id !== data.sectorId)) {
      throw new Error(VERIFY_ERROR);
    }

    const { data: schoolLookup, error: lookupError } = await supabaseAdmin.rpc('get_school_by_code', { p_code: data.schoolCode });
    const matchedSchool = Array.isArray(schoolLookup) ? schoolLookup[0] : schoolLookup;
    if (lookupError || !matchedSchool || matchedSchool.id !== data.schoolId) {
      throw new Error('Invalid school code');
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.fullName, school_role: 'student' },
    });

    if (createError || !created.user) {
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
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error('Could not create the account. Please try again.');
    }

    return { ok: true };
  });
