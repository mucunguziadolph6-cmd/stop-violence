-- Add the district represented by school names like "School — District".
-- Preserve every school row and only fill empty district values.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS district text;

UPDATE public.schools
SET district = NULLIF(btrim(split_part(name, '—', 2)), '')
WHERE position('—' IN name) > 0
  AND (district IS NULL OR btrim(district) = '');

-- Keep the school directory readable during anonymous signup, without granting
-- anonymous users any write privileges.
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read schools" ON public.schools;
CREATE POLICY "Anyone can read schools"
  ON public.schools
  FOR SELECT
  TO anon, authenticated
  USING (true);
REVOKE INSERT, UPDATE, DELETE ON TABLE public.schools FROM anon;
GRANT SELECT ON TABLE public.schools TO anon, authenticated;
