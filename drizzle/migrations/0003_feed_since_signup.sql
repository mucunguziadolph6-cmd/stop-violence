CREATE OR REPLACE FUNCTION public.list_reports_since_signup(page_number integer DEFAULT 0)
RETURNS TABLE(id uuid, description text, location text, category text, summary text, created_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
 SELECT r.id, r.description, r.location, r.category, r.summary, r.created_at
 FROM public.reports r
 WHERE auth.uid() IS NOT NULL
   AND r.created_at >= (SELECT u.created_at FROM auth.users u WHERE u.id = auth.uid())
 ORDER BY r.created_at DESC, r.id
 LIMIT 30 OFFSET (greatest(0, least(page_number, 10000)) * 30);
$$;
REVOKE ALL ON FUNCTION public.list_reports_since_signup(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_reports_since_signup(integer) TO authenticated, service_role;