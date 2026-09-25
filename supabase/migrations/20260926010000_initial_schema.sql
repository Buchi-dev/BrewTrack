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

create index employee_branches_employee_id_idx
  on public.employee_branches(employee_id);

create index employee_branches_branch_id_idx
  on public.employee_branches(branch_id);

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

create index work_schedules_employee_id_idx
  on public.work_schedules(employee_id);

create index work_schedules_branch_id_idx
  on public.work_schedules(branch_id);

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

create index attendance_records_employee_id_idx
  on public.attendance_records(employee_id);

create index attendance_records_branch_id_idx
  on public.attendance_records(branch_id);

create index attendance_records_attendance_date_idx
  on public.attendance_records(attendance_date);

create index attendance_records_clock_in_at_idx
  on public.attendance_records(clock_in_at);

create index attendance_records_status_idx
  on public.attendance_records(status);

create index attendance_records_employee_date_clock_in_idx
  on public.attendance_records(employee_id, attendance_date desc, clock_in_at desc);

create index attendance_records_branch_date_clock_in_idx
  on public.attendance_records(branch_id, attendance_date desc, clock_in_at desc);

create index attendance_records_date_status_idx
  on public.attendance_records(attendance_date desc, status);

create index attendance_records_missing_clock_out_idx
  on public.attendance_records(attendance_date desc, branch_id)
  where clock_in_at is not null and clock_out_at is null;

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

create index attendance_events_attendance_id_idx
  on public.attendance_events(attendance_id);

create index attendance_events_employee_id_idx
  on public.attendance_events(employee_id);

create index attendance_events_created_at_idx
  on public.attendance_events(created_at);

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

create index audit_logs_actor_user_id_idx
  on public.audit_logs(actor_user_id);

create index audit_logs_resource_idx
  on public.audit_logs(resource_type, resource_id);

create index audit_logs_created_at_idx
  on public.audit_logs(created_at);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_key_not_blank check (length(btrim(key)) > 0)
);

