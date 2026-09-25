import { supabase } from '../../lib/supabaseClient.js'
import { getRange, normalizeSearch } from '../query.js'

export function getFullName(profile) {
  return [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ') || 'Unnamed employee'
}

export function getPrimaryBranch(employee) {
  return employee?.employee_branches?.find((assignment) => assignment.is_primary)?.branches ?? null
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

export async function listEmployees({ page = 1, pageSize = 10, search, status, branchId } = {}) {
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
  if (branchId) query = query.eq('employee_branches.branch_id', branchId)

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
