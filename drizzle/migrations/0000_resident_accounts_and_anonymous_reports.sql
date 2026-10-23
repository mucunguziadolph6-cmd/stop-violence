CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 100)
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE FUNCTION public.create_resident_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
 INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', ''), 100));
 RETURN NEW;
END; $$;
CREATE TRIGGER create_resident_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_resident_profile();
CREATE TABLE public.reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 10 AND 2000),
 location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 200),
 category text NOT NULL DEFAULT '',
 summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 300),
 photo_path text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (photo_path IS NULL OR photo_path LIKE owner_id::text || '/%')
);
GRANT SELECT, INSERT, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own reports" ON public.reports FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Create own reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Delete own reports" ON public.reports FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE INDEX reports_created_at_idx ON public.reports(created_at DESC);
CREATE INDEX reports_owner_idx ON public.reports(owner_id);
CREATE FUNCTION public.list_shared_reports(page_number integer DEFAULT 0) RETURNS TABLE(id uuid, description text, location text, category text, summary text, created_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT r.id, r.description, r.location, r.category, r.summary, r.created_at FROM public.reports r ORDER BY r.created_at DESC, r.id LIMIT 30 OFFSET (greatest(0, least(page_number, 10000)) * 30);
$$;
REVOKE ALL ON FUNCTION public.list_shared_reports(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_shared_reports(integer) TO anon, authenticated, service_role;
CREATE POLICY "Upload own report photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Read own report photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Delete own report photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);