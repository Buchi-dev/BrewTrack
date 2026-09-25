alter table public.station_schedule_assignments
  add column if not exists scheduled_start time;

alter table public.station_schedule_assignments
  add column if not exists scheduled_end time;

update public.station_schedule_assignments
set
  scheduled_start = coalesce(scheduled_start, '07:00'::time),
  scheduled_end = coalesce(scheduled_end, '18:00'::time)
where scheduled_start is null
  or scheduled_end is null;

alter table public.station_schedule_assignments
  alter column scheduled_start set not null;

alter table public.station_schedule_assignments
  alter column scheduled_end set not null;

create or replace function public.get_today_station_assignment()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with today as (
    select (now() at time zone 'Asia/Manila')::date as schedule_date
  ),
  own_assignment as (
    select ssa.*, station.name as station_name, station.code as station_code
    from public.station_schedule_assignments ssa
    join public.branches station on station.id = ssa.branch_id
    join today on today.schedule_date = ssa.schedule_date
    where ssa.employee_id = auth.uid()
    limit 1
  ),
  station_team as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', teammate.id,
        'employeeId', teammate.employee_id,
        'stationRole', teammate.station_role,
        'scheduledStart', teammate.scheduled_start,
        'scheduledEnd', teammate.scheduled_end,
        'trainerEmployeeId', teammate.trainer_employee_id,
        'firstName', profile.first_name,
        'middleName', profile.middle_name,
        'lastName', profile.last_name,
        'employeeNumber', profile.employee_number
      )
      order by
        teammate.scheduled_start,
        case teammate.station_role
          when 'cook' then 1
          when 'barista' then 2
          when 'otd_cashier' then 3
          when 'trainee' then 4
          else 5
        end,
        profile.last_name,
        profile.first_name
    ), '[]'::jsonb) as rows
    from own_assignment own
    join public.station_schedule_assignments teammate
      on teammate.schedule_date = own.schedule_date
      and teammate.branch_id = own.branch_id
    join public.profiles profile on profile.id = teammate.employee_id
  )
  select coalesce(
    (
      select jsonb_build_object(
        'id', own.id,
        'scheduleDate', own.schedule_date,
        'stationId', own.branch_id,
        'stationName', own.station_name,
        'stationCode', own.station_code,
        'stationRole', own.station_role,
        'scheduledStart', own.scheduled_start,
        'scheduledEnd', own.scheduled_end,
        'trainerEmployeeId', own.trainer_employee_id,
        'notes', own.notes,
        'team', station_team.rows
      )
      from own_assignment own
      cross join station_team
    ),
    'null'::jsonb
  );
$$;

grant execute on function public.get_today_station_assignment() to authenticated;
