insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'attendance-selfies',
  'attendance-selfies',
  false,
  5242880,
  array['image/jpeg']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "attendance_selfies_staff_upload_own" on storage.objects;
drop policy if exists "attendance_selfies_insert_own_folder" on storage.objects;
drop policy if exists "attendance_selfies_no_update" on storage.objects;
drop policy if exists "attendance_selfies_no_delete" on storage.objects;

create policy "attendance_selfies_insert_own_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'attendance-selfies'
    and public.is_active_user()
    and name like ('attendance/' || auth.uid()::text || '/%')
  );

create policy "attendance_selfies_no_update"
  on storage.objects
  for update
  to authenticated
  using (false)
  with check (false);

create policy "attendance_selfies_no_delete"
  on storage.objects
  for delete
  to authenticated
  using (false);

grant insert on storage.objects to authenticated;
