create or replace function public.get_staff_station_schedule(
  p_start_date date,
  p_end_date date
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with own_assignments as (
    select ssa.*, station.name as station_name, station.code as station_code
    from public.station_schedule_assignments ssa
    join public.branches station on station.id = ssa.branch_id
    where ssa.employee_id = auth.uid()
      and ssa.schedule_date between p_start_date and p_end_date
  ),
  own_with_team as (
    select
      own.id,
      own.schedule_date,
      own.branch_id,
      own.station_name,
      own.station_code,
      own.station_role,
      own.scheduled_start,
      own.scheduled_end,
      own.trainer_employee_id,
      own.notes,
      coalesce(jsonb_agg(
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
      ), '[]'::jsonb) as team
    from own_assignments own
    join public.station_schedule_assignments teammate
      on teammate.schedule_date = own.schedule_date
      and teammate.branch_id = own.branch_id
    join public.profiles profile on profile.id = teammate.employee_id
    group by
      own.id,
      own.schedule_date,
      own.branch_id,
      own.station_name,
      own.station_code,
      own.station_role,
      own.scheduled_start,
      own.scheduled_end,
      own.trainer_employee_id,
      own.notes
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'scheduleDate', schedule_date,
      'stationId', branch_id,
      'stationName', station_name,
      'stationCode', station_code,
      'stationRole', station_role,
      'scheduledStart', scheduled_start,
      'scheduledEnd', scheduled_end,
      'trainerEmployeeId', trainer_employee_id,
      'notes', notes,
      'team', team
    )
    order by schedule_date, scheduled_start
  ), '[]'::jsonb)
  from own_with_team;
$$;

grant execute on function public.get_staff_station_schedule(date, date) to authenticated;
