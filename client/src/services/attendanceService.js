import { supabase } from '../lib/supabaseClient.js'

export async function getTodayAttendance() {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_today_attendance')

  if (error) throw error
  return data
}

export async function getManagerDashboardSummary() {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_manager_dashboard_summary')

  if (error) throw error
  return data
}
