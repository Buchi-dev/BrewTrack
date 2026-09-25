-- Preserve existing location IDs, employee records, evidence, and manager access.
begin;
alter table public.branches rename to stations;
alter table public.manager_branches rename to manager_stations;
alter table public.manager_stations rename column branch_id to station_id;
alter table public.employees rename column branch_id to station_id;
alter table public.capture_challenges rename column branch_id to station_id;
alter table public.capture_challenges rename column branch_name to station_name;
alter table public.attendance_records rename column branch_id to station_id;
alter table public.attendance_records rename column branch_name to station_name;
alter table public.audit_logs rename column branch_id to station_id;
alter function private.assigned_branch(uuid) rename to assigned_station;

create table public.daily_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  station_id uuid not null references public.stations(id),
  work_date date not null,
  work_role text not null check (work_role in ('Cook','Barista','Cashier (OTD)','Trainee')),
  employee_name text not null,
  station_name text not null,
  shift_start time not null,
  shift_end time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id,work_date)
);
create index daily_assignments_station_date_idx on public.daily_assignments(station_id,work_date);
create index daily_assignments_date_idx on public.daily_assignments(work_date);
alter table public.daily_assignments enable row level security;
revoke all on public.daily_assignments from anon, authenticated;
grant select, delete on public.daily_assignments to authenticated;
grant insert(employee_id,station_id,work_date,work_role) on public.daily_assignments to authenticated;
grant update(employee_id,station_id,work_date,work_role) on public.daily_assignments to authenticated;

