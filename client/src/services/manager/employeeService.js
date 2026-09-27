import { createClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from '../../config/env.js'
import { supabase } from '../../lib/supabaseClient.js'
import { getRange, normalizeSearch } from '../query.js'

export function getFullName(profile) {
  return [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ') || 'Unnamed employee'
}

export async function findEmployeeIdsBySearch(search) {
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

export async function listEmployees({ page = 1, pageSize = 10, search, status } = {}) {
  if (!supabase) return { rows: [], count: 0 }

  const { from, to } = getRange(page, pageSize)
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
        created_at
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

  const { data, error, count } = await query
  if (error) throw error

  return { rows: data ?? [], count: count ?? 0 }
}

export async function listActiveStaff() {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, middle_name, last_name, employee_number, role, status')
    .eq('role', 'staff')
    .eq('status', 'active')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function saveEmployeeProfile(employeeId, values) {
  if (!supabase || !employeeId) return null

  const payload = getEmployeePayload(values)

  const { data, error } = await supabase.from('profiles').update(payload).eq('id', employeeId).select().single()
  if (error) throw error

  return data
}

export async function createEmployeeProfile(values) {
  if (!supabase || !isSupabaseConfigured) return null

  const signupClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const payload = getEmployeePayload(values)
  const { data: authData, error: authError } = await signupClient.auth.signUp({
    email: values.email.trim(),
    password: values.temp_password,
    options: {
      data: {
        first_name: payload.first_name,
        middle_name: payload.middle_name,
        last_name: payload.last_name,
        employee_number: payload.employee_number,
        phone: payload.phone,
      },
    },
  })

  if (authError) throw authError

  const employeeId = authData.user?.id
  if (!employeeId) throw new Error('Unable to create the employee account.')

  return saveEmployeeProfile(employeeId, payload)
}

export async function deactivateEmployeeProfile(employeeId) {
  if (!supabase || !employeeId) return null

  const { data, error } = await supabase
    .from('profiles')
    .update({ status: 'inactive' })
    .eq('id', employeeId)
    .select()
    .single()

  if (error) throw error
  return data
}

function getEmployeePayload(values) {
  return {
    first_name: values.first_name.trim(),
    middle_name: values.middle_name?.trim() || null,
    last_name: values.last_name.trim(),
    employee_number: values.employee_number?.trim() || null,
    phone: values.phone?.trim() || null,
    role: values.role,
    status: values.status,
  }
}
