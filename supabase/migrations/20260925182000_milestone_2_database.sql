create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  first_name text not null default '',
  middle_name text,
  last_name text not null default '',
  employee_number text unique,
  role text not null default 'staff',
  status text not null default 'active',
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('manager', 'staff')),
  constraint profiles_status_check check (status in ('active', 'suspended', 'inactive')),
  constraint profiles_employee_number_not_blank check (
    employee_number is null or length(btrim(employee_number)) > 0
  )
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  address text,
  latitude numeric,
  longitude numeric,
  geofence_radius integer not null default 0,
  timezone text not null default 'Asia/Manila',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branches_name_not_blank check (length(btrim(name)) > 0),
  constraint branches_code_not_blank check (length(btrim(code)) > 0),
  constraint branches_geofence_radius_check check (geofence_radius >= 0),
  constraint branches_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint branches_longitude_check check (longitude is null or longitude between -180 and 180)
);

create table public.employee_branches (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  is_primary boolean not null default false,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, branch_id)
);

create unique index employee_branches_one_primary_per_employee
  on public.employee_branches(employee_id)
  where is_primary;

create index employee_branches_employee_id_idx on public.employee_branches(employee_id);
create index employee_branches_branch_id_idx on public.employee_branches(branch_id);

create table public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  day_of_week smallint not null,
  scheduled_start time not null,
  scheduled_end time not null,
  grace_period_minutes integer not null default 0,
  is_working_day boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_schedules_day_of_week_check check (day_of_week between 0 and 6),
  constraint work_schedules_grace_period_check check (grace_period_minutes >= 0),
  unique (employee_id, branch_id, day_of_week)
);

create index work_schedules_employee_id_idx on public.work_schedules(employee_id);
create index work_schedules_branch_id_idx on public.work_schedules(branch_id);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  attendance_date date not null,
  clock_in_at timestamptz,
  clock_in_photo_path text,
  clock_out_at timestamptz,
  clock_out_photo_path text,
  clock_in_latitude numeric,
  clock_in_longitude numeric,
  clock_out_latitude numeric,
  clock_out_longitude numeric,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  late_minutes integer not null default 0,
  worked_minutes integer,
  status text not null default 'incomplete',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_status_check check (
    status in ('present', 'late', 'completed', 'incomplete', 'absent', 'excused')
  ),
  constraint attendance_records_late_minutes_check check (late_minutes >= 0),
  constraint attendance_records_worked_minutes_check check (
    worked_minutes is null or worked_minutes >= 0
  ),
  constraint attendance_records_clock_order_check check (
    clock_out_at is null or clock_in_at is null or clock_out_at >= clock_in_at
  ),
  constraint attendance_records_clock_in_latitude_check check (
    clock_in_latitude is null or clock_in_latitude between -90 and 90
  ),
  constraint attendance_records_clock_in_longitude_check check (
    clock_in_longitude is null or clock_in_longitude between -180 and 180
  ),
  constraint attendance_records_clock_out_latitude_check check (
    clock_out_latitude is null or clock_out_latitude between -90 and 90
  ),
  constraint attendance_records_clock_out_longitude_check check (
    clock_out_longitude is null or clock_out_longitude between -180 and 180
  )
);

create unique index attendance_records_one_session_per_employee_date
  on public.attendance_records(employee_id, attendance_date);

create index attendance_records_employee_id_idx on public.attendance_records(employee_id);
create index attendance_records_branch_id_idx on public.attendance_records(branch_id);
create index attendance_records_attendance_date_idx on public.attendance_records(attendance_date);
create index attendance_records_clock_in_at_idx on public.attendance_records(clock_in_at);
create index attendance_records_status_idx on public.attendance_records(status);

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance_records(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint attendance_events_event_type_check check (
    event_type in (
      'clock_in',
      'clock_out',
      'manager_adjustment',
      'status_change',
      'attendance_note_added'
    )
  )
);

create index attendance_events_attendance_id_idx on public.attendance_events(attendance_id);
create index attendance_events_employee_id_idx on public.attendance_events(employee_id);
create index attendance_events_created_at_idx on public.attendance_events(created_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (length(btrim(action)) > 0),
  constraint audit_logs_resource_type_not_blank check (length(btrim(resource_type)) > 0)
);

create index audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
create index audit_logs_resource_idx on public.audit_logs(resource_type, resource_id);
create index audit_logs_created_at_idx on public.audit_logs(created_at);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_key_not_blank check (length(btrim(key)) > 0)
);

insert into public.app_settings (key, value, description)
values
  ('organization_name', to_jsonb('BrewTrack'::text), 'Organization name displayed in the app.'),
  ('default_timezone', to_jsonb('Asia/Manila'::text), 'Default timezone for attendance display and schedule interpretation.'),
  ('default_grace_period', to_jsonb(0), 'Default late grace period in minutes.'),
  ('require_location', to_jsonb(false), 'Whether attendance capture requires browser location.'),
  ('enable_geofence', to_jsonb(false), 'Whether branch geofence checks are enabled.'),
  ('attendance_photo_quality', to_jsonb(0.82), 'Default JPEG quality used for attendance selfie compression.');

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_branches_updated_at
  before update on public.branches
  for each row execute function public.set_updated_at();

create trigger set_employee_branches_updated_at
  before update on public.employee_branches
  for each row execute function public.set_updated_at();

