-- Add reusable school join codes and recipient-scoped reports without modifying existing records.
CREATE TABLE public.school_codes (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.school_codes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.school_codes TO authenticated;
GRANT ALL ON public.school_codes TO service_role;

CREATE POLICY "DOS HT and site owners read school codes" ON public.school_codes
  FOR SELECT TO authenticated
  USING (
    public.is_site_owner()
    OR EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.user_id = auth.uid()
        AND m.school_id = school_codes.school_id
        AND m.member_role = 'staff'
        AND m.status = 'approved'
        AND m.staff_title IN ('DOS', 'HT')
    )
  );

-- Keep failed lookups rate-limited without exposing attempt records to clients.
CREATE TABLE public.school_code_attempts (
  bucket_key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.school_code_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_code_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.school_code_attempts TO service_role;
CREATE INDEX school_code_attempts_recent_idx ON public.school_code_attempts(bucket_key, attempted_at DESC);

CREATE FUNCTION public.validate_school_code(input text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized text := upper(btrim(coalesce(input, '')));
  request_headers jsonb;
  caller_key text;
  school uuid;
  failures integer;
BEGIN
  request_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  caller_key := coalesce(
    nullif(auth.uid()::text, ''),
    nullif(request_headers ->> 'x-real-ip', ''),
    nullif(split_part(coalesce(request_headers ->> 'x-forwarded-for', ''), ',', 1), ''),
    'unauthenticated'
  );
  caller_key := md5(caller_key);

  SELECT count(*) INTO failures FROM public.school_code_attempts
  WHERE bucket_key = caller_key AND attempted_at > now() - interval '10 minutes';
  IF failures >= 5 THEN RETURN NULL; END IF;

  SELECT c.school_id INTO school FROM public.school_codes c WHERE c.code = normalized;
  IF school IS NOT NULL THEN RETURN school; END IF;

  INSERT INTO public.school_code_attempts(bucket_key) VALUES (caller_key);
  DELETE FROM public.school_code_attempts WHERE attempted_at < now() - interval '1 day';
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_school_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_school_code(text) TO anon, authenticated, service_role;

CREATE FUNCTION public.regenerate_school_code(_school_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  generated text;
BEGIN
  IF NOT public.is_site_owner() AND NOT EXISTS (
    SELECT 1 FROM public.school_memberships m
    WHERE m.user_id = auth.uid() AND m.school_id = _school_id
      AND m.member_role = 'staff' AND m.status = 'approved'
      AND m.staff_title IN ('DOS', 'HT')
  ) THEN
    RAISE EXCEPTION 'Only this school''s DOS, HT, or a site owner may regenerate its code';
  END IF;

  LOOP
    generated := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.school_codes WHERE code = generated AND school_id <> _school_id);
  END LOOP;
  INSERT INTO public.school_codes(school_id, code) VALUES (_school_id, generated)
  ON CONFLICT (school_id) DO UPDATE SET code = EXCLUDED.code, created_at = now();
  RETURN generated;
END;
$$;
REVOKE ALL ON FUNCTION public.regenerate_school_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_school_code(uuid) TO authenticated, service_role;

-- Trigger generation must not depend on auth.uid(): schools are commonly created
-- by the privileged server client, whose database request has no end-user JWT.
CREATE FUNCTION public.create_school_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE generated text;
BEGIN
  LOOP
    generated := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.school_codes WHERE code = generated);
  END LOOP;
  INSERT INTO public.school_codes(school_id, code) VALUES (NEW.id, generated);
  RETURN NEW;
END;
$$;
CREATE TRIGGER schools_create_reusable_code AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.create_school_code();

-- Backfill schools without changing any existing school or report data.
DO $$
DECLARE school_row record; generated text;
BEGIN
  FOR school_row IN SELECT s.id FROM public.schools s LEFT JOIN public.school_codes c ON c.school_id = s.id WHERE c.school_id IS NULL LOOP
    LOOP
      generated := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.school_codes WHERE code = generated);
    END LOOP;
    INSERT INTO public.school_codes(school_id, code) VALUES (school_row.id, generated);
  END LOOP;
END;
$$;

ALTER TABLE public.reports ADD COLUMN recipients text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.reports ADD CONSTRAINT reports_recipients_allowed CHECK (
  recipients <@ ARRAY['dos', 'head_teacher', 'discipline_master']::text[]
);
CREATE INDEX reports_recipients_gin_idx ON public.reports USING gin(recipients);

