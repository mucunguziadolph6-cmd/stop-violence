CREATE FUNCTION public.list_pending_staff() RETURNS TABLE(user_id uuid, display_name text, staff_title text, school_name text, created_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.is_site_owner() THEN RAISE EXCEPTION 'Owner access required'; END IF;
 RETURN QUERY SELECT m.user_id, COALESCE(p.display_name,''), m.staff_title, s.name, m.created_at FROM public.school_memberships m JOIN public.schools s ON s.id=m.school_id LEFT JOIN public.profiles p ON p.id=m.user_id WHERE m.member_role='staff' AND m.status='pending' ORDER BY m.created_at;
END $$;
REVOKE ALL ON FUNCTION public.list_pending_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_staff() TO authenticated;