create trigger set_work_schedules_updated_at
  before update on public.work_schedules
  for each row execute function public.set_updated_at();

create trigger set_attendance_records_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

create trigger set_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    middle_name,
    last_name,
    employee_number,
    role,
    status,
    phone
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'middle_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'employee_number', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'staff'),
    coalesce(nullif(new.raw_user_meta_data ->> 'status', ''), 'active'),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select status from public.profiles where id = auth.uid();
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'manager'
      and status = 'active'
  );
$$;

create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_manager() then
    return new;
  end if;

  if old.id = auth.uid()
    and (
      new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.employee_number is distinct from old.employee_number
      or new.first_name is distinct from old.first_name
      or new.middle_name is distinct from old.middle_name
      or new.last_name is distinct from old.last_name
    )
  then
    raise exception 'Only managers can update profile identity, role, status, or employee number.';
  end if;

  return new;
end;
$$;

create trigger protect_profile_system_fields_before_update
  before update on public.profiles
  for each row execute function public.protect_profile_system_fields();

create or replace function public.get_today_attendance()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select to_jsonb(ar)
      from public.attendance_records ar
      where ar.employee_id = auth.uid()
        and ar.attendance_date = (now() at time zone 'Asia/Manila')::date
      limit 1
    ),
    'null'::jsonb
  );
$$;

create or replace function public.get_manager_dashboard_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_manager() then
      jsonb_build_object('error', 'forbidden')
    else
      (
        with today as (
          select (now() at time zone 'Asia/Manila')::date as attendance_date
        ),
        active_staff as (
          select id
          from public.profiles
          where role = 'staff'
            and status = 'active'
        ),
        todays_records as (
          select ar.*
          from public.attendance_records ar
          join today on today.attendance_date = ar.attendance_date
        )
        select jsonb_build_object(
          'totalEmployees', (select count(*) from active_staff),
          'presentToday', (select count(*) from todays_records where clock_in_at is not null),
          'lateToday', (select count(*) from todays_records where late_minutes > 0 or status = 'late'),
          'notYetClockedIn', greatest(
            (select count(*) from active_staff)
            - (select count(distinct employee_id) from todays_records where clock_in_at is not null),
            0
          ),
          'currentlyWorking', (
            select count(*)
            from todays_records
            where clock_in_at is not null and clock_out_at is null
          ),
          'completedShifts', (
            select count(*)
            from todays_records
            where clock_in_at is not null and clock_out_at is not null
          ),
          'missingClockOut', (
            select count(*)
            from todays_records
            where status = 'incomplete' and clock_in_at is not null and clock_out_at is null
          )
        )
      )
  end;
$$;

alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.employee_branches enable row level security;
alter table public.work_schedules enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

create policy "profiles_select_own_or_manager"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_manager());

create policy "profiles_update_own_basic_or_manager"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() or public.is_manager())
  with check (id = auth.uid() or public.is_manager());

create policy "profiles_insert_manager"
  on public.profiles
  for insert
  to authenticated
  with check (public.is_manager());

create policy "branches_select_assigned_or_manager"
  on public.branches
  for select
  to authenticated
  using (
    public.is_manager()
    or exists (
      select 1
      from public.employee_branches eb
      where eb.branch_id = branches.id
        and eb.employee_id = auth.uid()
    )
  );

create policy "branches_write_manager"
  on public.branches
  for all
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "employee_branches_select_own_or_manager"
  on public.employee_branches
  for select
  to authenticated
  using (employee_id = auth.uid() or public.is_manager());

create policy "employee_branches_write_manager"
  on public.employee_branches
  for all
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "work_schedules_select_own_or_manager"
  on public.work_schedules
  for select
  to authenticated
  using (employee_id = auth.uid() or public.is_manager());

create policy "work_schedules_write_manager"
  on public.work_schedules
  for all
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "attendance_records_select_own_or_manager"
  on public.attendance_records
  for select
  to authenticated
  using (employee_id = auth.uid() or public.is_manager());

create policy "attendance_records_write_manager"
  on public.attendance_records
  for all
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "attendance_events_select_own_or_manager"
  on public.attendance_events
  for select
  to authenticated
  using (employee_id = auth.uid() or public.is_manager());

create policy "attendance_events_write_manager"
  on public.attendance_events
  for all
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "audit_logs_select_manager"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_manager());

create policy "audit_logs_insert_manager"
  on public.audit_logs
  for insert
  to authenticated
  with check (public.is_manager());

create policy "app_settings_select_active_users"
  on public.app_settings
  for select
  to authenticated
  using (public.is_active_user());

create policy "app_settings_write_manager"
  on public.app_settings
  for all
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

grant usage on schema public to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.branches to authenticated;
grant select on public.employee_branches to authenticated;
grant select on public.work_schedules to authenticated;
grant select on public.attendance_records to authenticated;
grant select on public.attendance_events to authenticated;
grant select on public.app_settings to authenticated;

grant insert, update, delete on public.branches to authenticated;
grant insert, update, delete on public.employee_branches to authenticated;
grant insert, update, delete on public.work_schedules to authenticated;
grant insert, update, delete on public.attendance_records to authenticated;
grant insert, update, delete on public.attendance_events to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant insert, update, delete on public.app_settings to authenticated;

grant execute on function public.get_today_attendance() to authenticated;
grant execute on function public.get_manager_dashboard_summary() to authenticated;
