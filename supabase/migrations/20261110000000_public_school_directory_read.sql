-- The existing directory policy is in drizzle/migrations/0006_student_verification_locations.sql.
-- This Supabase CLI migration keeps anonymous registration able to read schools and
-- explicitly prevents the anon role from writing to the table.
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read schools" ON public.schools;
CREATE POLICY "Anyone can read schools"
  ON public.schools
  FOR SELECT
  TO anon, authenticated
  USING (true);
REVOKE INSERT, UPDATE, DELETE ON TABLE public.schools FROM anon;
GRANT SELECT ON TABLE public.schools TO anon, authenticated;
