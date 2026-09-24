-- One shift per employee per Manila calendar day. Transactions are immutable.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  role text not null default 'employee' check (role in ('employee','manager','admin')),
  created_at timestamptz not null default now()
);
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 120),
  address text not null default '',
  shift_start time not null default '09:00',
  shift_end time not null default '18:00',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (shift_end > shift_start)
);
create table public.manager_branches (
  manager_id uuid not null references public.profiles(id),
  branch_id uuid not null references public.branches(id),
  primary key (manager_id, branch_id)
);
create index manager_branches_branch_idx on public.manager_branches(branch_id);
create table public.employees (
  id uuid primary key references public.profiles(id),
  code text not null unique,
  name text not null check (length(trim(name)) between 1 and 120),
  email text not null,
  position text not null default 'Team member',
  branch_id uuid not null references public.branches(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employees_branch_idx on public.employees(branch_id);
create table public.capture_challenges (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  branch_id uuid not null references public.branches(id),
  employee_name text not null,
  branch_name text not null,
  transaction_type text not null check (transaction_type in ('clock-in','clock-out')),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '2 minutes'),
  consumed boolean not null default false
);
create index challenges_employee_idx on public.capture_challenges(employee_id, issued_at desc);
create index challenges_branch_idx on public.capture_challenges(branch_id);
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  branch_id uuid not null references public.branches(id),
  employee_name text not null,
  branch_name text not null,
  transaction_type text not null check (transaction_type in ('clock-in','clock-out')),
  official_timestamp timestamptz not null,
  attendance_date date not null,
  photo_path text not null unique,
  challenge_id uuid not null unique references public.capture_challenges(id),
  status text not null check (status in ('on-time','late','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, attendance_date, transaction_type)
);
create index attendance_branch_date_idx on public.attendance_records(branch_id, attendance_date desc);
create index attendance_date_idx on public.attendance_records(attendance_date desc, official_timestamp desc);
create table public.attendance_reviews (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance_records(id),
  reviewer_id uuid not null default auth.uid() references public.profiles(id),
  verdict text not null check (verdict in ('verified','flagged')),
  note text not null default '' check (length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index reviews_attendance_idx on public.attendance_reviews(attendance_id, created_at desc);
create index reviews_reviewer_idx on public.attendance_reviews(reviewer_id);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  entity_id text not null,
  branch_id uuid references public.branches(id),
  details jsonb not null,
  created_at timestamptz not null default now()
);
create index audit_branch_idx on public.audit_logs(branch_id, created_at desc);
create index audit_actor_idx on public.audit_logs(actor_id);

-- These narrow internal helpers deliberately bypass RLS to avoid policy recursion.
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create function private.can_manage(branch uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (private.is_admin() or exists(
    select 1 from public.manager_branches m join public.profiles p on p.id=m.manager_id
    where m.manager_id=auth.uid() and m.branch_id=branch and p.role='manager'));
$$;
create function private.assigned_branch(branch uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.employees where id=auth.uid() and branch_id=branch);
$$;
revoke all on function private.is_admin(), private.can_manage(uuid), private.assigned_branch(uuid) from public, anon;
grant execute on function private.is_admin(), private.can_manage(uuid), private.assigned_branch(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.manager_branches enable row level security;
alter table public.employees enable row level security;
alter table public.capture_challenges enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_reviews enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (id=(select auth.uid()) or private.is_admin());
create policy branches_read on public.branches for select to authenticated using (private.can_manage(id) or private.assigned_branch(id));
create policy branches_insert on public.branches for insert to authenticated with check (private.is_admin());
create policy branches_update on public.branches for update to authenticated using (private.can_manage(id)) with check (private.can_manage(id));
create policy manager_branches_read on public.manager_branches for select to authenticated using (manager_id=(select auth.uid()) or private.is_admin());
create policy employees_read on public.employees for select to authenticated using (id=(select auth.uid()) or private.can_manage(branch_id));
create policy employees_insert on public.employees for insert to authenticated with check (private.can_manage(branch_id));
create policy employees_update on public.employees for update to authenticated using (private.can_manage(branch_id)) with check (private.can_manage(branch_id));
create policy challenges_read on public.capture_challenges for select to authenticated using (employee_id=(select auth.uid()));
create policy attendance_read on public.attendance_records for select to authenticated using (employee_id=(select auth.uid()) or private.can_manage(branch_id));
create policy attendance_insert on public.attendance_records for insert to authenticated with check (employee_id=(select auth.uid()));
create policy reviews_read on public.attendance_reviews for select to authenticated using (exists(select 1 from public.attendance_records a where a.id=attendance_id));
create policy reviews_insert on public.attendance_reviews for insert to authenticated with check (reviewer_id=(select auth.uid()) and exists(select 1 from public.attendance_records a where a.id=attendance_id and private.can_manage(a.branch_id)));
create policy audit_read on public.audit_logs for select to authenticated using (private.is_admin() or private.can_manage(branch_id));

revoke all on public.profiles, public.branches, public.manager_branches, public.employees, public.capture_challenges, public.attendance_records, public.attendance_reviews, public.audit_logs from anon, authenticated;
grant select on public.profiles, public.branches, public.manager_branches, public.employees, public.capture_challenges, public.attendance_records, public.attendance_reviews, public.audit_logs to authenticated;
grant insert on public.branches, public.employees to authenticated;
grant update (name,address,shift_start,shift_end,active) on public.branches to authenticated;
grant update (code,name,email,position,branch_id,active) on public.employees to authenticated;
grant insert (employee_id,challenge_id,photo_path) on public.attendance_records to authenticated;
grant insert (attendance_id,verdict,note) on public.attendance_reviews to authenticated;

create function private.begin_attendance(transaction text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.employees; b public.branches; c public.capture_challenges; d date; t timestamptz := clock_timestamp();
begin
  if auth.uid() is null then raise exception 'Sign in to record attendance'; end if;
  if transaction not in ('clock-in','clock-out') or transaction is null then raise exception 'Invalid transaction'; end if;
  select * into e from public.employees where id=auth.uid() and active for update;
  if not found then raise exception 'Your employee account is inactive or not assigned'; end if;
  select * into b from public.branches where id=e.branch_id and active;
  if not found then raise exception 'Your branch is inactive'; end if;
  d := (t at time zone 'Asia/Manila')::date;
  if exists(select 1 from public.attendance_records where employee_id=e.id and attendance_date=d and transaction_type=transaction) then raise exception 'This transaction is already recorded for today'; end if;
  if transaction='clock-out' and not exists(select 1 from public.attendance_records where employee_id=e.id and attendance_date=d and transaction_type='clock-in' and branch_id=b.id) then raise exception 'Clock in at this branch before clocking out'; end if;
  update public.capture_challenges set consumed=true where employee_id=e.id and not consumed;
  insert into public.capture_challenges(employee_id,branch_id,employee_name,branch_name,transaction_type,issued_at,expires_at)
  values(e.id,b.id,e.name,b.name,transaction,t,t+interval '2 minutes') returning * into c;
  return to_jsonb(c);
end;
$$;
revoke all on function private.begin_attendance(text) from public, anon;
grant execute on function private.begin_attendance(text) to authenticated;
create function public.begin_attendance(transaction text) returns jsonb language sql security invoker set search_path = '' as $$ select private.begin_attendance(transaction); $$;
revoke all on function public.begin_attendance(text) from public, anon;
grant execute on function public.begin_attendance(text) to authenticated;

create function private.validate_attendance() returns trigger language plpgsql security definer set search_path = '' as $$
declare c public.capture_challenges; e public.employees; b public.branches;
begin
  if auth.uid() is null or new.employee_id <> auth.uid() then raise exception 'Attendance must belong to the signed-in employee'; end if;
  select * into e from public.employees where id=auth.uid() and active for update;
  if not found then raise exception 'Employee is inactive'; end if;
  select * into c from public.capture_challenges where id=new.challenge_id and employee_id=e.id for update;
  if not found or c.consumed or c.expires_at < clock_timestamp() then raise exception 'Camera session expired. Capture a new selfie.'; end if;
  select * into b from public.branches where id=e.branch_id and active;
  if not found or b.id<>c.branch_id then raise exception 'Branch assignment changed. Start again.'; end if;
  if new.photo_path <> e.id::text || '/' || c.id::text || '.jpg' then raise exception 'Invalid selfie reference'; end if;
  if not exists(select 1 from storage.objects where bucket_id='attendance-selfies' and name=new.photo_path and owner_id=auth.uid()::text) then raise exception 'Upload a camera selfie before submitting'; end if;
  new.branch_id:=c.branch_id; new.employee_name:=c.employee_name; new.branch_name:=c.branch_name;
  new.transaction_type:=c.transaction_type; new.official_timestamp:=c.issued_at;
  new.attendance_date:=(c.issued_at at time zone 'Asia/Manila')::date;
  if new.attendance_date<>(clock_timestamp() at time zone 'Asia/Manila')::date then raise exception 'Attendance day changed. Start again.'; end if;
  if c.transaction_type='clock-out' and not exists(select 1 from public.attendance_records where employee_id=e.id and attendance_date=new.attendance_date and transaction_type='clock-in' and branch_id=b.id and official_timestamp<=c.issued_at) then raise exception 'Clock in before clocking out'; end if;
  new.status:=case when c.transaction_type='clock-out' then 'completed' when (c.issued_at at time zone 'Asia/Manila')::time > b.shift_start then 'late' else 'on-time' end;
  new.created_at:=clock_timestamp(); new.updated_at:=new.created_at;
  update public.capture_challenges set consumed=true where id=c.id;
  return new;
end;
$$;
revoke all on function private.validate_attendance() from public, anon, authenticated;
create trigger validate_attendance before insert on public.attendance_records for each row execute function private.validate_attendance();

create function private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare branch uuid;
begin
  if auth.uid() is null then return new; end if;
  branch := case when tg_table_name='branches' then new.id else (to_jsonb(new)->>'branch_id')::uuid end;
  if tg_table_name='attendance_reviews' then select branch_id into branch from public.attendance_records where id=new.attendance_id; end if;
  insert into public.audit_logs(actor_id,action,table_name,entity_id,branch_id,details)
  values(auth.uid(),tg_op,tg_table_name,new.id::text,branch,jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
  return new;
end;
$$;
revoke all on function private.audit_change() from public, anon, authenticated;
create function private.touch_updated() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at:=clock_timestamp(); return new; end; $$;
revoke all on function private.touch_updated() from public, anon, authenticated;
create trigger branches_touch before update on public.branches for each row execute function private.touch_updated();
create trigger employees_touch before update on public.employees for each row execute function private.touch_updated();
create trigger branches_audit after insert or update on public.branches for each row execute function private.audit_change();
create trigger employees_audit after insert or update on public.employees for each row execute function private.audit_change();
create trigger attendance_audit after insert on public.attendance_records for each row execute function private.audit_change();
create trigger reviews_audit after insert on public.attendance_reviews for each row execute function private.audit_change();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('attendance-selfies','attendance-selfies',false,5242880,array['image/jpeg']);
create policy selfie_insert on storage.objects for insert to authenticated with check (
  bucket_id='attendance-selfies' and owner_id=(select auth.uid())::text and exists(
    select 1 from public.capture_challenges c where c.employee_id=(select auth.uid()) and not c.consumed and c.expires_at>clock_timestamp() and name=c.employee_id::text || '/' || c.id::text || '.jpg'));
create policy selfie_read on storage.objects for select to authenticated using (
  bucket_id='attendance-selfies' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(
    select 1 from public.attendance_records a where a.photo_path=name and private.can_manage(a.branch_id))));
-- No UPDATE or DELETE policy: neither employees nor managers can replace evidence.
commit;
