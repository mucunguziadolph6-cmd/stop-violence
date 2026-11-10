-- Add human-readable location columns while preserving existing school records and
-- the sector_id foreign key used by the registration flow.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS sector text;

-- Safely populate location labels for existing schools that already reference a
-- sector. No school rows are deleted or otherwise replaced.
UPDATE public.schools AS school
SET province = province_row.name,
    district = district_row.name,
    sector = sector_row.name
FROM public.sectors AS sector_row
JOIN public.districts AS district_row ON district_row.id = sector_row.district_id
JOIN public.provinces AS province_row ON province_row.id = district_row.province_id
WHERE school.sector_id = sector_row.id
  AND (school.province IS NULL OR school.district IS NULL OR school.sector IS NULL);

-- Existing uniqueness was global by school name; uniqueness should be scoped to
-- a sector so same-named schools can exist in different locations.
DROP INDEX IF EXISTS public.schools_name_unique;
CREATE UNIQUE INDEX IF NOT EXISTS schools_name_sector_unique
  ON public.schools (name, sector_id);

-- Public users need to read the directory before they have accounts. Keep all
-- writes restricted to trusted server-side/service-role operations.
DROP POLICY IF EXISTS "Signed in school directory" ON public.schools;
DROP POLICY IF EXISTS "Public school directory" ON public.schools;
REVOKE ALL ON TABLE public.schools FROM anon, authenticated;
GRANT SELECT ON TABLE public.schools TO anon, authenticated;
GRANT ALL ON TABLE public.schools TO service_role;
CREATE POLICY "Public school directory"
  ON public.schools
  FOR SELECT
  TO anon, authenticated
  USING (true);
