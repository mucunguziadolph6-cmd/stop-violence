-- Photos live in private bucket 'report-photos', path: <owner_id>/<report_file>
-- Only the owner can upload, read, or delete their own photo files.
create policy "report_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "report_photos_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "report_photos_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);