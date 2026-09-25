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
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_branch record;
  v_schedule public.work_schedules%rowtype;
  v_now timestamptz := now();
  v_timezone text := 'Asia/Manila';
  v_attendance_date date;
  v_scheduled_start timestamptz;
  v_scheduled_end timestamptz;
  v_late_minutes integer := 0;
  v_status text := 'present';
  v_attendance public.attendance_records%rowtype;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to clock in.';
  end if;

  if p_clock_in_latitude is not null and p_clock_in_latitude not between -90 and 90 then
    raise exception 'Clock-in latitude is outside the valid range.';
  end if;

  if p_clock_in_longitude is not null and p_clock_in_longitude not between -180 and 180 then
    raise exception 'Clock-in longitude is outside the valid range.';
  end if;

  select *
    into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Your employee profile was not found.';
  end if;

  if v_profile.status <> 'active' then
    raise exception 'Your account is not active.';
  end if;

  if v_profile.role <> 'staff' then
    raise exception 'Only staff accounts can clock in.';
  end if;

  select b.*
    into v_branch
  from public.employee_branches eb
  join public.branches b on b.id = eb.branch_id
  where eb.employee_id = v_user_id
    and eb.is_primary = true
  order by eb.assigned_at desc
  limit 1;

  if not found then
    raise exception 'You do not have a primary branch assignment.';
  end if;

  if v_branch.is_active is not true then
    raise exception 'Your assigned branch is inactive.';
  end if;

  v_timezone := coalesce(nullif(v_branch.timezone, ''), 'Asia/Manila');
  v_attendance_date := (v_now at time zone v_timezone)::date;

  if exists (
    select 1
    from public.attendance_records ar
    where ar.employee_id = v_user_id
      and ar.attendance_date = v_attendance_date
  ) then
    raise exception 'You already have an attendance record for today.';
  end if;

  select *
    into v_schedule
  from public.work_schedules ws
  where ws.employee_id = v_user_id
    and ws.branch_id = v_branch.id
    and ws.day_of_week = extract(dow from v_attendance_date::timestamp)::smallint
  limit 1;

  if found and v_schedule.is_working_day then
    v_scheduled_start := (v_attendance_date + v_schedule.scheduled_start) at time zone v_timezone;

    v_scheduled_end := (
      v_attendance_date
      + v_schedule.scheduled_end
      + case
          when v_schedule.scheduled_end <= v_schedule.scheduled_start then interval '1 day'
          else interval '0 day'
        end
    ) at time zone v_timezone;

    if v_now > v_scheduled_start + make_interval(mins => v_schedule.grace_period_minutes) then
      v_late_minutes := floor(
        extract(epoch from (v_now - (v_scheduled_start + make_interval(mins => v_schedule.grace_period_minutes)))) / 60
      )::integer;
      v_status := 'late';
    end if;
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
    v_user_id,
    v_branch.id,
    v_attendance_date,
    v_now,
    nullif(btrim(p_clock_in_photo_path), ''),
    p_clock_in_latitude,
    p_clock_in_longitude,
    v_scheduled_start,
    v_scheduled_end,
    v_late_minutes,
    v_status
  )
  returning * into v_attendance;

  insert into public.attendance_events (
    attendance_id,
    employee_id,
    event_type,
    metadata
  )
  values (
    v_attendance.id,
    v_user_id,
    'clock_in',
    jsonb_strip_nulls(
      jsonb_build_object(
        'branch_id', v_branch.id,
        'attendance_date', v_attendance_date,
        'timezone', v_timezone,
        'schedule_id', case when v_schedule.id is null then null else v_schedule.id end,
        'scheduled_start', v_scheduled_start,
        'scheduled_end', v_scheduled_end,
        'late_minutes', v_late_minutes,
        'has_photo_path', v_attendance.clock_in_photo_path is not null,
        'has_location', p_clock_in_latitude is not null and p_clock_in_longitude is not null
      )
    )
  );

  return jsonb_build_object(
    'attendance', to_jsonb(v_attendance),
    'branch', jsonb_build_object(
      'id', v_branch.id,
      'name', v_branch.name,
      'code', v_branch.code,
      'timezone', v_timezone
    )
  );
exception
  when unique_violation then
    raise exception 'You already have an attendance record for today.';
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
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_now timestamptz := now();
  v_attendance public.attendance_records%rowtype;
  v_updated_attendance public.attendance_records%rowtype;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to clock out.';
  end if;

  if p_clock_out_latitude is not null and p_clock_out_latitude not between -90 and 90 then
    raise exception 'Clock-out latitude is outside the valid range.';
  end if;

  if p_clock_out_longitude is not null and p_clock_out_longitude not between -180 and 180 then
    raise exception 'Clock-out longitude is outside the valid range.';
  end if;

  select *
    into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Your employee profile was not found.';
  end if;

  if v_profile.status <> 'active' then
    raise exception 'Your account is not active.';
  end if;

  if v_profile.role <> 'staff' then
    raise exception 'Only staff accounts can clock out.';
  end if;

  select *
    into v_attendance
  from public.attendance_records ar
  where ar.employee_id = v_user_id
    and ar.clock_in_at is not null
    and ar.clock_out_at is null
  order by ar.clock_in_at desc
  limit 1
  for update;

  if not found then
    raise exception 'You do not have an active attendance session to clock out from.';
  end if;

  update public.attendance_records
  set
    clock_out_at = v_now,
    clock_out_photo_path = nullif(btrim(p_clock_out_photo_path), ''),
    clock_out_latitude = p_clock_out_latitude,
    clock_out_longitude = p_clock_out_longitude,
    worked_minutes = greatest(floor(extract(epoch from (v_now - v_attendance.clock_in_at)) / 60)::integer, 0),
    status = 'completed'
  where id = v_attendance.id
  returning * into v_updated_attendance;

  insert into public.attendance_events (
    attendance_id,
    employee_id,
    event_type,
    metadata
  )
  values (
    v_updated_attendance.id,
    v_user_id,
    'clock_out',
    jsonb_build_object(
      'worked_minutes', v_updated_attendance.worked_minutes,
      'has_photo_path', v_updated_attendance.clock_out_photo_path is not null,
      'has_location', p_clock_out_latitude is not null and p_clock_out_longitude is not null
    )
  );

  return jsonb_build_object(
    'attendance', to_jsonb(v_updated_attendance)
  );
end;
$$;

create or replace function public.get_today_attendance()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch record;
  v_timezone text := 'Asia/Manila';
  v_attendance_date date;
  v_attendance public.attendance_records%rowtype;
begin
  if v_user_id is null then
    return 'null'::jsonb;
  end if;

  select b.*
    into v_branch
  from public.employee_branches eb
  join public.branches b on b.id = eb.branch_id
  where eb.employee_id = v_user_id
    and eb.is_primary = true
  order by eb.assigned_at desc
  limit 1;

  if found then
    v_timezone := coalesce(nullif(v_branch.timezone, ''), 'Asia/Manila');
  end if;

  v_attendance_date := (now() at time zone v_timezone)::date;

  select *
    into v_attendance
  from public.attendance_records ar
  where ar.employee_id = v_user_id
    and ar.attendance_date = v_attendance_date
  limit 1;

  if not found then
    return 'null'::jsonb;
  end if;

  return to_jsonb(v_attendance);
end;
$$;

grant execute on function public.clock_in(text, numeric, numeric) to authenticated;
grant execute on function public.clock_out(text, numeric, numeric) to authenticated;
grant execute on function public.get_today_attendance() to authenticated;