create or replace function private.can_manage(branch uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (private.is_admin() or exists(
    select 1 from public.manager_stations m join public.profiles p on p.id=m.manager_id
    where m.manager_id=auth.uid() and m.station_id=branch and p.role='manager'));
$$;
create or replace function private.assigned_station(branch uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (exists(select 1 from public.employees where id=auth.uid() and station_id=branch)
    or exists(select 1 from public.daily_assignments where employee_id=auth.uid() and station_id=branch)
    or exists(select 1 from public.attendance_records where employee_id=auth.uid() and station_id=branch));
$$;

create policy assignments_read on public.daily_assignments for select to authenticated
  using (employee_id=(select auth.uid()) or private.can_manage(station_id));
create policy assignments_insert on public.daily_assignments for insert to authenticated
  with check (private.can_manage(station_id));
create policy assignments_update on public.daily_assignments for update to authenticated
  using (private.can_manage(station_id)) with check (private.can_manage(station_id));
create policy assignments_delete on public.daily_assignments for delete to authenticated
  using (private.can_manage(station_id));

-- Also expose employees scheduled at a manager's stations, without granting
-- permission to move staff from a home station outside that manager's scope.
create policy employees_scheduled_read on public.employees for select to authenticated using (
  exists(select 1 from public.daily_assignments a where a.employee_id=employees.id and private.can_manage(a.station_id))
);

create function private.role_shift_start(role text, station_start time) returns time language sql immutable set search_path = '' as $$
  select case when role='Cook' then station_start - interval '1 hour' else station_start end
$$;
revoke all on function private.role_shift_start(text,time) from public, anon, authenticated;

create function private.validate_assignment() returns trigger language plpgsql security definer set search_path = '' as $$
declare e public.employees; s public.stations; target public.daily_assignments;
begin
  if auth.uid() is null then raise exception 'Sign in to arrange schedules'; end if;
  target := case when tg_op='DELETE' then old else new end;
  if tg_op='UPDATE' and (new.employee_id<>old.employee_id or new.work_date<>old.work_date) then
    raise exception 'Employee and date cannot change. Create a separate daily assignment.';
  end if;
  -- Serialize scheduling and attendance for this employee to prevent races.
  select * into e from public.employees where id=target.employee_id for update;
  if not found then raise exception 'Employee not found'; end if;
  if not private.can_manage(target.station_id) or not private.can_manage(e.station_id)
    or (tg_op='UPDATE' and not private.can_manage(old.station_id)) then
    raise exception 'You can only arrange staff and stations within your management access';
  end if;
  if target.work_date < (clock_timestamp() at time zone 'Asia/Manila')::date
    or exists(select 1 from public.attendance_records where employee_id=e.id and attendance_date=target.work_date) then
    raise exception 'Past schedules and assignments with attendance are locked';
  end if;
  if tg_op='DELETE' then return old; end if;
  if not e.active then raise exception 'Employee is inactive'; end if;
  select * into s from public.stations where id=target.station_id and active;
  if not found then raise exception 'Station is inactive'; end if;
  new.employee_name:=e.name; new.station_name:=s.name;
  new.shift_start:=private.role_shift_start(new.work_role,s.shift_start); new.shift_end:=s.shift_end;
  new.updated_at:=clock_timestamp();
  return new;
end;
$$;
revoke all on function private.validate_assignment() from public, anon, authenticated;
create trigger assignments_validate before insert or update or delete on public.daily_assignments for each row execute function private.validate_assignment();

alter table public.capture_challenges add column work_role text;
alter table public.capture_challenges add column shift_start time;
alter table public.attendance_records add column work_role text;
-- Existing evidence keeps an unknown role rather than inventing historical work.
alter table public.attendance_records add constraint attendance_work_role_check check (work_role in ('Cook','Barista','Cashier (OTD)','Trainee'));

create or replace function private.begin_attendance(transaction text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.employees; s public.stations; a public.daily_assignments; c public.capture_challenges;
  previous public.attendance_records; d date; t timestamptz := clock_timestamp();
begin
  if auth.uid() is null then raise exception 'Sign in to record attendance'; end if;
  if transaction not in ('clock-in','clock-out') or transaction is null then raise exception 'Invalid transaction'; end if;
  select * into e from public.employees where id=auth.uid() and active for update;
  if not found then raise exception 'Your employee account is inactive or not assigned'; end if;
  d := (t at time zone 'Asia/Manila')::date;
  if exists(select 1 from public.attendance_records where employee_id=e.id and attendance_date=d and transaction_type=transaction) then raise exception 'This transaction is already recorded for today'; end if;
  if transaction='clock-out' then
    select * into previous from public.attendance_records where employee_id=e.id and attendance_date=d and transaction_type='clock-in';
    if not found then raise exception 'Clock in before clocking out'; end if;
    -- Clock-out remains possible for a shift begun before this migration.
    select * into s from public.stations where id=previous.station_id;
    insert into public.capture_challenges(employee_id,station_id,employee_name,station_name,work_role,shift_start,transaction_type,issued_at,expires_at)
      values(e.id,s.id,previous.employee_name,previous.station_name,previous.work_role,s.shift_start,transaction,t,t+interval '2 minutes') returning * into c;
  else
    select * into a from public.daily_assignments where employee_id=e.id and work_date=d;
    if not found then raise exception 'No station and role assigned today. Contact your manager.'; end if;
    select * into s from public.stations where id=a.station_id and active;
    if not found then raise exception 'Your station is inactive'; end if;
    insert into public.capture_challenges(employee_id,station_id,employee_name,station_name,work_role,shift_start,transaction_type,issued_at,expires_at)
      values(e.id,s.id,a.employee_name,a.station_name,a.work_role,a.shift_start,transaction,t,t+interval '2 minutes') returning * into c;
  end if;
  update public.capture_challenges set consumed=true where employee_id=e.id and id<>c.id and not consumed;
  return to_jsonb(c);
end;
$$;

create or replace function private.validate_attendance() returns trigger language plpgsql security definer set search_path = '' as $$
declare c public.capture_challenges; e public.employees; a public.daily_assignments;
begin
  if auth.uid() is null or new.employee_id <> auth.uid() then raise exception 'Attendance must belong to the signed-in employee'; end if;
  select * into e from public.employees where id=auth.uid() and active for update;
  if not found then raise exception 'Employee is inactive'; end if;
  select * into c from public.capture_challenges where id=new.challenge_id and employee_id=e.id for update;
  if not found or c.consumed or c.expires_at < clock_timestamp() then raise exception 'Camera session expired. Capture a new selfie.'; end if;
  new.attendance_date:=(c.issued_at at time zone 'Asia/Manila')::date;
  if new.attendance_date<>(clock_timestamp() at time zone 'Asia/Manila')::date then raise exception 'Attendance day changed. Start again.'; end if;
  if c.transaction_type='clock-in' then
    select * into a from public.daily_assignments where employee_id=e.id and work_date=new.attendance_date;
    if not found or a.station_id<>c.station_id or a.work_role is distinct from c.work_role or a.shift_start is distinct from c.shift_start
      or a.updated_at>c.issued_at then raise exception 'Daily assignment changed. Start again.'; end if;
    if not exists(select 1 from public.stations where id=c.station_id and active) then raise exception 'Station is inactive'; end if;
  elsif not exists(select 1 from public.attendance_records where employee_id=e.id and attendance_date=new.attendance_date and transaction_type='clock-in'
    and station_id=c.station_id and work_role is not distinct from c.work_role and official_timestamp<=c.issued_at) then
    raise exception 'Clock in before clocking out';
  end if;
  if new.photo_path <> e.id::text || '/' || c.id::text || '.jpg' then raise exception 'Invalid selfie reference'; end if;
  if not exists(select 1 from storage.objects where bucket_id='attendance-selfies' and name=new.photo_path and owner_id=auth.uid()::text) then raise exception 'Upload a camera selfie before submitting'; end if;
  new.station_id:=c.station_id; new.employee_name:=c.employee_name; new.station_name:=c.station_name; new.work_role:=c.work_role;
  new.transaction_type:=c.transaction_type; new.official_timestamp:=c.issued_at;
  new.status:=case when c.transaction_type='clock-out' then 'completed' when (c.issued_at at time zone 'Asia/Manila')::time > c.shift_start then 'late' else 'on-time' end;
  new.created_at:=clock_timestamp(); new.updated_at:=new.created_at;
  update public.capture_challenges set consumed=true where id=c.id;
  return new;
end;
$$;

create or replace function private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare station uuid; row_data jsonb;
begin
  if auth.uid() is null then return coalesce(new,old); end if;
  row_data := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  station := case when tg_table_name='stations' then (row_data->>'id')::uuid else (row_data->>'station_id')::uuid end;
  if tg_table_name='attendance_reviews' then select station_id into station from public.attendance_records where id=new.attendance_id; end if;
  insert into public.audit_logs(actor_id,action,table_name,entity_id,station_id,details)
  values(auth.uid(),tg_op,tg_table_name,row_data->>'id',station,jsonb_build_object('before',case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,'after',case when tg_op='DELETE' then null else to_jsonb(new) end));
  return coalesce(new,old);
end;
$$;
create trigger assignments_audit after insert or update or delete on public.daily_assignments for each row execute function private.audit_change();
commit;
