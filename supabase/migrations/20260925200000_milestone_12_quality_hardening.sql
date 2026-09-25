insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attendance-selfies',
  'attendance-selfies',
  false,
  5242880,
  array['image/jpeg']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.clock_in(
  p_clock_in_photo_path text default null,
  p_clock_in_latitude numeric default null,
  p_clock_in_longitude numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_branch public.branches%rowtype;
  v_schedule public.work_schedules%rowtype;
  v_now timestamptz := now();
  v_timezone text := 'Asia/Manila';
  v_attendance_date date;
  v_scheduled_start timestamptz;
  v_scheduled_end timestamptz;
  v_late_minutes integer := 0;
  v_status text := 'present';
  v_record public.attendance_records%rowtype;
begin
  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
    and status = 'active';

  if not found then
    raise exception 'Only active users can clock in.';
  end if;

  select b.*
  into v_branch
  from public.employee_branches eb
  join public.branches b on b.id = eb.branch_id
  where eb.employee_id = auth.uid()
    and eb.is_primary = true
    and b.is_active = true
  order by eb.assigned_at desc
  limit 1;

  if not found then
    raise exception 'An active primary branch assignment is required before clocking in.';
  end if;

  v_timezone := coalesce(nullif(v_branch.timezone, ''), 'Asia/Manila');
  v_attendance_date := (v_now at time zone v_timezone)::date;

  if exists (
    select 1
    from public.attendance_records ar
    where ar.employee_id = auth.uid()
      and ar.attendance_date = v_attendance_date
  ) then
    raise exception 'You already clocked in for this attendance date.';
  end if;

  select *
  into v_schedule
  from public.work_schedules ws
  where ws.employee_id = auth.uid()
    and ws.branch_id = v_branch.id
    and ws.day_of_week = extract(dow from v_attendance_date)::smallint
    and ws.is_working_day = true
  limit 1;

  if found then
    v_scheduled_start := (v_attendance_date + v_schedule.scheduled_start) at time zone v_timezone;
    v_scheduled_end := (v_attendance_date + v_schedule.scheduled_end) at time zone v_timezone;

    if v_schedule.scheduled_end <= v_schedule.scheduled_start then
      v_scheduled_end := v_scheduled_end + interval '1 day';
    end if;

    v_late_minutes := greatest(
      floor(extract(epoch from (v_now - (v_scheduled_start + make_interval(mins => v_schedule.grace_period_minutes)))) / 60)::integer,
      0
    );
  end if;

  if v_late_minutes > 0 then
    v_status := 'late';
  end if;

  insert into public.attendance_records (
    employee_id,
    branch_id,
    attendance_date,
    clock_in_at,
    clock_in_photo_path,
    clock_in_latitude,
    clock_in_longitude,
    scheduled_start,
    scheduled_end,
    late_minutes,
    status
  )
  values (
    auth.uid(),
    v_branch.id,
    v_attendance_date,
    v_now,
    nullif(p_clock_in_photo_path, ''),
    p_clock_in_latitude,
    p_clock_in_longitude,
    v_scheduled_start,
    v_scheduled_end,
    v_late_minutes,
    v_status
  )
  returning * into v_record;

  return to_jsonb(v_record);
end;
$$;

create or replace function public.clock_out(
  p_clock_out_photo_path text default null,
  p_clock_out_latitude numeric default null,
  p_clock_out_longitude numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_now timestamptz := now();
  v_record public.attendance_records%rowtype;
begin
  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
    and status = 'active';

  if not found then
    raise exception 'Only active users can clock out.';
  end if;

  select *
  into v_record
  from public.attendance_records ar
  where ar.employee_id = auth.uid()
    and ar.clock_in_at is not null
    and ar.clock_out_at is null
  order by ar.clock_in_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No active attendance record was found. Clock in first before clocking out.';
  end if;

  update public.attendance_records
  set
    clock_out_at = v_now,
    clock_out_photo_path = nullif(p_clock_out_photo_path, ''),
    clock_out_latitude = p_clock_out_latitude,
    clock_out_longitude = p_clock_out_longitude,
    worked_minutes = greatest(floor(extract(epoch from (v_now - clock_in_at)) / 60)::integer, 0),
    status = 'completed'
  where id = v_record.id
  returning * into v_record;

  return to_jsonb(v_record);
end;
$$;

create or replace function public.attach_attendance_selfie(
  p_attendance_id uuid,
  p_event_type text,
  p_photo_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.attendance_records%rowtype;
  v_normalized_event text;
  v_expected_prefix text;
begin
  if p_photo_path is null or length(btrim(p_photo_path)) = 0 then
    raise exception 'Attendance selfie path is required.';
  end if;

  v_normalized_event := replace(p_event_type, '-', '_');

  if v_normalized_event not in ('clock_in', 'clock_out') then
    raise exception 'Attendance evidence must be for clock-in or clock-out.';
  end if;

  select *
  into v_record
  from public.attendance_records ar
  where ar.id = p_attendance_id
  for update;

  if not found then
    raise exception 'Attendance record was not found.';
  end if;

  if v_record.employee_id <> auth.uid() and not public.is_manager() then
    raise exception 'You do not have permission to attach evidence to this attendance record.';
  end if;

  v_expected_prefix := 'attendance/' || v_record.employee_id::text || '/';

  if p_photo_path not like v_expected_prefix || '%' then
    raise exception 'Attendance selfie path does not match the employee evidence folder.';
  end if;

  if v_normalized_event = 'clock_in' then
    if v_record.clock_in_at is null then
      raise exception 'Clock-in must be recorded before attaching clock-in evidence.';
    end if;

    if v_record.clock_in_photo_path is not null then
      raise exception 'Clock-in evidence is already attached.';
    end if;

    update public.attendance_records
    set clock_in_photo_path = p_photo_path
    where id = p_attendance_id
    returning * into v_record;
  else
    if v_record.clock_out_at is null then
      raise exception 'Clock-out must be recorded before attaching clock-out evidence.';
    end if;

    if v_record.clock_out_photo_path is not null then
      raise exception 'Clock-out evidence is already attached.';
    end if;

    update public.attendance_records
    set clock_out_photo_path = p_photo_path
    where id = p_attendance_id
    returning * into v_record;
  end if;

  update public.attendance_events
  set metadata = metadata || jsonb_build_object('photo_path', p_photo_path)
  where attendance_id = p_attendance_id
    and event_type = v_normalized_event;

  return to_jsonb(v_record);
end;
$$;

drop policy if exists "attendance_selfies_select_own_or_manager" on storage.objects;
drop policy if exists "attendance_selfies_insert_own_folder" on storage.objects;
drop policy if exists "attendance_selfies_no_update" on storage.objects;
drop policy if exists "attendance_selfies_no_delete" on storage.objects;

create policy "attendance_selfies_select_own_or_manager"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'attendance-selfies'
    and (
      public.is_manager()
      or name like ('attendance/' || auth.uid()::text || '/%')
    )
  );

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

grant execute on function public.clock_in(text, numeric, numeric) to authenticated;
grant execute on function public.clock_out(text, numeric, numeric) to authenticated;
grant execute on function public.attach_attendance_selfie(uuid, text, text) to authenticated;
