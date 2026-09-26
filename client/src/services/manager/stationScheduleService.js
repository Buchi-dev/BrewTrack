import { supabase } from '../../lib/supabaseClient.js'

export const STATION_ROLE_OPTIONS = [
  { value: 'cook', label: 'Cook' },
  { value: 'barista', label: 'Barista' },
  { value: 'otd_cashier', label: 'OTD / Cashier' },
  { value: 'trainee', label: 'Trainee' },
]

export function getStationLabel(station) {
  if (!station) return 'Unassigned'
  if (typeof station === 'number') return `Station ${station}`
  if (typeof station === 'string') return station
  if (station.stationName) return station.stationCode ? `${station.stationName} (${station.stationCode})` : station.stationName
  if (station.name) return station.code ? `${station.name} (${station.code})` : station.name
  return 'Unassigned'
}

export function getStationRoleLabel(role) {
  return STATION_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role ?? 'Unassigned'
}

export function getScheduleStaffName(profile) {
  return [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ') || 'Unnamed staff'
}

export function formatScheduleTime(value) {
  if (!value) return '--'

  const [hours = '0', minutes = '0'] = String(value).split(':')
  const date = new Date()
  date.setHours(Number(hours), Number(minutes), 0, 0)

  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatScheduleTimeRange(start, end) {
  if (!start || !end) return '--'
  return `${formatScheduleTime(start)} - ${formatScheduleTime(end)}`
}

export async function listStationScheduleAssignments(scheduleDate) {
  if (!supabase || !scheduleDate) return []

  const { data, error } = await supabase
    .from('station_schedule_assignments')
    .select(
      `
        id,
        schedule_date,
        branch_id,
        station_role,
        scheduled_start,
        scheduled_end,
        trainer_employee_id,
        employee_id,
        notes
      `,
    )
    .eq('schedule_date', scheduleDate)
    .order('branch_id', { ascending: true })
    .order('station_role', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function listStationScheduleAssignmentsRange(startDate, endDate) {
  if (!supabase || !startDate || !endDate) return []

  const { data, error } = await supabase
    .from('station_schedule_assignments')
    .select(
      `
        id,
        schedule_date,
        branch_id,
        station_role,
        scheduled_start,
        scheduled_end,
        trainer_employee_id,
        employee_id,
        notes
      `,
    )
    .gte('schedule_date', startDate)
    .lte('schedule_date', endDate)
    .order('schedule_date', { ascending: true })
    .order('branch_id', { ascending: true })
    .order('station_role', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function saveStationScheduleAssignment(values, assignmentId = null) {
  if (!supabase) return null

  const payload = {
    schedule_date: values.schedule_date,
    branch_id: values.branch_id,
    employee_id: values.employee_id,
    station_role: values.station_role,
    scheduled_start: values.scheduled_start,
    scheduled_end: values.scheduled_end,
    trainer_employee_id: values.station_role === 'trainee' ? values.trainer_employee_id : null,
    notes: values.notes?.trim() || null,
  }

  const query = assignmentId
    ? supabase.from('station_schedule_assignments').update(payload).eq('id', assignmentId).select().single()
    : supabase.from('station_schedule_assignments').insert(payload).select().single()

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function deleteStationScheduleAssignment(assignmentId) {
  if (!supabase || !assignmentId) return

  const { error } = await supabase.from('station_schedule_assignments').delete().eq('id', assignmentId)
  if (error) throw error
}

export async function getTodayStationAssignment() {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_today_station_assignment')
  if (error) throw error
  return data
}

export async function getStaffStationSchedule(startDate, endDate) {
  if (!supabase || !startDate || !endDate) return []

  const { data, error } = await supabase.rpc('get_staff_station_schedule', {
    p_start_date: startDate,
    p_end_date: endDate,
  })
  if (error) throw error
  return data ?? []
}
