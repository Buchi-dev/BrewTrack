import { supabase } from '../lib/supabaseClient.js'

const PAGE_SIZE = 10

function getRange(page = 1, pageSize = PAGE_SIZE) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

function normalizeSearch(value) {
  return value?.trim() || ''
}

export function getFullName(profile) {
  return [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ') || 'Unnamed employee'
}

export function getPrimaryBranch(employee) {
  return employee?.employee_branches?.find((assignment) => assignment.is_primary)?.branches ?? null
}

async function findEmployeeIdsBySearch(search) {
  const term = normalizeSearch(search)
  if (!term) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .or(
      `first_name.ilike.%${term}%,middle_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_number.ilike.%${term}%`,
    )
    .limit(100)

  if (error) throw error
  return data?.map((profile) => profile.id) ?? []
}

export async function listBranches({ page = 1, pageSize = PAGE_SIZE, search, status } = {}) {
  if (!supabase) return { rows: [], count: 0 }

  const { from, to } = getRange(page, pageSize)
  let query = supabase
    .from('branches')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to)

  const term = normalizeSearch(search)
  if (term) {
    query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%,address.ilike.%${term}%`)
  }

  if (status === 'active') query = query.eq('is_active', true)
  if (status === 'inactive') query = query.eq('is_active', false)

  const { data, error, count } = await query
  if (error) throw error

  return { rows: data ?? [], count: count ?? 0 }
}

export async function listAllBranches() {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('branches')
    .select('id, name, code, timezone, is_active')
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function saveBranch(values, branchId) {
  if (!supabase) return null

  const payload = {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    address: values.address?.trim() || null,
    timezone: values.timezone?.trim() || 'Asia/Manila',
    geofence_radius: Number(values.geofence_radius ?? 0),
    latitude: values.latitude === '' || values.latitude == null ? null : Number(values.latitude),
    longitude: values.longitude === '' || values.longitude == null ? null : Number(values.longitude),
    is_active: values.is_active ?? true,
  }

  const query = branchId
    ? supabase.from('branches').update(payload).eq('id', branchId).select().single()
    : supabase.from('branches').insert(payload).select().single()

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function listEmployees({ page = 1, pageSize = PAGE_SIZE, search, status, branchId } = {}) {
  if (!supabase) return { rows: [], count: 0 }

  const { from, to } = getRange(page, pageSize)
  const branchJoin = branchId ? 'employee_branches!inner' : 'employee_branches'
  let query = supabase
    .from('profiles')
    .select(
      `
        id,
        first_name,
        middle_name,
        last_name,
        employee_number,
        role,
        status,
        phone,
        created_at,
        ${branchJoin} (
          id,
          is_primary,
          branch_id,
          branches (
            id,
            name,
            code
          )
        )
      `,
      { count: 'exact' },
    )
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .range(from, to)

  const term = normalizeSearch(search)
  if (term) {
    query = query.or(
      `first_name.ilike.%${term}%,middle_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_number.ilike.%${term}%`,
    )
  }

  if (status) query = query.eq('status', status)

  if (branchId) {
    query = query.eq('employee_branches.branch_id', branchId)
  }

  const { data, error, count } = await query
  if (error) throw error

  return { rows: data ?? [], count: count ?? 0 }
}

export async function saveEmployeeProfile(employeeId, values) {
  if (!supabase || !employeeId) return null

  const payload = {
    first_name: values.first_name.trim(),
    middle_name: values.middle_name?.trim() || null,
    last_name: values.last_name.trim(),
    employee_number: values.employee_number?.trim() || null,
    phone: values.phone?.trim() || null,
    role: values.role,
    status: values.status,
  }

  const { data, error } = await supabase.from('profiles').update(payload).eq('id', employeeId).select().single()
  if (error) throw error

  await setPrimaryBranch(employeeId, values.branch_id || null)

  return data
}

export async function setPrimaryBranch(employeeId, branchId) {
  if (!supabase || !employeeId) return

  const { error: clearError } = await supabase
    .from('employee_branches')
    .update({ is_primary: false })
    .eq('employee_id', employeeId)

  if (clearError) throw clearError

  if (!branchId) return

  const { error } = await supabase.from('employee_branches').upsert(
    {
      employee_id: employeeId,
      branch_id: branchId,
      is_primary: true,
    },
    { onConflict: 'employee_id,branch_id' },
  )

  if (error) throw error
}

export async function listManagerAttendanceRecords({
  page = 1,
  pageSize = PAGE_SIZE,
  search,
  branchId,
  employeeId,
  status,
  startDate,
  endDate,
  lateOnly = false,
  missingClockOut = false,
} = {}) {
  if (!supabase) return { rows: [], count: 0 }

  const employeeIds = await findEmployeeIdsBySearch(search)
  if (employeeIds?.length === 0) return { rows: [], count: 0 }

  const { from, to } = getRange(page, pageSize)
  let query = supabase
    .from('attendance_records')
    .select(
      `
        id,
        employee_id,
        branch_id,
        attendance_date,
        clock_in_at,
        clock_out_at,
        clock_in_photo_path,
        clock_out_photo_path,
        scheduled_start,
        scheduled_end,
        late_minutes,
        worked_minutes,
        status,
        notes,
        profiles (
          id,
          first_name,
          middle_name,
          last_name,
          employee_number
        ),
        branches (
          id,
          name,
          code
        )
      `,
      { count: 'exact' },
    )
    .order('attendance_date', { ascending: false })
    .order('clock_in_at', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (employeeIds) query = query.in('employee_id', employeeIds)
  if (employeeId) query = query.eq('employee_id', employeeId)
  if (branchId) query = query.eq('branch_id', branchId)
  if (status) query = query.eq('status', status)
  if (startDate) query = query.gte('attendance_date', startDate)
  if (endDate) query = query.lte('attendance_date', endDate)
  if (lateOnly) query = query.gt('late_minutes', 0)
  if (missingClockOut) query = query.not('clock_in_at', 'is', null).is('clock_out_at', null)

  const { data, error, count } = await query
  if (error) throw error

  return { rows: data ?? [], count: count ?? 0 }
}

export function listDailyAttendanceReport({ date, ...filters } = {}) {
  return listManagerAttendanceRecords({
    ...filters,
    startDate: date,
    endDate: date,
  })
}

export function listMonthlyAttendanceReport({ startDate, endDate, ...filters } = {}) {
  return listManagerAttendanceRecords({
    ...filters,
    startDate,
    endDate,
  })
}

export function listEmployeeAttendanceReport({ employeeId, startDate, endDate, ...filters } = {}) {
  return listManagerAttendanceRecords({
    ...filters,
    employeeId,
    startDate,
    endDate,
  })
}

export function listLateAttendanceReport({ startDate, endDate, ...filters } = {}) {
  return listManagerAttendanceRecords({
    ...filters,
    startDate,
    endDate,
    lateOnly: true,
  })
}

export function listMissingClockOutReport({ startDate, endDate, ...filters } = {}) {
  return listManagerAttendanceRecords({
    ...filters,
    startDate,
    endDate,
    missingClockOut: true,
  })
}

export async function getManagerAttendanceDetails(attendanceId) {
  if (!supabase || !attendanceId) return null

  const { data, error } = await supabase
    .from('attendance_records')
    .select(
      `
        id,
        employee_id,
        branch_id,
        attendance_date,
        clock_in_at,
        clock_out_at,
        clock_in_photo_path,
        clock_out_photo_path,
        clock_in_latitude,
        clock_in_longitude,
        clock_out_latitude,
        clock_out_longitude,
        scheduled_start,
        scheduled_end,
        late_minutes,
        worked_minutes,
        status,
        notes,
        created_at,
        updated_at,
        profiles (
          id,
          first_name,
          middle_name,
          last_name,
          employee_number,
          phone,
          status
        ),
        branches (
          id,
          name,
          code,
          timezone
        )
      `,
    )
    .eq('id', attendanceId)
    .single()

  if (error) throw error
  return data
}

export async function listEmployeeAttendanceHistory({ employeeId, page = 1, pageSize = PAGE_SIZE } = {}) {
  if (!supabase || !employeeId) return { rows: [], count: 0 }

  const { from, to } = getRange(page, pageSize)
  const { data, error, count } = await supabase
    .from('attendance_records')
    .select(
      `
        id,
        attendance_date,
        clock_in_at,
        clock_out_at,
        late_minutes,
        worked_minutes,
        status,
        branches (
          name,
          code
        )
      `,
      { count: 'exact' },
    )
    .eq('employee_id', employeeId)
    .order('attendance_date', { ascending: false })
    .order('clock_in_at', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (error) throw error
  return { rows: data ?? [], count: count ?? 0 }
}

export async function listAttendanceEvents(attendanceId) {
  if (!supabase || !attendanceId) return []

  const { data, error } = await supabase
    .from('attendance_events')
    .select('id, attendance_id, employee_id, event_type, metadata, created_at')
    .eq('attendance_id', attendanceId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function listAuditLogs({
  page = 1,
  pageSize = PAGE_SIZE,
  search,
  action,
  resourceType,
  startDate,
  endDate,
} = {}) {
  if (!supabase) return { rows: [], count: 0 }

  const { from, to } = getRange(page, pageSize)
  let query = supabase
    .from('audit_logs')
    .select(
      `
        id,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values,
        metadata,
        created_at,
        profiles (
          id,
          first_name,
          middle_name,
          last_name,
          employee_number
        )
      `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  const term = normalizeSearch(search)
  if (term) {
    query = query.or(`action.ilike.%${term}%,resource_type.ilike.%${term}%`)
  }

  if (action) query = query.eq('action', action)
  if (resourceType) query = query.eq('resource_type', resourceType)
  if (startDate) query = query.gte('created_at', `${startDate}T00:00:00+08:00`)
  if (endDate) query = query.lte('created_at', `${endDate}T23:59:59+08:00`)

  const { data, error, count } = await query
  if (error) throw error

  return { rows: data ?? [], count: count ?? 0 }
}

export async function logManagerAction({
  action,
  resourceType,
  resourceId = null,
  oldValues = null,
  newValues = null,
  metadata = {},
} = {}) {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('log_manager_action', {
    p_action: action,
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_old_values: oldValues,
    p_new_values: newValues,
    p_metadata: metadata,
  })

  if (error) throw error
  return data
}
