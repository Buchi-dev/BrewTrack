create table if not exists public.station_schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_date date not null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  station_role text not null,
  scheduled_start time not null,
  scheduled_end time not null,
  trainer_employee_id uuid references public.profiles(id) on delete restrict,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint station_schedule_assignments_role_check check (
    station_role in ('cook', 'barista', 'otd_cashier', 'trainee')
  ),
  constraint station_schedule_assignments_trainer_check check (
    (station_role = 'trainee' and trainer_employee_id is not null)
    or (station_role <> 'trainee' and trainer_employee_id is null)
  ),
  constraint station_schedule_assignments_not_own_trainer_check check (
    trainer_employee_id is null or trainer_employee_id <> employee_id
  ),
  unique (schedule_date, employee_id)
);

create index if not exists station_schedule_assignments_date_idx
  on public.station_schedule_assignments(schedule_date);

create index if not exists station_schedule_assignments_station_idx
  on public.station_schedule_assignments(schedule_date, branch_id);

create index if not exists station_schedule_assignments_employee_idx
  on public.station_schedule_assignments(employee_id);

create trigger set_station_schedule_assignments_updated_at
  before update on public.station_schedule_assignments
  for each row execute function public.set_updated_at();

alter table public.station_schedule_assignments enable row level security;

create policy "station_schedule_assignments_select_team_or_manager"
  on public.station_schedule_assignments
  for select
  to authenticated
  using (public.is_manager() or employee_id = auth.uid());

create policy "station_schedule_assignments_write_manager"
  on public.station_schedule_assignments
  for all
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create or replace function public.validate_station_schedule_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.profiles%rowtype;
  v_station public.branches%rowtype;
  v_trainer public.station_schedule_assignments%rowtype;
begin
  select *
  into v_employee
  from public.profiles
  where id = new.employee_id;

  if v_employee.id is null or v_employee.role <> 'staff' or v_employee.status <> 'active' then
    raise exception 'Only active staff can be assigned to a station schedule.';
  end if;

  select *
  into v_station
  from public.branches
  where id = new.branch_id;

  if v_station.id is null or not v_station.is_active then
    raise exception 'Only active stations can be used for schedules.';
  end if;

  if new.station_role = 'trainee' then
    select *
    into v_trainer
    from public.station_schedule_assignments
    where schedule_date = new.schedule_date
      and branch_id = new.branch_id
      and employee_id = new.trainer_employee_id
      and station_role <> 'trainee'
      and id is distinct from new.id
    limit 1;

    if v_trainer.id is null then
      raise exception 'A trainee trainer must be a non-trainee staff member assigned to the same station and date.';
    end if;
  end if;

  if (
    select count(*)
    from public.station_schedule_assignments existing
    where existing.schedule_date = new.schedule_date
      and existing.branch_id = new.branch_id
      and existing.id is distinct from new.id
  ) >= 4 then
    raise exception 'A station can only have up to 4 staff members per schedule date.';
  end if;

  new.created_by = coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create trigger validate_station_schedule_assignment_before_write
  before insert or update on public.station_schedule_assignments
  for each row execute function public.validate_station_schedule_assignment();

create or replace function public.protect_station_schedule_trainer_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.station_schedule_assignments trainee
    where trainee.schedule_date = old.schedule_date
      and trainee.branch_id = old.branch_id
      and trainee.trainer_employee_id = old.employee_id
      and trainee.id is distinct from old.id
  ) then
    if tg_op = 'DELETE'
      or new.schedule_date is distinct from old.schedule_date
      or new.branch_id is distinct from old.branch_id
      or new.employee_id is distinct from old.employee_id
      or new.station_role = 'trainee'
    then
      raise exception 'This staff member is assigned as a trainer. Reassign the trainee before changing this assignment.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger protect_station_schedule_trainer_links_before_update_delete
  before update or delete on public.station_schedule_assignments
  for each row execute function public.protect_station_schedule_trainer_links();

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

grant select, insert, update, delete on public.station_schedule_assignments to authenticated;
grant execute on function public.get_today_station_assignment() to authenticated;
