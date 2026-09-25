import { supabase } from '../lib/supabaseClient.js'

const MANAGER_TODAY_LIMIT = 8

export async function getTodayAttendance() {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_today_attendance')

  if (error) throw error
  return data
}

export async function getManagerTodayAttendance(limit = MANAGER_TODAY_LIMIT) {
  if (!supabase) return []

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const { data, error } = await supabase
    .from('attendance_records')
    .select(
      `
        id,
        attendance_date,
        clock_in_at,
        clock_out_at,
        status,
        late_minutes,
        profiles (
          first_name,
          middle_name,
          last_name,
          employee_number
        ),
        branches (
          name,
          code
        )
      `,
    )
    .eq('attendance_date', today)
    .order('clock_in_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function getManagerDashboardSummary() {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_manager_dashboard_summary')

  if (error) throw error
  return data
}
