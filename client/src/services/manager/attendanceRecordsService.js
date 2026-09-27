import { supabase } from '../../lib/supabaseClient.js'
import { getRange } from '../query.js'
import { findEmployeeIdsBySearch } from './employeeService.js'

const offlineAttendanceColumns = [
  'clock_in_captured_at',
  'clock_in_synced_at',
  'clock_in_client_event_id',
  'clock_in_device_id',
  'clock_in_was_offline',
  'clock_in_sync_delay_seconds',
  'clock_in_requires_review',
  'clock_in_review_reason',
  'clock_out_captured_at',
  'clock_out_synced_at',
  'clock_out_client_event_id',
  'clock_out_device_id',
  'clock_out_was_offline',
  'clock_out_sync_delay_seconds',
  'clock_out_requires_review',
  'clock_out_review_reason',
]

let supportsOfflineAttendanceColumns = false

function isMissingOfflineAttendanceColumn(error) {
  const message = error?.message ?? ''
  return (
    error?.code === '42703'
    || /attendance_records.*does not exist/i.test(message)
    || /Could not find.*attendance_records/i.test(message)
    || offlineAttendanceColumns.some((column) => message.includes(column))
  )
}

function withOfflineDefaults(record) {
  return offlineAttendanceColumns.reduce(
    (nextRecord, column) => ({
      ...nextRecord,
      [column]: column.includes('_was_offline') || column.includes('_requires_review') ? false : null,
    }),
    record,
  )
}

function normalizeAttendanceRows(rows) {
  return (rows ?? []).map(withOfflineDefaults)
}

const attendanceListSelect = `
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
`

const attendanceDetailsSelect = `
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
`

const employeeHistorySelect = `
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
`

function appendOfflineColumns(select) {
  return `
    ${select},
    ${offlineAttendanceColumns.join(',\n    ')}
  `
}

export async function listManagerAttendanceRecords({
  page = 1,
  pageSize = 10,
  search,
  branchId,
  employeeId,
  status,
  startDate,
  endDate,
  lateOnly = false,
  missingClockOut = false,
  needsOfflineReview = false,
} = {}) {
  if (!supabase) return { rows: [], count: 0 }

  const employeeIds = await findEmployeeIdsBySearch(search)
  if (employeeIds?.length === 0) return { rows: [], count: 0 }

  const { from, to } = getRange(page, pageSize)

  const buildQuery = (includeOfflineColumns = true) => {
    let query = supabase
      .from('attendance_records')
      .select(includeOfflineColumns ? appendOfflineColumns(attendanceListSelect) : attendanceListSelect, { count: 'exact' })
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
    if (needsOfflineReview && includeOfflineColumns) {
      query = query.or('clock_in_requires_review.eq.true,clock_out_requires_review.eq.true')
    }

    return query
  }

  const shouldRequestOfflineColumns = supportsOfflineAttendanceColumns
  if (needsOfflineReview && !shouldRequestOfflineColumns) return { rows: [], count: 0 }

  let { data, error, count } = await buildQuery(shouldRequestOfflineColumns)

  if (error && isMissingOfflineAttendanceColumn(error)) {
    supportsOfflineAttendanceColumns = false
    if (needsOfflineReview) return { rows: [], count: 0 }

    const fallback = await buildQuery(false)
    data = fallback.data
    error = fallback.error
    count = fallback.count
  } else if (!error && shouldRequestOfflineColumns) {
    supportsOfflineAttendanceColumns = true
  }

  if (error) throw error

  return { rows: normalizeAttendanceRows(data), count: count ?? 0 }
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

  const buildQuery = (includeOfflineColumns = true) =>
    supabase
      .from('attendance_records')
      .select(includeOfflineColumns ? appendOfflineColumns(attendanceDetailsSelect) : attendanceDetailsSelect)
      .eq('id', attendanceId)
      .single()

  const shouldRequestOfflineColumns = supportsOfflineAttendanceColumns
  let { data, error } = await buildQuery(shouldRequestOfflineColumns)

  if (error && isMissingOfflineAttendanceColumn(error)) {
    supportsOfflineAttendanceColumns = false
    const fallback = await buildQuery(false)
    data = fallback.data
    error = fallback.error
  } else if (!error && shouldRequestOfflineColumns) {
    supportsOfflineAttendanceColumns = true
  }

  if (error) throw error
  return data ? withOfflineDefaults(data) : data
}

export async function listEmployeeAttendanceHistory({ employeeId, page = 1, pageSize = 10 } = {}) {
  if (!supabase || !employeeId) return { rows: [], count: 0 }

  const { from, to } = getRange(page, pageSize)
  const buildQuery = (includeOfflineColumns = true) =>
    supabase
      .from('attendance_records')
      .select(includeOfflineColumns ? appendOfflineColumns(employeeHistorySelect) : employeeHistorySelect, { count: 'exact' })
      .eq('employee_id', employeeId)
      .order('attendance_date', { ascending: false })
      .order('clock_in_at', { ascending: false, nullsFirst: false })
      .range(from, to)

  const shouldRequestOfflineColumns = supportsOfflineAttendanceColumns
  let { data, error, count } = await buildQuery(shouldRequestOfflineColumns)

  if (error && isMissingOfflineAttendanceColumn(error)) {
    supportsOfflineAttendanceColumns = false
    const fallback = await buildQuery(false)
    data = fallback.data
    error = fallback.error
    count = fallback.count
  } else if (!error && shouldRequestOfflineColumns) {
    supportsOfflineAttendanceColumns = true
  }

  if (error) throw error
  return { rows: normalizeAttendanceRows(data), count: count ?? 0 }
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
