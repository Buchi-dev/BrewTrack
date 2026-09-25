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
  v_station_assignment public.station_schedule_assignments%rowtype;
  v_now timestamptz := now();
  v_timezone text := 'Asia/Manila';
  v_attendance_date date;
  v_scheduled_start timestamptz;
  v_scheduled_end timestamptz;
  v_grace_period_minutes integer := 0;
  v_late_minutes integer := 0;
  v_status text := 'present';
  v_record public.attendance_records%rowtype;
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

  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
    and status = 'active'
    and role = 'staff';

  if not found then
    raise exception 'Only active staff can clock in.';
  end if;

  v_attendance_date := (v_now at time zone v_timezone)::date;

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
  v_attendance_date := (v_now at time zone v_timezone)::date;

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
    floor(extract(epoch from (v_now - (v_scheduled_start + make_interval(mins => v_grace_period_minutes)))) / 60)::integer,
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
    status
  )
  values (
    auth.uid(),
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
  returning * into v_record;

  return to_jsonb(v_record);
exception
  when unique_violation then
    raise exception 'You already clocked in for this attendance date.';
end;
$$;
