import { supabase } from '../../lib/supabaseClient.js'
import { getRange } from '../shared/query.js'
import { findEmployeeIdsBySearch } from './employeeService.js'

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

export async function listEmployeeAttendanceHistory({ employeeId, page = 1, pageSize = 10 } = {}) {
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
