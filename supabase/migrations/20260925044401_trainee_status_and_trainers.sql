begin;

alter table public.employees
  add column staff_type text not null default 'regular'
    check (staff_type in ('regular', 'trainee'));
grant update (staff_type) on public.employees to authenticated;

create or replace function private.validate_employee_staff_type() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.staff_type is distinct from old.staff_type and exists(
    select 1 from public.daily_assignments a
    where a.employee_id = new.id
      and a.work_date >= (clock_timestamp() at time zone 'Asia/Manila')::date
      and ((new.staff_type = 'trainee' and a.work_role <> 'Trainee') or (new.staff_type = 'regular' and a.work_role = 'Trainee'))
  ) then
    raise exception 'Update future assignments before changing this employee''s person type';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_employee_staff_type() from public, anon, authenticated;
create trigger employees_staff_type_validate before update on public.employees for each row execute function private.validate_employee_staff_type();

alter table public.daily_assignments
  add column trainer_id uuid references public.employees(id);
grant insert(employee_id,station_id,work_date,work_role,trainer_id) on public.daily_assignments to authenticated;
grant update(employee_id,station_id,work_date,work_role,trainer_id) on public.daily_assignments to authenticated;

create or replace function private.validate_assignment() returns trigger language plpgsql security definer set search_path = '' as $$
declare e public.employees; s public.stations; trainer public.employees; trainer_assignment public.daily_assignments; target public.daily_assignments;
begin
  if auth.uid() is null then raise exception 'Sign in to arrange schedules'; end if;
  target := case when tg_op='DELETE' then old else new end;
  if tg_op='UPDATE' and (new.employee_id<>old.employee_id or new.work_date<>old.work_date) then
    raise exception 'Employee and date cannot change. Create a separate daily assignment.';
  end if;
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
  if e.staff_type = 'trainee' and new.work_role <> 'Trainee' then raise exception 'Trainees can only be assigned the Trainee role'; end if;
  if e.staff_type = 'regular' and new.work_role = 'Trainee' then raise exception 'Only trainee employees can be assigned the Trainee role'; end if;
  if new.work_role = 'Trainee' then
    if new.trainer_id is null then raise exception 'A trainee assignment requires a trainer'; end if;
    select * into trainer from public.employees where id=new.trainer_id and active;
    if not found or trainer.staff_type <> 'regular' then raise exception 'The trainer must be active regular staff'; end if;
    select * into trainer_assignment from public.daily_assignments where employee_id=new.trainer_id and work_date=new.work_date and station_id=new.station_id and work_role in ('Cook','Barista','Cashier (OTD)');
    if not found then raise exception 'The trainer must be Cook, Barista, or Cashier (OTD) assigned to this station on this day'; end if;
  elsif new.trainer_id is not null then raise exception 'Only trainee assignments can have a trainer';
  end if;
  new.employee_name:=e.name; new.station_name:=s.name;
  new.shift_start:=private.role_shift_start(new.work_role,s.shift_start); new.shift_end:=s.shift_end;
  new.updated_at:=clock_timestamp();
  return new;
end;
$$;

revoke all on function private.validate_assignment() from public, anon, authenticated;
create or replace function private.assignment_trainer_update_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.daily_assignments where trainer_id=old.employee_id and work_date=old.work_date and station_id=old.station_id) then
    raise exception 'A trainer cannot be removed from a station while training someone';
  end if;
  return old;
end;
$$;
revoke all on function private.assignment_trainer_update_guard() from public, anon, authenticated;
create trigger assignments_trainer_guard before delete or update on public.daily_assignments for each row execute function private.assignment_trainer_update_guard();

commit;