create table public.station_schedule_assignments (
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

create index station_schedule_assignments_date_idx
  on public.station_schedule_assignments(schedule_date);

create index station_schedule_assignments_station_idx
  on public.station_schedule_assignments(schedule_date, branch_id);

create index station_schedule_assignments_employee_idx
  on public.station_schedule_assignments(employee_id);

create index station_schedule_assignments_date_station_start_idx
  on public.station_schedule_assignments(schedule_date, branch_id, scheduled_start);

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

create trigger set_station_schedule_assignments_updated_at
  before update on public.station_schedule_assignments
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
    'staff',
    'active',
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

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

create or replace function public.insert_audit_log(
  p_actor_user_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_old_values jsonb default null,
  p_new_values jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  if p_action is null or length(btrim(p_action)) = 0 then
    raise exception 'Audit action is required.';
  end if;

  if p_resource_type is null or length(btrim(p_resource_type)) = 0 then
    raise exception 'Audit resource type is required.';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    metadata
  )
  values (
    p_actor_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_values,
    p_new_values,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

create or replace function public.log_manager_action(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_old_values jsonb default null,
  p_new_values jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_manager() then
    raise exception 'Only active managers can create manager audit logs.';
  end if;

  return public.insert_audit_log(
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_values,
    p_new_values,
    p_metadata
  );
end;
$$;

create or replace function public.insert_attendance_event(
  p_attendance_id uuid,
  p_employee_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if p_event_type is null or length(btrim(p_event_type)) = 0 then
    raise exception 'Attendance event type is required.';
  end if;

  insert into public.attendance_events (
    attendance_id,
    employee_id,
    event_type,
    metadata
  )
  values (
    p_attendance_id,
    p_employee_id,
    p_event_type,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
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
          'status', new.status
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
        'status', new.status
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
        'status', new.status
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

create trigger audit_attendance_record_changes_after_insert_update
  after insert or update on public.attendance_records
  for each row execute function public.audit_attendance_record_changes();

create or replace function public.audit_manager_table_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resource_id uuid;
  v_action text;
  v_metadata jsonb;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'INSERT' then
    if tg_table_name = 'app_settings' then
      v_resource_id = null;
      v_metadata = jsonb_build_object('source', 'table_trigger', 'setting_key', new.key);
    else
      v_resource_id = new.id;
      v_metadata = jsonb_build_object('source', 'table_trigger');
    end if;

    v_action = tg_table_name || '_created';
    perform public.insert_audit_log(auth.uid(), v_action, tg_table_name, v_resource_id, null, to_jsonb(new), v_metadata);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if to_jsonb(old) = to_jsonb(new) then
      return new;
    end if;

    if tg_table_name = 'app_settings' then
      v_resource_id = null;
      v_metadata = jsonb_build_object('source', 'table_trigger', 'setting_key', new.key);
    else
      v_resource_id = new.id;
      v_metadata = jsonb_build_object('source', 'table_trigger');
    end if;

    v_action = tg_table_name || '_updated';
    perform public.insert_audit_log(auth.uid(), v_action, tg_table_name, v_resource_id, to_jsonb(old), to_jsonb(new), v_metadata);
    return new;
  end if;

  if tg_table_name = 'app_settings' then
    v_resource_id = null;
    v_metadata = jsonb_build_object('source', 'table_trigger', 'setting_key', old.key);
  else
    v_resource_id = old.id;
    v_metadata = jsonb_build_object('source', 'table_trigger');
  end if;

  v_action = tg_table_name || '_deleted';
  perform public.insert_audit_log(auth.uid(), v_action, tg_table_name, v_resource_id, to_jsonb(old), null, v_metadata);
  return old;
end;
$$;

create trigger audit_profiles_after_update
  after update on public.profiles
  for each row
  when (
    old.first_name is distinct from new.first_name
    or old.middle_name is distinct from new.middle_name
    or old.last_name is distinct from new.last_name
    or old.employee_number is distinct from new.employee_number
    or old.role is distinct from new.role
    or old.status is distinct from new.status
    or old.phone is distinct from new.phone
    or old.avatar_path is distinct from new.avatar_path
  )
  execute function public.audit_manager_table_changes();

create trigger audit_branches_after_insert_update_delete
  after insert or update or delete on public.branches
  for each row execute function public.audit_manager_table_changes();

create trigger audit_employee_branches_after_insert_update_delete
  after insert or update or delete on public.employee_branches
  for each row execute function public.audit_manager_table_changes();

create trigger audit_app_settings_after_update
  after update on public.app_settings
  for each row execute function public.audit_manager_table_changes();

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
  if auth.uid() is null then
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

  update public.attendance_records
  set
    clock_out_at = v_now,
    clock_out_photo_path = nullif(btrim(p_clock_out_photo_path), ''),
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
set search_path = public, storage
as $$
declare
  v_record public.attendance_records%rowtype;
  v_event_type text;
  v_expected_path text;
begin
  if not public.is_active_user() then
    raise exception 'Only active users can attach attendance evidence.';
  end if;

  if p_photo_path is null or length(btrim(p_photo_path)) = 0 then
    raise exception 'Attendance selfie path is required.';
  end if;

  v_event_type := replace(lower(btrim(coalesce(p_event_type, ''))), '-', '_');

  if v_event_type not in ('clock_in', 'clock_out') then
    raise exception 'Attendance evidence must be for clock-in or clock-out.';
  end if;

  select *
  into v_record
  from public.attendance_records ar
  where ar.id = p_attendance_id
    and ar.employee_id = auth.uid()
  for update;

  if not found then
    raise exception 'Attendance record was not found for the current user.';
  end if;

  v_expected_path := concat(
    'attendance/',
    v_record.employee_id::text,
    '/',
    to_char(v_record.attendance_date, 'YYYY/MM/DD'),
    '/',
    v_record.id::text,
    '/',
    replace(v_event_type, '_', '-'),
    '.jpg'
  );

  if p_photo_path is distinct from v_expected_path then
    raise exception 'Attendance selfie path does not match the official attendance record.';
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
    where id = v_record.id
    returning * into v_record;
  end if;

  update public.attendance_events
  set metadata = metadata || jsonb_build_object('photo_path', p_photo_path)
  where attendance_id = p_attendance_id
    and event_type = v_event_type;

  return to_jsonb(v_record);
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
  v_branch public.branches%rowtype;
  v_timezone text := 'Asia/Manila';
  v_attendance_date date;
  v_attendance public.attendance_records%rowtype;
begin
  if auth.uid() is null then
    return 'null'::jsonb;
  end if;

  select b.*
  into v_branch
  from public.employee_branches eb
  join public.branches b on b.id = eb.branch_id
  where eb.employee_id = auth.uid()
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
  where ar.employee_id = auth.uid()
    and ar.attendance_date = v_attendance_date
  limit 1;

  if not found then
    return 'null'::jsonb;
  end if;

  return to_jsonb(v_attendance);
end;
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
    if tg_op = 'DELETE' then
      raise exception 'This staff member is assigned as a trainer. Reassign the trainee before changing this assignment.';
    end if;

    if new.schedule_date is distinct from old.schedule_date
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

alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.employee_branches enable row level security;
alter table public.work_schedules enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;
alter table public.station_schedule_assignments enable row level security;

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

create policy "attendance_events_insert_manager"
  on public.attendance_events
  for insert
  to authenticated
  with check (public.is_manager());

create policy "audit_logs_select_manager"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_manager());

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

create policy "attendance_selfies_select_own_or_manager"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'attendance-selfies'
    and (
      public.is_manager()
      or (
        public.is_active_user()
        and name ~ '^attendance/[0-9a-fA-F-]{36}/[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9a-fA-F-]{36}/clock-(in|out)\.jpg$'
        and (storage.foldername(name))[1] = 'attendance'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

create policy "attendance_selfies_insert_own_attendance_path"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'attendance-selfies'
    and public.is_active_user()
    and name ~ '^attendance/[0-9a-fA-F-]{36}/[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9a-fA-F-]{36}/clock-(in|out)\.jpg$'
    and lower(storage.extension(name)) = 'jpg'
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
        and (
          (
            storage.filename(name) = 'clock-in.jpg'
            and ar.clock_in_at is not null
            and ar.clock_in_photo_path is null
          )
          or (
            storage.filename(name) = 'clock-out.jpg'
            and ar.clock_out_at is not null
            and ar.clock_out_photo_path is null
          )
        )
    )
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

grant usage on schema public to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.branches to authenticated;
grant select on public.employee_branches to authenticated;
grant select on public.work_schedules to authenticated;
grant select on public.attendance_records to authenticated;
grant select on public.attendance_events to authenticated;
grant select on public.app_settings to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.station_schedule_assignments to authenticated;

grant insert, update, delete on public.branches to authenticated;
grant insert, update, delete on public.employee_branches to authenticated;
grant insert, update, delete on public.work_schedules to authenticated;
grant insert, update, delete on public.attendance_records to authenticated;
grant insert on public.attendance_events to authenticated;
grant insert, update, delete on public.app_settings to authenticated;
grant insert, update, delete on public.station_schedule_assignments to authenticated;
grant select, insert on storage.objects to authenticated;

revoke execute on function public.insert_audit_log(uuid, text, text, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.insert_attendance_event(uuid, uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.log_manager_action(text, text, uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.clock_in(text, numeric, numeric) to authenticated;
grant execute on function public.clock_out(text, numeric, numeric) to authenticated;
grant execute on function public.attach_attendance_selfie(uuid, text, text) to authenticated;
grant execute on function public.get_today_attendance() to authenticated;
grant execute on function public.get_manager_dashboard_summary() to authenticated;
grant execute on function public.get_today_station_assignment() to authenticated;
