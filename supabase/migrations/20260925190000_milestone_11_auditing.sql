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

drop trigger if exists audit_attendance_record_changes_after_insert_update on public.attendance_records;

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
    perform public.insert_audit_log(
      auth.uid(),
      v_action,
      tg_table_name,
      v_resource_id,
      null,
      to_jsonb(new),
      v_metadata
    );
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
    perform public.insert_audit_log(
      auth.uid(),
      v_action,
      tg_table_name,
      v_resource_id,
      to_jsonb(old),
      to_jsonb(new),
      v_metadata
    );
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
  perform public.insert_audit_log(
    auth.uid(),
    v_action,
    tg_table_name,
    v_resource_id,
    to_jsonb(old),
    null,
    v_metadata
  );
  return old;
end;
$$;

drop trigger if exists audit_profiles_after_update on public.profiles;
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

drop trigger if exists audit_branches_after_insert_update_delete on public.branches;
create trigger audit_branches_after_insert_update_delete
  after insert or update or delete on public.branches
  for each row execute function public.audit_manager_table_changes();

drop trigger if exists audit_employee_branches_after_insert_update_delete on public.employee_branches;
create trigger audit_employee_branches_after_insert_update_delete
  after insert or update or delete on public.employee_branches
  for each row execute function public.audit_manager_table_changes();

drop trigger if exists audit_app_settings_after_update on public.app_settings;
create trigger audit_app_settings_after_update
  after update on public.app_settings
  for each row execute function public.audit_manager_table_changes();

drop policy if exists "attendance_events_write_manager" on public.attendance_events;
drop policy if exists "audit_logs_insert_manager" on public.audit_logs;

create policy "attendance_events_insert_system_or_manager"
  on public.attendance_events
  for insert
  to authenticated
  with check (public.is_manager());

revoke insert, update, delete on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;

revoke execute on function public.insert_audit_log(uuid, text, text, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.insert_attendance_event(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_manager_action(text, text, uuid, jsonb, jsonb, jsonb) to authenticated;
