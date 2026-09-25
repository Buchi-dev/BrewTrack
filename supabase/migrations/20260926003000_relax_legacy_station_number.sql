do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'station_schedule_assignments'
      and column_name = 'station_number'
  ) then
    alter table public.station_schedule_assignments
      alter column station_number drop not null;
  end if;
end;
$$;