-- Staff membership roles live in school_memberships.staff_title; user_roles remains the site-wide app role system.
CREATE FUNCTION public.can_staff_read_report(_school_id uuid, _recipients text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships m
    WHERE m.user_id = auth.uid() AND m.school_id = _school_id
      AND m.member_role = 'staff' AND m.status = 'approved'
      AND CASE m.staff_title
        WHEN 'DOS' THEN ('dos' = ANY(coalesce(_recipients, '{}'::text[])) OR cardinality(coalesce(_recipients, '{}'::text[])) = 0)
        WHEN 'HT' THEN ('head_teacher' = ANY(coalesce(_recipients, '{}'::text[])) OR cardinality(coalesce(_recipients, '{}'::text[])) = 0)
        WHEN 'Discipline Master' THEN ('discipline_master' = ANY(coalesce(_recipients, '{}'::text[])) OR cardinality(coalesce(_recipients, '{}'::text[])) = 0)
        ELSE false
      END
  );
$$;
REVOKE ALL ON FUNCTION public.can_staff_read_report(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_staff_read_report(uuid, text[]) TO authenticated, service_role;

DROP POLICY IF EXISTS "School staff read school reports" ON public.reports;
CREATE POLICY "School staff read recipient reports" ON public.reports FOR SELECT TO authenticated
  USING (public.can_staff_read_report(school_id, recipients));

-- Existing school-less reports retain their existing legacy staff visibility.
DROP POLICY IF EXISTS "Staff read report photos" ON storage.objects;
CREATE POLICY "Staff read report photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-photos' AND EXISTS (
    SELECT 1 FROM public.reports r WHERE r.photo_path = name
      AND ((r.school_id IS NULL AND public.has_role(auth.uid(), 'staff'))
        OR public.can_staff_read_report(r.school_id, r.recipients))
  ));

DROP POLICY IF EXISTS "Participants read private feedback" ON public.report_feedback;
CREATE POLICY "Participants read private feedback" ON public.report_feedback FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id
    AND (r.owner_id = auth.uid() OR public.can_staff_read_report(r.school_id, r.recipients))));
DROP POLICY IF EXISTS "School staff send feedback" ON public.report_feedback;
CREATE POLICY "School staff send feedback" ON public.report_feedback FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.reports r WHERE r.id = report_id
      AND public.can_staff_read_report(r.school_id, r.recipients)
  ));

DROP POLICY IF EXISTS "Recipients read their alerts" ON public.school_notifications;
CREATE POLICY "Recipients read their alerts" ON public.school_notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.reports r WHERE r.id = report_id
      AND (r.owner_id = auth.uid() OR public.can_staff_read_report(r.school_id, r.recipients))
  ));
DROP POLICY IF EXISTS "Recipients mark alerts read" ON public.school_notifications;
CREATE POLICY "Recipients mark alerts read" ON public.school_notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.reports r WHERE r.id = report_id
      AND (r.owner_id = auth.uid() OR public.can_staff_read_report(r.school_id, r.recipients))
  ))
  WITH CHECK (recipient_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.reports r WHERE r.id = report_id
      AND (r.owner_id = auth.uid() OR public.can_staff_read_report(r.school_id, r.recipients))
  ));

CREATE OR REPLACE FUNCTION public.notify_school_staff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.school_id IS NOT NULL THEN
    INSERT INTO public.school_notifications(recipient_id, report_id, kind)
    SELECT m.user_id, NEW.id, 'student_report'
    FROM public.school_memberships m
    WHERE m.school_id = NEW.school_id AND m.member_role = 'staff' AND m.status = 'approved'
      AND CASE m.staff_title
        WHEN 'DOS' THEN ('dos' = ANY(NEW.recipients) OR cardinality(NEW.recipients) = 0)
        WHEN 'HT' THEN ('head_teacher' = ANY(NEW.recipients) OR cardinality(NEW.recipients) = 0)
        WHEN 'Discipline Master' THEN ('discipline_master' = ANY(NEW.recipients) OR cardinality(NEW.recipients) = 0)
        ELSE false
      END;
  END IF;
  RETURN NEW;
END;
$$;

-- The feed is a public/community feed, not a bypass around private school report RLS.
CREATE OR REPLACE FUNCTION public.list_reports_since_signup(page_number integer DEFAULT 0)
RETURNS TABLE(id uuid, description text, location text, category text, summary text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.description, r.location, r.category, r.summary, r.created_at
  FROM public.reports r
  WHERE auth.uid() IS NOT NULL
    AND r.school_id IS NULL
    AND r.created_at >= (SELECT u.created_at FROM auth.users u WHERE u.id = auth.uid())
  ORDER BY r.created_at DESC, r.id
  LIMIT 30 OFFSET (greatest(0, least(page_number, 10000)) * 30)
$$;
