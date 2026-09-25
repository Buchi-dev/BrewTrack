drop policy if exists "branches_select_assigned_or_manager" on public.branches;

create policy "branches_select_assigned_schedule_attendance_or_manager"
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
    or exists (
      select 1
      from public.station_schedule_assignments ssa
      where ssa.branch_id = branches.id
        and ssa.employee_id = auth.uid()
    )
    or exists (
      select 1
      from public.attendance_records ar
      where ar.branch_id = branches.id
        and ar.employee_id = auth.uid()
    )
  );
