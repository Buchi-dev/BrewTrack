alter table public.attendance_records
  add column if not exists clock_in_captured_at timestamptz,
  add column if not exists clock_in_synced_at timestamptz,
  add column if not exists clock_in_client_event_id uuid,
  add column if not exists clock_in_was_offline boolean not null default false,
  add column if not exists clock_in_sync_delay_seconds integer,
  add column if not exists clock_in_requires_review boolean not null default false,
  add column if not exists clock_in_review_reason text,
  add column if not exists clock_out_captured_at timestamptz,
  add column if not exists clock_out_synced_at timestamptz,
  add column if not exists clock_out_client_event_id uuid,
  add column if not exists clock_out_was_offline boolean not null default false,
  add column if not exists clock_out_sync_delay_seconds integer,
  add column if not exists clock_out_requires_review boolean not null default false,
  add column if not exists clock_out_review_reason text;

create unique index if not exists attendance_records_clock_in_client_event_id_idx
  on public.attendance_records(employee_id, clock_in_client_event_id)
  where clock_in_client_event_id is not null;

create unique index if not exists attendance_records_clock_out_client_event_id_idx
  on public.attendance_records(employee_id, clock_out_client_event_id)
  where clock_out_client_event_id is not null;

create index if not exists attendance_records_offline_review_idx
  on public.attendance_records(attendance_date desc, branch_id)
  where clock_in_requires_review = true or clock_out_requires_review = true;

drop function if exists public.clock_in(text, numeric, numeric);
drop function if exists public.clock_out(text, numeric, numeric);

