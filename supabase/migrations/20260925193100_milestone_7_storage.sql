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
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "attendance_selfies_staff_upload_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'attendance-selfies'
    and public.is_active_user()
    and name ~ '^attendance/[0-9a-fA-F-]{36}/[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9a-fA-F-]{36}/clock-(in|out)\.jpg$'
    and (storage.foldername(name))[1] = 'attendance'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1
      from public.attendance_records ar
      where ar.id::text = (storage.foldername(name))[6]
        and ar.employee_id = auth.uid()
        and ar.attendance_date::text = concat_ws(
          '-',
          (storage.foldername(name))[3],
          (storage.foldername(name))[4],
          (storage.foldername(name))[5]
        )
    )
    and lower(storage.extension(name)) = 'jpg'
  );

create policy "attendance_selfies_select_own_or_manager"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'attendance-selfies'
    and (
      ((storage.foldername(name))[1] = 'attendance'
        and (storage.foldername(name))[2] = auth.uid()::text
        and public.is_active_user())
      or public.is_manager()
    )
  );

create or replace function public.attach_attendance_selfie(
  p_attendance_id uuid,
  p_event_type text,
  p_photo_path text
)
returns public.attendance_records
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_record public.attendance_records;
  v_event_type text;
  v_expected_file text;
  v_expected_path text;
  v_updated_record public.attendance_records;
begin
  if not public.is_active_user() then
    raise exception 'Only active users can attach attendance evidence.';
  end if;

  v_event_type := replace(lower(btrim(coalesce(p_event_type, ''))), '-', '_');

  if v_event_type not in ('clock_in', 'clock_out') then
    raise exception 'Attendance evidence must be for clock_in or clock_out.';
  end if;

  select *
  into v_record
  from public.attendance_records ar
  where ar.id = p_attendance_id
    and ar.employee_id = auth.uid();

  if not found then
    raise exception 'Attendance record was not found for the current user.';
  end if;

  v_expected_file := replace(v_event_type, '_', '-');
  v_expected_path := concat(
    'attendance/',
    auth.uid()::text,
    '/',
    to_char(v_record.attendance_date, 'YYYY/MM/DD'),
    '/',
    v_record.id::text,
    '/',
    v_expected_file,
    '.jpg'
  );

  if p_photo_path is distinct from v_expected_path then
    raise exception 'Attendance evidence path does not match the official attendance record.';
  end if;

  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'attendance-selfies'
      and so.name = p_photo_path
  ) then
    raise exception 'Attendance evidence has not been uploaded.';
  end if;

  if v_event_type = 'clock_in' then
    if v_record.clock_in_at is null then
      raise exception 'Clock-in must be recorded before attaching clock-in evidence.';
    end if;

    if v_record.clock_in_photo_path is not null then
      raise exception 'Clock-in evidence is already attached.';
    end if;

    update public.attendance_records
    set clock_in_photo_path = p_photo_path
    where id = v_record.id
    returning * into v_updated_record;
  else
    if v_record.clock_out_at is null then
      raise exception 'Clock-out must be recorded before attaching clock-out evidence.';
    end if;

    if v_record.clock_out_photo_path is not null then
      raise exception 'Clock-out evidence is already attached.';
    end if;

    update public.attendance_records
    set clock_out_photo_path = p_photo_path
    where id = v_record.id
    returning * into v_updated_record;
  end if;

  return v_updated_record;
end;
$$;

grant execute on function public.attach_attendance_selfie(uuid, text, text) to authenticated;