create or replace function public.clock_in(
  p_clock_in_photo_path text default null,
  p_clock_in_latitude numeric default null,
  p_clock_in_longitude numeric default null,
  p_client_event_id uuid default null,
  p_captured_at timestamptz default null,
  p_was_offline boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_branch public.branches%rowtype;
  v_station_assignment public.station_schedule_assignments%rowtype;
  v_now timestamptz := now();
  v_clock_in_at timestamptz := coalesce(p_captured_at, now());
  v_timezone text := 'Asia/Manila';
  v_attendance_date date;
  v_scheduled_start timestamptz;
  v_scheduled_end timestamptz;
  v_grace_period_minutes integer := 0;
  v_late_minutes integer := 0;
  v_status text := 'present';
  v_record public.attendance_records%rowtype;
  v_sync_delay_seconds integer := 0;
  v_was_offline boolean := coalesce(p_was_offline, false);
  v_requires_review boolean := false;
  v_review_reason text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to clock in.';
  end if;

  if p_clock_in_latitude is not null and p_clock_in_latitude not between -90 and 90 then
    raise exception 'Clock-in latitude is outside the valid range.';
  end if;

  if p_clock_in_longitude is not null and p_clock_in_longitude not between -180 and 180 then
    raise exception 'Clock-in longitude is outside the valid range.';
  end if;

  if p_captured_at is not null then
    if p_captured_at > v_now + interval '5 minutes' then
      raise exception 'Captured clock-in time is ahead of server time. Check the device clock and try again.';
    end if;

    if p_captured_at < v_now - interval '18 hours' then
      raise exception 'Offline clock-in is too old to synchronize automatically. Please ask a manager to review it.';
    end if;

    v_sync_delay_seconds := greatest(floor(extract(epoch from (v_now - p_captured_at)))::integer, 0);
    v_was_offline := v_was_offline or v_sync_delay_seconds > 60;

    if v_sync_delay_seconds > 7200 then
      v_requires_review := true;
      v_review_reason := concat('Offline clock-in synced after ', v_sync_delay_seconds, ' seconds.');
    end if;
  end if;

  if p_client_event_id is not null then
    select *
    into v_record
    from public.attendance_records ar
    where ar.employee_id = auth.uid()
      and ar.clock_in_client_event_id = p_client_event_id
    limit 1;

    if found then
      return to_jsonb(v_record);
    end if;
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
    and status = 'active'
    and role = 'staff';

  if not found then
    raise exception 'Only active staff can clock in.';
  end if;

  v_attendance_date := (v_clock_in_at at time zone v_timezone)::date;

  select ssa.*
  into v_station_assignment
  from public.station_schedule_assignments ssa
  join public.branches b on b.id = ssa.branch_id
  where ssa.employee_id = auth.uid()
    and ssa.schedule_date = v_attendance_date
    and b.is_active = true
  limit 1;

  if not found then
    raise exception 'A station schedule assignment is required before clocking in.';
  end if;

  select *
  into v_branch
  from public.branches
  where id = v_station_assignment.branch_id
    and is_active = true;

  v_timezone := coalesce(nullif(v_branch.timezone, ''), 'Asia/Manila');
  v_attendance_date := (v_clock_in_at at time zone v_timezone)::date;

  if v_station_assignment.schedule_date <> v_attendance_date then
    select ssa.*
    into v_station_assignment
    from public.station_schedule_assignments ssa
    join public.branches b on b.id = ssa.branch_id
    where ssa.employee_id = auth.uid()
      and ssa.schedule_date = v_attendance_date
      and b.is_active = true
    limit 1;

    if not found then
      raise exception 'A station schedule assignment is required before clocking in.';
    end if;

    select *
    into v_branch
    from public.branches
    where id = v_station_assignment.branch_id
      and is_active = true;
  end if;

  if exists (
    select 1
    from public.attendance_records ar
    where ar.employee_id = auth.uid()
      and ar.attendance_date = v_attendance_date
  ) then
    raise exception 'You already clocked in for this attendance date.';
  end if;

  select coalesce(
    case jsonb_typeof(value)
      when 'number' then (value #>> '{}')::integer
      else null
    end,
    0
  )
  into v_grace_period_minutes
  from public.app_settings
  where key = 'default_grace_period';

  v_grace_period_minutes := coalesce(v_grace_period_minutes, 0);
  v_scheduled_start := (v_attendance_date + v_station_assignment.scheduled_start) at time zone v_timezone;
  v_scheduled_end := (v_attendance_date + v_station_assignment.scheduled_end) at time zone v_timezone;

  if v_station_assignment.scheduled_end <= v_station_assignment.scheduled_start then
    v_scheduled_end := v_scheduled_end + interval '1 day';
  end if;

  v_late_minutes := greatest(
    floor(extract(epoch from (v_clock_in_at - (v_scheduled_start + make_interval(mins => v_grace_period_minutes)))) / 60)::integer,
    0
  );

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
    status,
    clock_in_captured_at,
    clock_in_synced_at,
    clock_in_client_event_id,
    clock_in_was_offline,
    clock_in_sync_delay_seconds,
    clock_in_requires_review,
    clock_in_review_reason
  )
  values (
    auth.uid(),
    v_branch.id,
    v_attendance_date,
    v_clock_in_at,
    nullif(btrim(p_clock_in_photo_path), ''),
    p_clock_in_latitude,
    p_clock_in_longitude,
    v_scheduled_start,
    v_scheduled_end,
    v_late_minutes,
    v_status,
    p_captured_at,
    v_now,
    p_client_event_id,
    v_was_offline,
    v_sync_delay_seconds,
    v_requires_review,
    v_review_reason
  )
  returning * into v_record;

  return to_jsonb(v_record);
exception
  when unique_violation then
    if p_client_event_id is not null then
      select *
      into v_record
      from public.attendance_records ar
      where ar.employee_id = auth.uid()
        and ar.clock_in_client_event_id = p_client_event_id
      limit 1;

      if found then
        return to_jsonb(v_record);
      end if;
    end if;

    raise exception 'You already clocked in for this attendance date.';
end;
$$;

create or replace function public.clock_out(
  p_clock_out_photo_path text default null,
  p_clock_out_latitude numeric default null,
  p_clock_out_longitude numeric default null,
  p_client_event_id uuid default null,
  p_captured_at timestamptz default null,
  p_was_offline boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_now timestamptz := now();
  v_clock_out_at timestamptz := coalesce(p_captured_at, now());
  v_record public.attendance_records%rowtype;
  v_sync_delay_seconds integer := 0;
  v_was_offline boolean := coalesce(p_was_offline, false);
  v_requires_review boolean := false;
  v_review_reason text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to clock out.';
  end if;

  if p_clock_out_latitude is not null and p_clock_out_latitude not between -90 and 90 then
    raise exception 'Clock-out latitude is outside the valid range.';
  end if;

  if p_clock_out_longitude is not null and p_clock_out_longitude not between -180 and 180 then
    raise exception 'Clock-out longitude is outside the valid range.';
  end if;

  if p_captured_at is not null then
    if p_captured_at > v_now + interval '5 minutes' then
      raise exception 'Captured clock-out time is ahead of server time. Check the device clock and try again.';
    end if;

    if p_captured_at < v_now - interval '18 hours' then
      raise exception 'Offline clock-out is too old to synchronize automatically. Please ask a manager to review it.';
    end if;

    v_sync_delay_seconds := greatest(floor(extract(epoch from (v_now - p_captured_at)))::integer, 0);
    v_was_offline := v_was_offline or v_sync_delay_seconds > 60;

    if v_sync_delay_seconds > 7200 then
      v_requires_review := true;
      v_review_reason := concat('Offline clock-out synced after ', v_sync_delay_seconds, ' seconds.');
    end if;
  end if;

  if p_client_event_id is not null then
    select *
    into v_record
    from public.attendance_records ar
    where ar.employee_id = auth.uid()
      and ar.clock_out_client_event_id = p_client_event_id
    limit 1;

    if found then
      return to_jsonb(v_record);
    end if;
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
    and status = 'active'
    and role = 'staff';

  if not found then
    raise exception 'Only active staff can clock out.';
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

  if v_clock_out_at < v_record.clock_in_at then
    raise exception 'Clock-out cannot be earlier than clock-in. Check the device clock and try again.';
  end if;

  update public.attendance_records
  set
    clock_out_at = v_clock_out_at,
    clock_out_photo_path = nullif(btrim(p_clock_out_photo_path), ''),
    clock_out_latitude = p_clock_out_latitude,
    clock_out_longitude = p_clock_out_longitude,
    worked_minutes = greatest(floor(extract(epoch from (v_clock_out_at - clock_in_at)) / 60)::integer, 0),
    status = 'completed',
    clock_out_captured_at = p_captured_at,
    clock_out_synced_at = v_now,
    clock_out_client_event_id = p_client_event_id,
    clock_out_was_offline = v_was_offline,
    clock_out_sync_delay_seconds = v_sync_delay_seconds,
    clock_out_requires_review = v_requires_review,
    clock_out_review_reason = v_review_reason
  where id = v_record.id
  returning * into v_record;

  return to_jsonb(v_record);
end;
$$;

create or replace function public.audit_attendance_record_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.clock_in_at is not null and not exists (
      select 1
      from public.attendance_events
      where attendance_id = new.id
        and event_type = 'clock_in'
    ) then
      perform public.insert_attendance_event(
        new.id,
        new.employee_id,
        'clock_in',
        jsonb_build_object(
          'branch_id', new.branch_id,
          'attendance_date', new.attendance_date,
          'photo_path', new.clock_in_photo_path,
          'latitude', new.clock_in_latitude,
          'longitude', new.clock_in_longitude,
          'late_minutes', new.late_minutes,
          'status', new.status,
          'captured_at', new.clock_in_captured_at,
          'synced_at', new.clock_in_synced_at,
          'client_event_id', new.clock_in_client_event_id,
          'was_offline', new.clock_in_was_offline,
          'sync_delay_seconds', new.clock_in_sync_delay_seconds,
          'requires_review', new.clock_in_requires_review,
          'review_reason', new.clock_in_review_reason
        )
      );
    end if;

    return new;
  end if;

  if old.clock_in_at is null and new.clock_in_at is not null and not exists (
    select 1
    from public.attendance_events
    where attendance_id = new.id
      and event_type = 'clock_in'
  ) then
    perform public.insert_attendance_event(
      new.id,
      new.employee_id,
      'clock_in',
      jsonb_build_object(
        'branch_id', new.branch_id,
        'attendance_date', new.attendance_date,
        'photo_path', new.clock_in_photo_path,
        'latitude', new.clock_in_latitude,
        'longitude', new.clock_in_longitude,
        'late_minutes', new.late_minutes,
        'status', new.status,
        'captured_at', new.clock_in_captured_at,
        'synced_at', new.clock_in_synced_at,
        'client_event_id', new.clock_in_client_event_id,
        'was_offline', new.clock_in_was_offline,
        'sync_delay_seconds', new.clock_in_sync_delay_seconds,
        'requires_review', new.clock_in_requires_review,
        'review_reason', new.clock_in_review_reason
      )
    );
  end if;

  if old.clock_out_at is null and new.clock_out_at is not null and not exists (
    select 1
    from public.attendance_events
    where attendance_id = new.id
      and event_type = 'clock_out'
  ) then
    perform public.insert_attendance_event(
      new.id,
      new.employee_id,
      'clock_out',
      jsonb_build_object(
        'branch_id', new.branch_id,
        'attendance_date', new.attendance_date,
        'photo_path', new.clock_out_photo_path,
        'latitude', new.clock_out_latitude,
        'longitude', new.clock_out_longitude,
        'worked_minutes', new.worked_minutes,
        'status', new.status,
        'captured_at', new.clock_out_captured_at,
        'synced_at', new.clock_out_synced_at,
        'client_event_id', new.clock_out_client_event_id,
        'was_offline', new.clock_out_was_offline,
        'sync_delay_seconds', new.clock_out_sync_delay_seconds,
        'requires_review', new.clock_out_requires_review,
        'review_reason', new.clock_out_review_reason
      )
    );
  end if;

  if old.status is distinct from new.status then
    perform public.insert_attendance_event(
      new.id,
      new.employee_id,
      'status_change',
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'actor_user_id', auth.uid()
      )
    );
  end if;

  if old.notes is distinct from new.notes and new.notes is not null then
    perform public.insert_attendance_event(
      new.id,
      new.employee_id,
      'attendance_note_added',
      jsonb_build_object(
        'old_notes', old.notes,
        'new_notes', new.notes,
        'actor_user_id', auth.uid()
      )
    );
  end if;

  return new;
end;
$$;

grant execute on function public.clock_in(text, numeric, numeric, uuid, timestamptz, boolean) to authenticated;
grant execute on function public.clock_out(text, numeric, numeric, uuid, timestamptz, boolean) to authenticated;
